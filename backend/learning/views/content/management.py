from __future__ import annotations

import math
import logging
import random
from uuid import uuid4

from django.conf import settings
from django.utils import timezone
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from ...auth import apply_user_scope, get_request_user
from ...languages import language_display_name
from ...models import DialogTurn, Item, SavedDialog, SavedTopic
from ...serializers import ContentTopicSerializer
from .core import call_openai_json
from .conversation_history import parse_item_conversation_history as _parse_item_conversation_history
from .transcription import openai_transcribe_audio_upload as _openai_transcribe_audio_upload

logger = logging.getLogger(__name__)
SPANISH_ARTICLES = {"el", "la", "los", "las", "un", "una", "unos", "unas"}
GERMAN_ARTICLES = {"der", "die", "das", "den", "dem", "des", "ein", "eine", "einen", "einem", "einer", "eines"}

GOAL_LABELS_BY_LANGUAGE: dict[str, tuple[str, str]] = {
    "spanish": ("Objetivo", "Se cumple cuando"),
    "english": ("Goal", "Done when"),
    "german": ("Ziel", "Erreicht wenn"),
    "french": ("Objectif", "Reussi quand"),
    "italian": ("Obiettivo", "Completato quando"),
    "portuguese": ("Objetivo", "Concluido quando"),
}
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
        "content.management.model.request label=%s model=%s system_prompt=%s user_input=%s",
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
    logger.info("content.management.model.response label=%s parsed=%s", label, parsed)
    return parsed


def _require_question_model() -> str:
    question_model = str(getattr(settings, "OPENAI_QUESTION_MODEL", "")).strip()
    if not question_model:
        raise RuntimeError("OPENAI_QUESTION_MODEL is not configured")
    return question_model


def _normalized_pair(request: Request) -> tuple[str, str]:
    source_language = (request.query_params.get("source_language", "spanish") or "spanish").strip().lower()
    target_language = (request.query_params.get("target_language", "german") or "german").strip().lower()
    return source_language, target_language


