from __future__ import annotations

import logging
import random
import time
from uuid import uuid4

from django.conf import settings

from ...languages import language_display_name
from ...prompts import (
    TOPIC_CONVERSATION_ANALYZE_USER_TURN_PROMPT,
    TOPIC_CONVERSATION_GOAL_EVALUATION_PROMPT,
    TOPIC_CONVERSATION_GOAL_TRANSLATION_PROMPT,
    TOPIC_CONVERSATION_HELP_PROMPT,
    TOPIC_CONVERSATION_LITERAL_TRANSLATION_PROMPT,
    TOPIC_CONVERSATION_REPLY_PROMPT,
    TOPIC_CONVERSATION_START_PROMPT,
    TOPIC_CONVERSATION_TARGET_PHRASE_HELP_PROMPT,
    TOPIC_CONVERSATION_USER_CORRECTION_PROMPT,
)
from .core import call_openai_json

logger = logging.getLogger(__name__)

GOAL_LABELS_BY_LANGUAGE: dict[str, tuple[str, str]] = {
    "spanish": ("Objetivo", "Se cumple cuando"),
    "english": ("Goal", "Done when"),
    "german": ("Ziel", "Erreicht wenn"),
    "french": ("Objectif", "Reussi quand"),
    "italian": ("Obiettivo", "Completato quando"),
    "portuguese": ("Objetivo", "Concluido quando"),
}


def analyze_user_turn(
    *,
    user_text: str,
    history: list[dict[str, str]],
    source_language: str,
    target_language: str,
    context_label: str,
) -> dict[str, bool]:
    user_clean = str(user_text).strip()
    if not user_clean:
        return {"is_grammatically_correct": False, "makes_sense_in_context": False, "needs_correction": True}
    source_name = language_display_name(source_language)
    target_name = language_display_name(target_language)
    parsed = _call_openai_json_logged(
        label="analyze_user_turn",
        system_prompt=_render_prompt(
            TOPIC_CONVERSATION_ANALYZE_USER_TURN_PROMPT,
            target_name=target_name,
        ),
        user_input=(
            f"Source language: {source_name}\n"
            f"Target language: {target_name}\n"
            f"{context_label}"
            f"Recent conversation:\n{_recent_history_text(history, limit=12)}\n"
            f"Learner message ({target_name}): {user_clean}\n"
        ),
        timeout_seconds=8,
        model=_require_question_model(),
        temperature=0.0,
        top_p=1.0,
        presence_penalty=0.0,
    )
    if not isinstance(parsed, dict):
        raise RuntimeError("Question model request failed")
    required_keys = {"is_grammatically_correct", "makes_sense_in_context", "needs_correction"}
    if not required_keys.issubset(parsed.keys()):
        raise RuntimeError("Question model request failed")
    return {
        "is_grammatically_correct": bool(parsed["is_grammatically_correct"]),
        "makes_sense_in_context": bool(parsed["makes_sense_in_context"]),
        "needs_correction": bool(parsed["needs_correction"]),
    }


def literal_translate_user_text(
    *,
    user_text: str,
    source_language: str,
    target_language: str,
) -> str:
    user_clean = str(user_text).strip()
    if not user_clean:
        return ""
    source_name = language_display_name(source_language)
    target_name = language_display_name(target_language)
    parsed = _call_openai_json_logged(
        label="literal_translate_user_text",
        system_prompt=_render_prompt(
            TOPIC_CONVERSATION_LITERAL_TRANSLATION_PROMPT,
            source_name=source_name,
            target_name=target_name,
        ),
        user_input=(
            f"Source language: {source_name}\n"
            f"Target language: {target_name}\n"
            f"Learner text ({target_name}): {user_clean}\n"
        ),
        timeout_seconds=8,
        model=_require_question_model(),
        temperature=0.0,
        top_p=1.0,
        presence_penalty=0.0,
    )
    if not isinstance(parsed, dict):
        raise RuntimeError("Question model request failed")
    translation = str(parsed.get("translation", "")).strip()
    if not translation:
        raise RuntimeError("Question model request failed")
    return translation[:1200]


