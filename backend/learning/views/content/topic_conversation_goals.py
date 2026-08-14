from __future__ import annotations

import logging
import random
import time
from uuid import uuid4

from ...languages import language_display_name
from ...prompts import (
    TOPIC_CONVERSATION_GOAL_EVALUATION_PROMPT,
    TOPIC_CONVERSATION_GOAL_TRANSLATION_PROMPT,
    TOPIC_CONVERSATION_START_PROMPT,
)
from .topic_conversation_model_support import (
    call_openai_json_logged,
    recent_history_text,
    render_prompt,
    require_question_model,
)

logger = logging.getLogger(__name__)

GOAL_LABELS_BY_LANGUAGE: dict[str, tuple[str, str]] = {
    "spanish": ("Objetivo", "Se cumple cuando"),
    "english": ("Goal", "Done when"),
    "german": ("Ziel", "Erreicht wenn"),
    "french": ("Objectif", "Reussi quand"),
    "italian": ("Obiettivo", "Completato quando"),
    "portuguese": ("Objetivo", "Concluido quando"),
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
        parsed = call_openai_json_logged(
            label="generate_topic_conversation_start",
            system_prompt=render_prompt(TOPIC_CONVERSATION_START_PROMPT, source_name=source_name),
            user_input=(
                f"Source language: {source_name}\nTarget language: {target_name}\n"
                f"Variation seed for this run: {variation_seed}-{attempt}\nTopic: {topic}\n"
                f"Temporary notes: {notes}\nLearner role: {role_text}\n"
                f"goal_difficulty: {goal_difficulty}\n"
            ),
            timeout_seconds=10,
            temperature=0.95,
            top_p=1.0,
            presence_penalty=0.6,
        )
        candidates = _normalized_goal_candidates(parsed, goal_label=goal_label, done_when_label=done_when_label)
        logger.info(
            "content.topic_conversation.start_goal_attempt attempt=%s elapsed_ms=%s candidates=%s",
            attempt + 1,
            int((time.perf_counter() - attempt_started_at) * 1000),
            len(candidates),
        )
        if not candidates:
            continue
        rng.shuffle(candidates)
        candidate = candidates[0]
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
    source_name = language_display_name(source_language)
    target_name = language_display_name(target_language)
    goal_text_english = _translate_goal_text_to_english(
        goal_text=goal_clean,
        source_language=source_language,
    )
    parsed = call_openai_json_logged(
        label="evaluate_goal_achievement",
        system_prompt=render_prompt(TOPIC_CONVERSATION_GOAL_EVALUATION_PROMPT, source_name=source_name),
        user_input=(
            f"Source language: {source_name}\nTarget language: {target_name}\nTopic: {topic}\n"
            f"Temporary notes: {notes}\nLearner role: {role_text}\n"
            f"Goal text (English): {goal_text_english}\n"
            f"Recent conversation:\n{recent_history_text(history, limit=14)}\n"
            f"Latest learner message: {latest_user_text}\n"
        ),
        timeout_seconds=8,
        model=require_question_model(),
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
    return (True, message[:600], next_goal_suggestion[:600]) if achieved else (False, "", "")


def _translate_goal_text_to_english(*, goal_text: str, source_language: str) -> str:
    if source_language == "english":
        return goal_text
    source_name = language_display_name(source_language)
    parsed = call_openai_json_logged(
        label="translate_goal_to_english",
        system_prompt=render_prompt(TOPIC_CONVERSATION_GOAL_TRANSLATION_PROMPT, source_name=source_name),
        user_input=f"Input language: {source_name}\nGoal text: {goal_text}\n",
        timeout_seconds=8,
        model=require_question_model(),
        temperature=0.0,
        top_p=1.0,
        presence_penalty=0.0,
    )
    english_text = str(parsed.get("english_text", "")).strip() if isinstance(parsed, dict) else ""
    if not english_text:
        raise RuntimeError("Question model request failed")
    return english_text[:600]


def _normalized_goal_candidates(
    parsed: dict | list | None,
    *,
    goal_label: str,
    done_when_label: str,
) -> list[dict[str, str]]:
    raw_candidates = parsed.get("goal_candidates") if isinstance(parsed, dict) else None
    if not isinstance(raw_candidates, list):
        return []
    candidates: list[dict[str, str]] = []
    for raw_candidate in raw_candidates:
        if not isinstance(raw_candidate, dict):
            continue
        objective = str(raw_candidate.get("goal_objective", "")).strip()
        success = str(raw_candidate.get("goal_success_condition", "")).strip()
        if objective and success:
            candidates.append({"goal_text": f"{goal_label}: {objective}. {done_when_label}: {success}."[:600]})
    return candidates