def _analyze_user_turn_with_question_model(
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
    source_name = _language_display_name(source_language)
    target_name = _language_display_name(target_language)
    history_lines: list[str] = []
    for row in history:
        if row.get("user_text"):
            history_lines.append(f"Learner: {row['user_text']}")
        if row.get("assistant_text"):
            history_lines.append(f"Partner: {row['assistant_text']}")
    question_model = _require_question_model()
    parsed = _call_openai_json_logged(
        label="analyze_user_turn",
        system_prompt=f"""
Evaluate one learner message in context.

Return strict JSON:
{{
  "is_grammatically_correct": false,
  "makes_sense_in_context": true,
  "needs_correction": true
}}

Rules:
- Evaluate the learner message only in {target_name}.
- is_grammatically_correct=true only if grammar is acceptable for this learning level.
- makes_sense_in_context=true only if the message fits the current conversation context.
- needs_correction=true when either grammar is not correct OR meaning does not fit context.
- Use recent history and context to decide meaning fit.
- JSON only.
""".strip(),
        user_input=(
            f"Source language: {source_name}\n"
            f"Target language: {target_name}\n"
            f"{context_label}"
            f"Recent conversation:\n{chr(10).join(history_lines[-12:])}\n"
            f"Learner message ({target_name}): {user_clean}\n"
        ),
        timeout_seconds=8,
        model=question_model,
        temperature=0.0,
        top_p=1.0,
        presence_penalty=0.0,
    )
    if not isinstance(parsed, dict):
        raise RuntimeError("Question model request failed")
    required_keys = {"is_grammatically_correct", "makes_sense_in_context", "needs_correction"}
    if not required_keys.issubset(parsed.keys()):
        raise RuntimeError("Question model request failed")
    is_grammatically_correct = bool(parsed["is_grammatically_correct"])
    makes_sense_in_context = bool(parsed["makes_sense_in_context"])
    needs_correction = bool(parsed["needs_correction"])
    return {
        "is_grammatically_correct": is_grammatically_correct,
        "makes_sense_in_context": makes_sense_in_context,
        "needs_correction": needs_correction,
    }


def _literal_translate_user_text_with_question_model(
    *,
    user_text: str,
    source_language: str,
    target_language: str,
) -> str:
    user_clean = str(user_text).strip()
    if not user_clean:
        return ""
    source_name = _language_display_name(source_language)
    target_name = _language_display_name(target_language)
    question_model = _require_question_model()
    parsed = _call_openai_json_logged(
        label="literal_translate_user_text",
        system_prompt=f"""
Provide a literal translation of learner text.

Return strict JSON:
{{
  "translation": "string"
}}

Rules:
- Input is in {target_name}; output must be in {source_name}.
- Translate literally and preserve errors/odd wording from the original.
- Do not fix grammar, do not rewrite, do not improve style.
- Keep concise and faithful to original wording.
- JSON only.
""".strip(),
        user_input=(
            f"Source language: {source_name}\n"
            f"Target language: {target_name}\n"
            f"Learner text ({target_name}): {user_clean}\n"
        ),
        timeout_seconds=8,
        model=question_model,
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


def _generate_user_correction_with_question_model(
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
    source_name = _language_display_name(source_language)
    target_name = _language_display_name(target_language)
    history_lines: list[str] = []
    for row in history:
        if row.get("user_text"):
            history_lines.append(f"Learner: {row['user_text']}")
        if row.get("assistant_text"):
            history_lines.append(f"Partner: {row['assistant_text']}")
    question_model = _require_question_model()
    parsed = _call_openai_json_logged(
        label="generate_user_correction",
        system_prompt=f"""
Correct one learner message and explain the correction.

Return strict JSON:
{{
  "corrected_user_text": "string",
  "corrected_user_source_translation": "string",
  "corrected_user_explanation": "string"
}}

Rules:
- learner message is in {target_name}.
- corrected_user_text must be the corrected version in {target_name}.
- corrected_user_source_translation must be a natural translation in {source_name}.
- corrected_user_explanation must be in {source_name} only.
- Keep corrected_user_explanation very short and practical:
  1) one brief reason,
  2) one final tip.
- JSON only.
""".strip(),
        user_input=(
            f"Source language: {source_name}\n"
            f"Target language: {target_name}\n"
            f"{context_label}"
            f"Recent conversation:\n{chr(10).join(history_lines[-12:])}\n"
            f"Learner message ({target_name}): {user_clean}\n"
        ),
        timeout_seconds=8,
        model=question_model,
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


def _generate_item_conversation_reply(
    *,
    item: Item,
    user_text: str,
    history: list[dict[str, str]],
    source_language: str,
    target_language: str,
) -> dict[str, str]:
    source_name = _language_display_name(source_language)
    target_name = _language_display_name(target_language)
    history_lines: list[str] = []
    for row in history:
        if row.get("user_text"):
            history_lines.append(f"Learner: {row['user_text']}")
        if row.get("assistant_text"):
            history_lines.append(f"Tutor: {row['assistant_text']}")

    parsed = _call_openai_json_logged(
        label="generate_item_conversation_reply",
        system_prompt=f"""
You are a conversation partner. Continue a short voice conversation focused on one study item.

Return strict JSON:
{{
  "reply_text": "string",
  "source_translation": "string"
}}

Rules:
- Write reply_text in {target_name} only.
- Write source_translation in {source_name} only.
- Keep a natural peer-to-peer tone, like regular conversation with another person.
- Do not act like a teacher, tutor, or evaluator.
- Keep it concise: 1 to 3 short sentences.
- Keep source_translation concise and natural, aligned to reply_text meaning.
- Keep the conversation centered on this specific item and its usage.
- End with one simple follow-up question to keep the conversation going.
- JSON only.
""".strip(),
        user_input=(
            f"Source language: {source_name}\n"
            f"Target language: {target_name}\n"
            f"Item source text: {item.spanish_text}\n"
            f"Item target text: {item.german_text}\n"
            f"Item notes: {item.notes}\n"
            f"Recent conversation:\n{chr(10).join(history_lines[-12:])}\n"
            f"Learner new message: {user_text}\n"
        ),
        timeout_seconds=10,
        temperature=0.4,
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


def _generate_topic_conversation_start(
    *,
    topic: str,
    notes: str,
    role_text: str,
    goal_difficulty: str,
    source_language: str,
    target_language: str,
) -> dict[str, str]:
    source_name = _language_display_name(source_language)
    target_name = _language_display_name(target_language)
    variation_seed = uuid4().hex[:8]
    rng = random.SystemRandom()
    goal_label, done_when_label = GOAL_LABELS_BY_LANGUAGE.get(source_language, ("Goal", "Done when"))

    for attempt in range(3):
        parsed = _call_openai_json_logged(
            label="generate_topic_conversation_start",
            system_prompt=f"""
Create a conversation setup for a language learner.

Return strict JSON:
{{
  "goal_candidates": [
    {{
      "goal_objective": "string",
      "goal_success_condition": "string"
    }}
  ]
}}

Rules:
- Return exactly 4 candidates in goal_candidates.
- goal_objective must be in {source_name} and describe what the learner must actively achieve in this conversation.
- goal_success_condition must be in {source_name} and define a specific verifiable done/not-done outcome.
- Include one concrete target detail (for example a number, exact item, exact decision, or exact piece of information).
- Keep variation style different each run using variation_seed.
- This is for a learner practicing a new language in conversation.
- Keep it achievable in one short conversation.
- Avoid generic goals like "have a conversation about X" or plain topic phrases.
- Adapt challenge level to goal_difficulty:
  - easy: very simple, one clear concrete detail, minimal cognitive load.
  - medium: balanced challenge with one clear concrete detail and mild constraint.
  - hard: more demanding but still achievable in one short conversation, with a tighter or multi-part concrete condition.
- Keep goal_objective and goal_success_condition concise, one short line each.
- Match the topic and notes context.
- If learner role is provided, tailor the goal to that role.
- The learner will always start the conversation. Do not create an opening line for the partner.
- Do not use teacher or tutor voice.
- Make the 4 candidates meaningfully different from each other.
- JSON only.
""".strip(),
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
        if not isinstance(parsed, dict):
            continue
        raw_candidates = parsed.get("goal_candidates")
        normalized_candidates: list[dict[str, str]] = []
        if isinstance(raw_candidates, list):
            for raw_candidate in raw_candidates:
                if not isinstance(raw_candidate, dict):
                    continue
                objective_text = str(raw_candidate.get("goal_objective", "")).strip()
                success_condition = str(raw_candidate.get("goal_success_condition", "")).strip()
                if not objective_text or not success_condition:
                    continue
                goal_text = f"{goal_label}: {objective_text}. {done_when_label}: {success_condition}."
                normalized_candidates.append(
                    {
                        "goal_text": goal_text[:600],
                    }
                )

        if not normalized_candidates:
            continue

        rng.shuffle(normalized_candidates)
        candidate = normalized_candidates[0]
        return {
            "goal_text": candidate["goal_text"],
            "opening_text": "",
            "opening_translation_text": "",
            "goal_difficulty": goal_difficulty,
        }
    raise RuntimeError("Question model request failed")


def _generate_mistake_explanation_with_question_model(
    *,
    source_language: str,
    target_language: str,
    learner_text: str,
    corrected_text: str,
    corrected_source_translation: str,
    context_label: str,
) -> str:
    corrected_clean = str(corrected_text).strip()
    learner_clean = str(learner_text).strip()
    if not corrected_clean:
        return ""
    source_name = _language_display_name(source_language)
    target_name = _language_display_name(target_language)

    question_model = _require_question_model()
    parsed = _call_openai_json_logged(
        label="generate_mistake_explanation",
        system_prompt=f"""
Write a short mistake explanation for a corrected learner sentence.

Return strict JSON:
{{
  "explanation": "string"
}}

Rules:
- explanation must be in {source_name} only.
- Keep it concise: max 2 short lines, max 220 chars total.
- Do not repeat or quote the original/corrected {target_name} text.
- Include:
  1) one brief reason for the correction,
  2) one final tip/rule of thumb.
- The explanation must be about the learner's {target_name} message.
- Focus on {target_name} usage only.
- Always return a non-empty explanation when corrected text is provided.
- If uncertain about grammar details, still provide a brief generic rule in {source_name}.
- JSON only.
""".strip(),
        user_input=(
            f"Source language: {source_name}\n"
            f"Target language: {target_name}\n"
            f"{context_label}"
            f"Learner original text ({target_name}): {learner_clean}\n"
            f"Corrected text ({target_name}): {corrected_clean}\n"
            f"Corrected translation ({source_name}): {corrected_source_translation}\n"
            f"Output format guidance: <brief reason in {source_name}>; <final tip in {source_name}>\n"
        ),
        timeout_seconds=8,
        model=question_model,
        temperature=0.0,
        top_p=1.0,
        presence_penalty=0.0,
    )
    if not isinstance(parsed, dict):
        raise RuntimeError("Question model request failed")

    explanation_candidate = str(parsed.get("explanation", "")).strip()
    if not explanation_candidate:
        raise RuntimeError("Question model request failed")

    return explanation_candidate[:1200]


def _translate_goal_text_to_english_with_question_model(*, goal_text: str, source_language: str) -> str:
    goal_clean = str(goal_text).strip()
    if not goal_clean:
        return ""
    if source_language == "english":
        return goal_clean

    source_name = _language_display_name(source_language)
    question_model = _require_question_model()
    parsed = _call_openai_json_logged(
        label="translate_goal_to_english",
        system_prompt=f"""
Translate goal text to English.

Return strict JSON:
{{
  "english_text": "string"
}}

Rules:
- Input language is {source_name}.
- Output must be English only.
- Keep exact intent and concrete condition(s).
- Keep concise, one line.
- JSON only.
""".strip(),
        user_input=(
            f"Input language: {source_name}\n"
            f"Goal text: {goal_clean}\n"
        ),
        timeout_seconds=8,
        model=question_model,
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


def _generate_next_goal_suggestion_with_question_model(
    *,
    topic: str,
    notes: str,
    role_text: str,
    current_goal_text: str,
    latest_user_text: str,
    source_language: str,
    target_language: str,
) -> str:
    source_name = _language_display_name(source_language)
    target_name = _language_display_name(target_language)
    question_model = _require_question_model()
    parsed = _call_openai_json_logged(
        label="generate_next_goal_suggestion",
        system_prompt=f"""
Generate one next conversation goal for continued practice.

Return strict JSON:
{{
  "next_goal_suggestion": "string"
}}

Rules:
- Write next_goal_suggestion in {source_name}.
- Keep one concise line with one concrete, verifiable condition.
- It must be meaningfully different from current_goal_text (different target detail and action).
- Keep same conversation context (topic/role), but increase or shift challenge.
- Avoid repeating wording from current_goal_text.
- JSON only.
""".strip(),
        user_input=(
            f"Source language: {source_name}\n"
            f"Target language: {target_name}\n"
            f"Topic: {topic}\n"
            f"Temporary notes: {notes}\n"
            f"Learner role: {role_text}\n"
            f"Current goal text: {current_goal_text}\n"
            f"Latest learner message: {latest_user_text}\n"
        ),
        timeout_seconds=8,
        model=question_model,
        temperature=0.3,
        top_p=0.9,
        presence_penalty=0.4,
    )
    if not isinstance(parsed, dict):
        raise RuntimeError("Question model request failed")
    suggestion = str(parsed.get("next_goal_suggestion", "")).strip()
    if not suggestion:
        raise RuntimeError("Question model request failed")
    return suggestion[:600]


def _evaluate_goal_achievement_with_question_model(
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
    goal_clean_english = _translate_goal_text_to_english_with_question_model(
        goal_text=goal_clean,
        source_language=source_language,
    )

    history_lines: list[str] = []
    for row in history:
        if row.get("user_text"):
            history_lines.append(f"Learner: {row['user_text']}")
        if row.get("assistant_text"):
            history_lines.append(f"Partner: {row['assistant_text']}")

    source_name = _language_display_name(source_language)
    target_name = _language_display_name(target_language)
    question_model = _require_question_model()
    parsed = _call_openai_json_logged(
        label="evaluate_goal_achievement",
        system_prompt=f"""
Evaluate if the learner has already achieved a conversation goal.

Return strict JSON:
{{
  "goal_achieved": false,
  "goal_achievement_message": "string",
  "next_goal_suggestion": "string"
}}

Rules:
- Assess strictly against the explicit condition(s) in goal_text_english.
- Use full history plus latest learner message.
- If condition is clearly met, set goal_achieved=true and write one short congratulatory message in {source_name}.
- If condition is clearly met, also provide next_goal_suggestion in {source_name}: one concise concrete follow-up goal for continuing this same conversation.
- If not clearly met yet, set goal_achieved=false and goal_achievement_message="".
- If not clearly met yet, set next_goal_suggestion="".
- Do not infer success without evidence in learner messages.
- JSON only.
""".strip(),
        user_input=(
            f"Source language: {source_name}\n"
            f"Target language: {target_name}\n"
            f"Topic: {topic}\n"
            f"Temporary notes: {notes}\n"
            f"Learner role: {role_text}\n"
            f"Goal text (English): {goal_clean_english}\n"
            f"Recent conversation:\n{chr(10).join(history_lines[-14:])}\n"
            f"Latest learner message: {latest_user_text}\n"
        ),
        timeout_seconds=8,
        model=question_model,
        temperature=0.0,
        top_p=1.0,
        presence_penalty=0.0,
    )
    if not isinstance(parsed, dict):
        raise RuntimeError("Question model request failed")

    if "goal_achieved" not in parsed:
        raise RuntimeError("Question model request failed")
    achieved = bool(parsed["goal_achieved"])
    message = str(parsed.get("goal_achievement_message", "")).strip()
    next_goal_suggestion = str(parsed.get("next_goal_suggestion", "")).strip()
    if achieved and (not message or not next_goal_suggestion):
        raise RuntimeError("Question model request failed")
    if not achieved:
        return False, "", ""
    return True, message[:600], next_goal_suggestion[:600]


def _generate_topic_conversation_reply(
    *,
    topic: str,
    notes: str,
    role_text: str,
    user_text: str,
    history: list[dict[str, str]],
    source_language: str,
    target_language: str,
) -> dict[str, str]:
    source_name = _language_display_name(source_language)
    target_name = _language_display_name(target_language)
    history_lines: list[str] = []
    for row in history:
        if row.get("user_text"):
            history_lines.append(f"Learner: {row['user_text']}")
        if row.get("assistant_text"):
            history_lines.append(f"Partner: {row['assistant_text']}")

    parsed = _call_openai_json_logged(
        label="generate_topic_conversation_reply",
        system_prompt=f"""
You are a conversation partner in a live speaking practice.

Return strict JSON:
{{
  "reply_text": "string",
  "source_translation": "string"
}}

Rules:
- Write reply_text in {target_name} only.
- Write source_translation in {source_name} only.
- Keep natural peer-to-peer tone, like a regular conversation.
- Do not act like teacher/tutor.
- Keep reply concise: 1-3 short sentences.
- Keep it aligned with topic and notes.
- Keep the interaction consistent with learner role when provided.
- You are always the conversation partner, never the learner role.
- If learner role is "customer", reply as staff/seller/service person.
- End with one simple follow-up question.
- JSON only.
""".strip(),
        user_input=(
            f"Source language: {source_name}\n"
            f"Target language: {target_name}\n"
            f"Conversation topic: {topic}\n"
            f"Temporary notes: {notes}\n"
            f"Learner role: {role_text}\n"
            f"Recent conversation:\n{chr(10).join(history_lines[-12:])}\n"
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


def _generate_conversation_help_with_question_model(
    *,
    topic: str,
    notes: str,
    role_text: str,
    user_help_request_text: str,
    history: list[dict[str, str]],
    source_language: str,
    target_language: str,
) -> str:
    source_name = _language_display_name(source_language)
    target_name = _language_display_name(target_language)
    question_model = _require_question_model()

    history_lines: list[str] = []
    for row in history:
        if row.get("user_text"):
            history_lines.append(f"Learner: {row['user_text']}")
        if row.get("assistant_text"):
            history_lines.append(f"Partner: {row['assistant_text']}")

    parsed = _call_openai_json_logged(
        label="generate_topic_conversation_help",
        system_prompt=f"""
You are a communication coach helping a language learner during a live conversation.

Return strict JSON:
{{
  "help_text": "string"
}}

Rules:
- Write help_text in {source_name} only.
- Do not answer in {target_name}.
- Treat the learner request as communication help about {target_name}.
- Even when the request is phrased in {source_name}, keep the explanation topic focused on {target_name} usage.
- Give actionable coaching for what the learner can try to communicate next.
- Keep it very concise: 1 to 3 short lines total.
- Prefer compact phrasing over full explanations.
- Avoid introductions, hedging, and repetition.
- Focus on helping with meaning and communication strategy in the ongoing conversation context.
- Do not switch to general source-language lessons.
- Do not treat this as a regular conversation turn.
- JSON only.
""".strip(),
        user_input=(
            f"Source language: {source_name}\n"
            f"Target language: {target_name}\n"
            f"Topic: {topic}\n"
            f"Temporary notes: {notes}\n"
            f"Learner role: {role_text}\n"
            f"Recent conversation:\n{chr(10).join(history_lines[-10:])}\n"
            f"Learner help request ({source_name}): {user_help_request_text}\n"
        ),
        timeout_seconds=8,
        model=question_model,
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


def _generate_target_phrase_help_with_question_model(
    *,
    topic: str,
    notes: str,
    role_text: str,
    user_help_request_text: str,
    history: list[dict[str, str]],
    source_language: str,
    target_language: str,
) -> tuple[str, str]:
    source_name = _language_display_name(source_language)
    target_name = _language_display_name(target_language)
    question_model = _require_question_model()

    history_lines: list[str] = []
    for row in history:
        if row.get("user_text"):
            history_lines.append(f"Learner: {row['user_text']}")
        if row.get("assistant_text"):
            history_lines.append(f"Partner: {row['assistant_text']}")

    parsed = _call_openai_json_logged(
        label="generate_topic_conversation_target_phrase_help",
        system_prompt=f"""
You help a language learner quickly say a word or phrase in a live conversation.

Return strict JSON:
{{
  "target_text": "string",
  "help_text": "string"
}}

Rules:
- Write target_text in {target_name} only.
- target_text must match the learner intent as a natural short expression for this context.
- Keep target_text concise: usually 1 phrase or 1 short sentence.
- Write help_text in {source_name} only.
- Keep help_text very short (max 1 line), optional usage nuance if needed.
- Prefer practical, common wording over creative or rare wording.
- Do not add markdown, numbering, or quotes.
- JSON only.
""".strip(),
        user_input=(
            f"Source language: {source_name}\n"
            f"Target language: {target_name}\n"
            f"Topic: {topic}\n"
            f"Temporary notes: {notes}\n"
            f"Learner role: {role_text}\n"
            f"Recent conversation:\n{chr(10).join(history_lines[-10:])}\n"
            f"Learner request ({source_name}): {user_help_request_text}\n"
        ),
        timeout_seconds=8,
        model=question_model,
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


def _next_review_days(item: Item, now) -> int | None:
    due_values = [value for value in [item.due_at_es_to_de, item.due_at_de_to_es] if value is not None]
    if not due_values:
        return None
    due_at = min(due_values)
    delta_days = (due_at - now).total_seconds() / 86400.0
    return max(0, int(math.ceil(delta_days)))


_language_display_name = language_display_name


from .management_items import (
    ContentItemDetailView,
    ContentItemMarkLearnedView,
    ContentItemQuestionView,
    ContentItemRefreshWordView,
    ContentItemsView,
    ContentPhraseQuickAddView,
    ContentWordQuickAddView,
    ContentWordsView,
)
from .management_topic_admin import ContentTopicDeleteView
from .management_topic_conversation import (
    ContentTopicConversationHelpView,
    ContentTopicConversationStartView,
    ContentTopicConversationTurnView,
    ContentTopicConversationUserCorrectionView,
    ContentTopicConversationUserTranslationView,
)