def generate_user_correction(
    *,
    user_text: str,
    history: list[dict[str, str]],
    source_language: str,
    target_language: str,
    context_label: str,
) -> dict[str, str]:
    user_clean = str(user_text).strip()
    if not user_clean:
        return {
            "corrected_user_text": "",
            "corrected_user_source_translation": "",
            "corrected_user_explanation": "",
        }
    source_name = language_display_name(source_language)
    target_name = language_display_name(target_language)
    parsed = _call_openai_json_logged(
        label="generate_user_correction",
        system_prompt=_render_prompt(
            TOPIC_CONVERSATION_USER_CORRECTION_PROMPT,
            source_name=source_name,
            target_name=target_name,
        ),
        user_input=(
            f"Source language: {source_name}\n"
            f"Target language: {target_name}\n"
            f"{context_label}"
            f"Recent conversation:\n{_recent_history_text(history, limit=12)}\n"
            f"Learner message ({target_name}): {user_clean}\n"
        ),
        timeout_seconds=8,
        model=_require_question_model(),
        temperature=0.0,
        top_p=1.0,
        presence_penalty=0.0,
    )
    if not isinstance(parsed, dict):
        raise RuntimeError("Question model request failed")
    corrected_user_text = str(parsed.get("corrected_user_text", "")).strip()
    corrected_user_source_translation = str(parsed.get("corrected_user_source_translation", "")).strip()
    corrected_user_explanation = str(parsed.get("corrected_user_explanation", "")).strip()
    if not corrected_user_text or not corrected_user_source_translation or not corrected_user_explanation:
        raise RuntimeError("Question model request failed")
    return {
        "corrected_user_text": corrected_user_text[:1200],
        "corrected_user_source_translation": corrected_user_source_translation[:1200],
        "corrected_user_explanation": corrected_user_explanation[:1200],
    }


def generate_topic_conversation_start(
    *,
    topic: str,
    notes: str,
    role_text: str,
    goal_difficulty: str,
    source_language: str,
    target_language: str,
) -> dict[str, str]:
    request_started_at = time.perf_counter()
    source_name = language_display_name(source_language)
    target_name = language_display_name(target_language)
    variation_seed = uuid4().hex[:8]
    rng = random.SystemRandom()
    goal_label, done_when_label = GOAL_LABELS_BY_LANGUAGE.get(source_language, ("Goal", "Done when"))

    for attempt in range(3):
        attempt_started_at = time.perf_counter()
        parsed = _call_openai_json_logged(
            label="generate_topic_conversation_start",
            system_prompt=_render_prompt(
                TOPIC_CONVERSATION_START_PROMPT,
                source_name=source_name,
            ),
            user_input=(
                f"Source language: {source_name}\n"
                f"Target language: {target_name}\n"
                f"Variation seed for this run: {variation_seed}-{attempt}\n"
                f"Topic: {topic}\n"
                f"Temporary notes: {notes}\n"
                f"Learner role: {role_text}\n"
                f"goal_difficulty: {goal_difficulty}\n"
            ),
            timeout_seconds=10,
            temperature=0.95,
            top_p=1.0,
            presence_penalty=0.6,
        )
        normalized_candidates = _normalized_goal_candidates(
            parsed,
            goal_label=goal_label,
            done_when_label=done_when_label,
        )
        logger.info(
            "content.topic_conversation.start_goal_attempt attempt=%s elapsed_ms=%s candidates=%s",
            attempt + 1,
            int((time.perf_counter() - attempt_started_at) * 1000),
            len(normalized_candidates),
        )
        if not normalized_candidates:
            continue

        rng.shuffle(normalized_candidates)
        candidate = normalized_candidates[0]
        logger.info(
            "content.topic_conversation.start_goal_finished elapsed_ms=%s attempts=%s goal_length=%s",
            int((time.perf_counter() - request_started_at) * 1000),
            attempt + 1,
            len(candidate["goal_text"]),
        )
        return {
            "goal_text": candidate["goal_text"],
            "opening_text": "",
            "opening_translation_text": "",
            "goal_difficulty": goal_difficulty,
        }
    logger.info(
        "content.topic_conversation.start_goal_failed elapsed_ms=%s attempts=%s",
        int((time.perf_counter() - request_started_at) * 1000),
        3,
    )
    raise RuntimeError("Question model request failed")


def evaluate_goal_achievement(
    *,
    topic: str,
    notes: str,
    role_text: str,
    goal_text: str,
    history: list[dict[str, str]],
    latest_user_text: str,
    source_language: str,
    target_language: str,
) -> tuple[bool, str, str]:
    goal_clean = str(goal_text).strip()
    if not goal_clean:
        return False, "", ""
    goal_clean_english = _translate_goal_text_to_english(
        goal_text=goal_clean,
        source_language=source_language,
    )

    source_name = language_display_name(source_language)
    target_name = language_display_name(target_language)
    parsed = _call_openai_json_logged(
        label="evaluate_goal_achievement",
        system_prompt=_render_prompt(
            TOPIC_CONVERSATION_GOAL_EVALUATION_PROMPT,
            source_name=source_name,
        ),
        user_input=(
            f"Source language: {source_name}\n"
            f"Target language: {target_name}\n"
            f"Topic: {topic}\n"
            f"Temporary notes: {notes}\n"
            f"Learner role: {role_text}\n"
            f"Goal text (English): {goal_clean_english}\n"
            f"Recent conversation:\n{_recent_history_text(history, limit=14)}\n"
            f"Latest learner message: {latest_user_text}\n"
        ),
        timeout_seconds=8,
        model=_require_question_model(),
        temperature=0.0,
        top_p=1.0,
        presence_penalty=0.0,
    )
    if not isinstance(parsed, dict) or "goal_achieved" not in parsed:
        raise RuntimeError("Question model request failed")
    achieved = bool(parsed["goal_achieved"])
    message = str(parsed.get("goal_achievement_message", "")).strip()
    next_goal_suggestion = str(parsed.get("next_goal_suggestion", "")).strip()
    if achieved and (not message or not next_goal_suggestion):
        raise RuntimeError("Question model request failed")
    if not achieved:
        return False, "", ""
    return True, message[:600], next_goal_suggestion[:600]


def generate_topic_conversation_reply(
    *,
    topic: str,
    notes: str,
    role_text: str,
    user_text: str,
    history: list[dict[str, str]],
    source_language: str,
    target_language: str,
) -> dict[str, str]:
    source_name = language_display_name(source_language)
    target_name = language_display_name(target_language)
    parsed = _call_openai_json_logged(
        label="generate_topic_conversation_reply",
        system_prompt=_render_prompt(
            TOPIC_CONVERSATION_REPLY_PROMPT,
            source_name=source_name,
            target_name=target_name,
        ),
        user_input=(
            f"Source language: {source_name}\n"
            f"Target language: {target_name}\n"
            f"Conversation topic: {topic}\n"
            f"Temporary notes: {notes}\n"
            f"Learner role: {role_text}\n"
            f"Recent conversation:\n{_recent_history_text(history, limit=12)}\n"
            f"Learner new message: {user_text}\n"
        ),
        timeout_seconds=10,
        temperature=0.6,
        top_p=0.9,
        presence_penalty=0.2,
    )
    if not isinstance(parsed, dict):
        raise RuntimeError("Question model request failed")
    reply_text = str(parsed.get("reply_text", "")).strip()
    source_translation = str(parsed.get("source_translation", "")).strip()
    if not reply_text or not source_translation:
        raise RuntimeError("Question model request failed")
    return {
        "reply_text": reply_text[:1200],
        "source_translation": source_translation[:1200],
    }


def generate_conversation_help(
    *,
    topic: str,
    notes: str,
    role_text: str,
    user_help_request_text: str,
    history: list[dict[str, str]],
    source_language: str,
    target_language: str,
) -> str:
    source_name = language_display_name(source_language)
    target_name = language_display_name(target_language)
    parsed = _call_openai_json_logged(
        label="generate_topic_conversation_help",
        system_prompt=_render_prompt(
            TOPIC_CONVERSATION_HELP_PROMPT,
            source_name=source_name,
            target_name=target_name,
        ),
        user_input=(
            f"Source language: {source_name}\n"
            f"Target language: {target_name}\n"
            f"Topic: {topic}\n"
            f"Temporary notes: {notes}\n"
            f"Learner role: {role_text}\n"
            f"Recent conversation:\n{_recent_history_text(history, limit=10)}\n"
            f"Learner help request ({source_name}): {user_help_request_text}\n"
        ),
        timeout_seconds=8,
        model=_require_question_model(),
        temperature=0.15,
        top_p=0.95,
        presence_penalty=0.1,
    )
    if not isinstance(parsed, dict):
        raise RuntimeError("Question model request failed")
    help_text = str(parsed.get("help_text", "")).strip()
    if not help_text:
        raise RuntimeError("Question model request failed")
    return help_text[:1600]


def generate_target_phrase_help(
    *,
    topic: str,
    notes: str,
    role_text: str,
    user_help_request_text: str,
    history: list[dict[str, str]],
    source_language: str,
    target_language: str,
) -> tuple[str, str]:
    source_name = language_display_name(source_language)
    target_name = language_display_name(target_language)
    parsed = _call_openai_json_logged(
        label="generate_topic_conversation_target_phrase_help",
        system_prompt=_render_prompt(
            TOPIC_CONVERSATION_TARGET_PHRASE_HELP_PROMPT,
            source_name=source_name,
            target_name=target_name,
        ),
        user_input=(
            f"Source language: {source_name}\n"
            f"Target language: {target_name}\n"
            f"Topic: {topic}\n"
            f"Temporary notes: {notes}\n"
            f"Learner role: {role_text}\n"
            f"Recent conversation:\n{_recent_history_text(history, limit=10)}\n"
            f"Learner request ({source_name}): {user_help_request_text}\n"
        ),
        timeout_seconds=8,
        model=_require_question_model(),
        temperature=0.2,
        top_p=0.95,
        presence_penalty=0.1,
    )
    if not isinstance(parsed, dict):
        raise RuntimeError("Question model request failed")
    target_text = str(parsed.get("target_text", "")).strip()
    help_text = str(parsed.get("help_text", "")).strip()
    if not target_text:
        raise RuntimeError("Question model request failed")
    return target_text[:500], help_text[:600]


def _translate_goal_text_to_english(*, goal_text: str, source_language: str) -> str:
    goal_clean = str(goal_text).strip()
    if not goal_clean:
        return ""
    if source_language == "english":
        return goal_clean

    source_name = language_display_name(source_language)
    parsed = _call_openai_json_logged(
        label="translate_goal_to_english",
        system_prompt=_render_prompt(
            TOPIC_CONVERSATION_GOAL_TRANSLATION_PROMPT,
            source_name=source_name,
        ),
        user_input=(
            f"Input language: {source_name}\n"
            f"Goal text: {goal_clean}\n"
        ),
        timeout_seconds=8,
        model=_require_question_model(),
        temperature=0.0,
        top_p=1.0,
        presence_penalty=0.0,
    )
    if not isinstance(parsed, dict):
        raise RuntimeError("Question model request failed")
    english_text = str(parsed.get("english_text", "")).strip()
    if not english_text:
        raise RuntimeError("Question model request failed")
    return english_text[:600]


def _normalized_goal_candidates(
    parsed: dict | None,
    *,
    goal_label: str,
    done_when_label: str,
) -> list[dict[str, str]]:
    if not isinstance(parsed, dict):
        return []
    raw_candidates = parsed.get("goal_candidates")
    normalized_candidates: list[dict[str, str]] = []
    if not isinstance(raw_candidates, list):
        return normalized_candidates
    for raw_candidate in raw_candidates:
        if not isinstance(raw_candidate, dict):
            continue
        objective_text = str(raw_candidate.get("goal_objective", "")).strip()
        success_condition = str(raw_candidate.get("goal_success_condition", "")).strip()
        if not objective_text or not success_condition:
            continue
        goal_text = f"{goal_label}: {objective_text}. {done_when_label}: {success_condition}."
        normalized_candidates.append({"goal_text": goal_text[:600]})
    return normalized_candidates


def _recent_history_text(history: list[dict[str, str]], *, limit: int) -> str:
    history_lines: list[str] = []
    for row in history:
        if row.get("user_text"):
            history_lines.append(f"Learner: {row['user_text']}")
        if row.get("assistant_text"):
            history_lines.append(f"Partner: {row['assistant_text']}")
    return "\n".join(history_lines[-limit:])


def _render_prompt(template: str, **values: str) -> str:
    rendered = template
    for key, value in values.items():
        rendered = rendered.replace("{" + key + "}", value)
    return rendered


def _require_question_model() -> str:
    question_model = str(getattr(settings, "OPENAI_QUESTION_MODEL", "")).strip()
    if not question_model:
        raise RuntimeError("OPENAI_QUESTION_MODEL is not configured")
    return question_model


def _call_openai_json_logged(
    *,
    label: str,
    system_prompt: str,
    user_input: str,
    timeout_seconds: int = 10,
    model: str | None = None,
    temperature: float = 0.2,
    top_p: float = 1.0,
    presence_penalty: float = 0.0,
) -> dict | None:
    logger.info(
        "content.topic_conversation.model.request label=%s model=%s system_prompt=%s user_input=%s",
        label,
        model or "",
        system_prompt,
        user_input,
    )
    parsed = call_openai_json(
        system_prompt,
        user_input,
        timeout_seconds=timeout_seconds,
        model=model,
        temperature=temperature,
        top_p=top_p,
        presence_penalty=presence_penalty,
    )
    logger.info("content.topic_conversation.model.response label=%s parsed=%s", label, parsed)
    return parsed
