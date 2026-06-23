from __future__ import annotations

import math
import logging
import random
import re
from uuid import uuid4

from django.conf import settings
from django.db.models import Q
from django.utils import timezone
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from ...auth import apply_user_scope, get_request_user
from ...models import DialogTurn, Item, ItemDialogOccurrence, ItemQuestionExchange, SavedDialog, SavedTopic
from ...serializers import ContentTopicSerializer
from .core import (
    ContentCandidate,
    call_openai_json,
    create_audio_file,
    create_phrase_if_missing,
    create_word_if_missing,
    item_exists,
    normalize_word_pair_for_item_save,
    normalize_word_type,
)
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


def _resolve_dialog_click_word_pair(
    *,
    user,
    source_text: str,
    target_text: str,
    source_language: str,
    target_language: str,
    dialog_id_raw,
    turn_index_raw,
    source_line: str = "",
    target_line: str = "",
    clicked_target_token: str = "",
) -> tuple[str, str, str, str]:
    target_context = ""
    try:
        dialog_id = int(dialog_id_raw)
        turn_index = int(turn_index_raw)
    except (TypeError, ValueError):
        dialog_id = None
        turn_index = None
    if dialog_id is not None and turn_index is not None:
        dialog = apply_user_scope(SavedDialog.objects, user).filter(
            id=dialog_id,
            source_language=source_language,
            target_language=target_language,
        ).first()
        turn = DialogTurn.objects.filter(dialog_id=dialog_id, turn_index=turn_index).first()
        if not dialog or not turn:
            raise RuntimeError("Dialog word resolution missing dialog turn")
        target_context = str(turn.target_text or "").strip()
    if not target_context:
        target_context = target_line.strip()
    clicked_word = (clicked_target_token or target_text).strip()
    if not clicked_word or not target_context:
        raise RuntimeError("Dialog word resolution missing target context")
    parsed = _call_openai_json_logged(
        label="resolve_dialog_click_word_metadata",
        system_prompt="""
Resolve a clicked target-language word translation and word type in context.

Return strict JSON:
{
  "source_text": "string",
  "target_text": "string",
  "word_type": "noun|verb|adjective|adverb|helper|expression|other",
  "note": "string"
}

Rules:
- Use only the clicked target word and the target-language line context to identify the selected word's meaning and word_type.
- First decide whether translating the clicked word alone would be misleading in THIS context.
- Expand beyond the clicked word only when the clicked word's standalone translation would be wrong or misleading.
- If expansion is necessary because the meaning comes from a fixed expression, separable verb, idiom, collocation, grammatical construction, or multi-word unit, return the smallest reusable expression that carries the meaning.
- The expression must be reusable as a study item. Prefer dictionary-style placeholders like "etwas" or "jemanden" over copying concrete sentence words.
- Never return the full sentence unless the full sentence itself is a fixed expression.
- Do not expand just to include articles, possessives, adjectives, objects, or nearby context when the clicked word has a clear standalone meaning.
- For a clicked noun with a clear standalone meaning, return the noun itself here. Do not return a noun phrase like "sein Freund" unless the entire phrase has a non-literal expression meaning.
- Never guess a standalone translation if it would be misleading. Prefer returning a larger expression only when necessary.
- For expressions, target_text must be the target-language expression, source_text must be the translation of that expression, word_type must be "expression", and note must briefly explain why the clicked word alone is insufficient.
- For helper words, keep target_text as the helper word itself, but source_text may be either a single word or a short natural phrase if that is the only faithful translation in context.
- For helper words, note must briefly explain the helper role or why the translation is contextual.
- If the clicked word works as a standalone study item in THIS context, return that standalone unit and use an empty note, except for helper words which should still include the brief helper explanation note.
- Classify modal verbs, auxiliary verbs, and grammar-building forms as "helper" only when they are used that way in this target line.
- For modal, auxiliary, conditional, future, or tense-building helper words, return only the helper word translation unit.
- Use context to disambiguate meaning. For helper words, a short source-language phrase is allowed when needed, but target_text must stay the helper word itself.
- Do not normalize inflection, case, number, or article here unless it is already required to identify the clicked word's contextual meaning.
- Do not decompose compound or derived words into a smaller root when that changes the meaning.
- Example: clicked "großartig" means "excelente/estupendo"; do not return "groß" or "grande".
- Do not return a full sentence or clause.
- Example: in "Was hältst du von der neuen Serie?", clicked "hältst" should become target_text "von etwas halten", source_text like "opinar sobre algo", word_type "expression", because "halten" alone would be misleading.
- Example: in "Ich halte das Buch in der Hand.", clicked "halte" can become target_text "halten", source_text like "sostener", word_type "verb", because it is a normal standalone verb meaning.
- Example: in "Mir gefällt mehr sein Freund.", clicked "Freund" should become target_text "Freund", source_text like "amigo", word_type "noun", not "sein Freund".
- JSON only.
""".strip(),
        user_input=(
            f"Source language: {_language_display_name(source_language)}\n"
            f"Target language: {_language_display_name(target_language)}\n"
            f"Clicked target word: {clicked_word}\n"
            f"Target-language line context: {target_context}\n"
        ),
        timeout_seconds=6,
        temperature=0.0,
        top_p=1.0,
        presence_penalty=0.0,
    )
    if not isinstance(parsed, dict):
        raise RuntimeError("Dialog word resolution failed")
    resolved_source = str(parsed.get("source_text", "")).strip()
    resolved_target = str(parsed.get("target_text", "")).strip()
    word_type = normalize_word_type(str(parsed.get("word_type", "")))
    note = str(parsed.get("note", "")).strip()
    if not resolved_source or not resolved_target or not word_type:
        raise RuntimeError("Dialog word resolution returned incomplete data")
    if word_type in {"helper", "expression"}:
        resolved_source, resolved_target, note = _refine_special_click_resolution(
            clicked_word=clicked_word,
            source_context=source_line.strip(),
            target_context=target_context,
            source_language=source_language,
            target_language=target_language,
            source_text=resolved_source,
            target_text=resolved_target,
            word_type=word_type,
            note=note,
        )
    return resolved_source, resolved_target, word_type, note


def _line_tokens(value: str) -> list[str]:
    return [match.group(0) for match in re.finditer(r"[^\W\d_]+(?:[-'][^\W\d_]+)*", value, flags=re.UNICODE)]


def _normalize_word_token(value: str) -> str:
    return _clean_edge_punctuation(value).lower()


def _clean_edge_punctuation(value: str) -> str:
    return re.sub(r"^[^\wÀ-ÖØ-öø-ÿ]+|[^\wÀ-ÖØ-öø-ÿ]+$", "", value or "", flags=re.UNICODE).strip()


def _refine_special_click_resolution(
    *,
    clicked_word: str,
    source_context: str,
    target_context: str,
    source_language: str,
    target_language: str,
    source_text: str,
    target_text: str,
    word_type: str,
    note: str,
) -> tuple[str, str, str]:
    parsed = _call_openai_json_logged(
        label=f"refine_{word_type}_click_resolution",
        system_prompt=f"""
Refine a clicked target-language {word_type} study item using full line context.

Return strict JSON:
{{
  "source_text": "string",
  "target_text": "string",
  "note": "string"
}}

Rules:
- Do not change the item type. It is already confirmed to be "{word_type}".
- Use the clicked word plus the full source and target line context to refine the best study unit.
- Keep the result minimal but meaningful in both languages.
- Never return the full sentence unless the full sentence itself is the smallest reusable unit.
- Do not add meaning from unselected surrounding words unless that meaning is required to make the unit understandable.
- source_text and target_text must stay aligned in meaning.

Expression-specific rules:
- target_text must be the smallest reusable target-language expression that carries the meaning in context.
- Prefer a multi-word expression when the clicked word alone would be misleading.
- Do not collapse an expression to a single word if the meaning in context depends on a larger group.
- source_text must be the smallest natural source-language translation of that same expression, not the whole sentence.
- note must briefly explain why the clicked word alone is insufficient.

Helper-specific rules:
- target_text must stay the helper word or normalized helper form itself, not the whole verb phrase or sentence.
- source_text may be a single word or a short natural phrase, whichever is the most faithful translation in context.
- If a one-word translation would be misleading, use a short phrase instead.
- note must briefly explain the helper role in context.

- Return JSON only.
""".strip(),
        user_input=(
            f"Source language: {_language_display_name(source_language)}\n"
            f"Target language: {_language_display_name(target_language)}\n"
            f"Clicked target word: {clicked_word}\n"
            f"Current source_text: {source_text}\n"
            f"Current target_text: {target_text}\n"
            f"Current note: {note or '(empty)'}\n"
            f"Source-language line context: {source_context or 'not provided'}\n"
            f"Target-language line context: {target_context}\n"
        ),
        timeout_seconds=6,
        temperature=0.0,
        top_p=1.0,
        presence_penalty=0.0,
    )
    if not isinstance(parsed, dict):
        return source_text, target_text, note
    refined_source = str(parsed.get("source_text", "")).strip() or source_text
    refined_target = str(parsed.get("target_text", "")).strip() or target_text
    refined_note = str(parsed.get("note", "")).strip() or note
    if word_type == "expression" and len(refined_target.split()) == 1 and len(target_context.split()) > 1:
        return source_text, target_text, note
    return refined_source, refined_target, refined_note


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


def _link_word_to_dialog_turn(*, user, item: Item, dialog_id_raw, turn_index_raw) -> None:
    try:
        dialog_id = int(dialog_id_raw)
        turn_index = int(turn_index_raw)
    except (TypeError, ValueError):
        return

    dialog = apply_user_scope(SavedDialog.objects, user).filter(id=dialog_id).first()
    if not dialog:
        return
    turn = DialogTurn.objects.filter(dialog_id=dialog_id, turn_index=turn_index).first()
    if not turn:
        return

    ItemDialogOccurrence.objects.get_or_create(
        item=item,
        dialog=dialog,
        turn=turn,
        turn_index=turn_index,
        side=ItemDialogOccurrence.Side.TARGET,
        defaults={"match_score": 1.0},
    )


def _link_phrase_to_dialog_turn(*, user, item: Item, dialog_id_raw, turn_index_raw) -> None:
    try:
        dialog_id = int(dialog_id_raw)
        turn_index = int(turn_index_raw)
    except (TypeError, ValueError):
        return

    dialog = apply_user_scope(SavedDialog.objects, user).filter(id=dialog_id).first()
    if not dialog:
        return
    turn = DialogTurn.objects.filter(dialog_id=dialog_id, turn_index=turn_index).first()
    if not turn:
        return

    ItemDialogOccurrence.objects.get_or_create(
        item=item,
        dialog=dialog,
        turn=turn,
        turn_index=turn_index,
        side=ItemDialogOccurrence.Side.TARGET,
        defaults={"match_score": 1.0},
    )


def _ensure_audio_for_dialog_turn(*, user, dialog_id_raw, turn_index_raw) -> str:
    try:
        dialog_id = int(dialog_id_raw)
        turn_index = int(turn_index_raw)
    except (TypeError, ValueError):
        return ""

    dialog = apply_user_scope(SavedDialog.objects, user).filter(id=dialog_id).first()
    if not dialog:
        return ""
    turn = DialogTurn.objects.filter(dialog_id=dialog_id, turn_index=turn_index).first()
    if not turn:
        return ""

    target_text = str(turn.target_text or "").strip()
    if not target_text:
        return ""
    if turn.audio_url:
        return turn.audio_url

    audio_url = create_audio_file(target_text, "phrase", target_language=dialog.target_language)
    if not audio_url:
        return ""
    turn.audio_url = audio_url
    turn.save(update_fields=["audio_url"])
    return audio_url


def _basic_word_metadata(
    *,
    source_text: str,
    target_text: str,
    source_language: str,
    target_language: str,
    source_line: str = "",
    target_line: str = "",
) -> tuple[str, str, str]:
    source_name = _language_display_name(source_language)
    target_name = _language_display_name(target_language)
    target_context = target_line.strip()
    clicked_word = target_text.strip()
    if not clicked_word:
        raise RuntimeError("Word metadata generation returned incomplete data")
    parsed = _call_openai_json_logged(
        label="contextual_word_metadata",
        system_prompt=f"""
Given a clicked target-language word and target-language context, return the clicked word's contextual translation and word type.

Return strict JSON:
{{
  "source_text": "string",
  "target_text": "string",
  "word_type": "noun|verb|adjective|adverb|helper|expression|other"
}}

Rules:
- Use only the clicked target word and target-language context to identify the clicked word's actual meaning and word_type.
- First decide whether translating the clicked word alone would be misleading in THIS context.
- Expand beyond the clicked word only when the clicked word's standalone translation would be wrong or misleading.
- If expansion is necessary because the meaning comes from a fixed expression, separable verb, idiom, collocation, grammatical construction, or multi-word unit, return the smallest reusable expression that carries the meaning.
- The expression must be reusable as a study item. Prefer dictionary-style placeholders like "etwas" or "jemanden" over copying concrete sentence words.
- Never return the full sentence unless the full sentence itself is a fixed expression.
- Do not expand just to include articles, possessives, adjectives, objects, or nearby context when the clicked word has a clear standalone meaning.
- For a clicked noun with a clear standalone meaning, return the noun itself here. Do not return a noun phrase like "sein Freund" unless the entire phrase has a non-literal expression meaning.
- Never guess a standalone translation if it would be misleading. Prefer returning a larger expression only when necessary.
- For expressions, target_text must be the target-language expression, source_text must be the translation of that expression, and word_type must be "expression".
- If the clicked word works as a standalone study item in THIS context, return that standalone unit.
- Do not normalize inflection, case, number, or article in this step.
- Do not decompose compound or derived words into a smaller root when that changes the meaning.
- Example: clicked "großartig" means "excelente/estupendo"; do not return "groß" or "grande".
- Use type "helper" for modal verbs, auxiliary verbs, and grammar-helper forms only when the phrase uses them that way.
- If a word can be both a normal verb and a helper, use the phrase context to choose one type.
- Use type "expression" only for multi-word expressions or meanings that cannot be understood word-by-word.
- Do not return a whole sentence or clause.
- Example: in "Was hältst du von der neuen Serie?", clicked "hältst" should become target_text "von etwas halten", source_text like "opinar sobre algo", word_type "expression".
- Example: in "Ich halte das Buch in der Hand.", clicked "halte" can become target_text "halten", source_text like "sostener", word_type "verb".
- Example: in "Mir gefällt mehr sein Freund.", clicked "Freund" should become target_text "Freund", source_text like "amigo", word_type "noun", not "sein Freund".
- JSON only.
""".strip(),
        user_input=(
            f"Source language: {source_name}\n"
            f"Target language: {target_name}\n"
            f"Clicked target word: {clicked_word}\n"
            f"Target-language line context: {target_context}\n"
        ),
        timeout_seconds=8,
        temperature=0.1,
        top_p=0.95,
    )
    if not isinstance(parsed, dict):
        raise RuntimeError("Word metadata generation failed")

    contextual_source = str(parsed.get("source_text", "")).strip()
    contextual_target = str(parsed.get("target_text", "")).strip()
    word_type = normalize_word_type(str(parsed.get("word_type", "")))
    if not contextual_source or not contextual_target or not word_type:
        raise RuntimeError("Word metadata generation returned incomplete data")
    if word_type in {"helper", "expression"}:
        contextual_source, contextual_target, _ = _refine_special_click_resolution(
            clicked_word=clicked_word,
            source_context=source_line.strip(),
            target_context=target_context,
            source_language=source_language,
            target_language=target_language,
            source_text=contextual_source,
            target_text=contextual_target,
            word_type=word_type,
            note="",
        )
    return _normalize_word_metadata(
        source_text=contextual_source,
        target_text=contextual_target,
        word_type=word_type,
        source_language=source_language,
        target_language=target_language,
        source_line=source_line,
        target_line=target_line,
    )


def _normalization_rules_for_word_type(word_type: str, *, source_name: str, target_name: str) -> str:
    if word_type == "noun":
        return f"""
- Return singular dictionary forms.
- Return singular with article in both source_text and target_text when {source_name} or {target_name} uses articles.
- Use the correct article independently for each language. Do not transfer or infer one language's grammatical gender from the other.
- For target_text, return nominative singular with article when the target language has nominative case.
- For source_text, return the natural singular dictionary form with article when that language uses articles.
- Only return a noun with an article when the contextual word is clearly used as a noun.
- Do not classify a capitalized word as a noun only because it is capitalized.
""".strip()
    if word_type == "verb":
        return """
- Return the infinitive or dictionary verb form in both languages.
- Do not include the subject, object, auxiliary, main verb phrase, sentence, or clause.
- Keep this as a normal verb, not a helper.
""".strip()
    if word_type == "helper":
        return """
- Return the helper word/form in target_text.
- Normalize conjugations to a single study form.
- source_text may be a single word or a short natural phrase when that is the most faithful translation of the helper in context.
- Keep source_text concise; do not turn it into a full clause or sentence.
- Do not include the main verb phrase, object, subject, sentence, or clause it supports.
- Keep this as a helper, not a normal verb.
""".strip()
    if word_type == "adjective":
        return """
- Return the base adjective form in both languages.
- Do not include noun endings caused by gender, case, or number.
- Only remove inflectional endings. Do not split, shorten, or reduce compound/derived adjectives into a different root word.
- Preserve the whole adjective when the whole word has its own meaning.
- Example: "großartige" can normalize to "großartig", but "großartig" must not normalize to "groß"; "großartig" means excellent/great, not simply big.
- Do not include a whole noun phrase.
""".strip()
    if word_type == "adverb":
        return """
- Return the base adverb form in both languages.
- Do not include a whole phrase or clause.
""".strip()
    if word_type == "expression":
        return """
- Return the shortest stable expression that carries the contextual meaning.
- Keep the expression in both languages, but do not return a full sentence unless the expression itself is a sentence-level idiom.
- If the selected target text is only one word but the target-language context shows it belongs to a fixed expression, separable verb, idiom, collocation, grammatical construction, or multi-word unit, expand target_text to the smallest reusable expression that carries that meaning.
- Prefer dictionary-style placeholders like "etwas" or "jemanden" over copying concrete sentence words.
- Do not include the full sentence unless the full sentence itself is a fixed expression.
- Do not include articles, possessives, adjectives, objects, or nearby context unless they are part of the expression's non-literal meaning.
- Return the translation of the whole expression, not a standalone translation of the clicked word.
""".strip()
    if word_type == "other":
        return """
- Return the shortest dictionary-style study form in both languages.
- Do not include a whole sentence or unrelated surrounding words.
""".strip()
    raise RuntimeError("Word metadata generation returned invalid word type")


def _normalize_word_metadata(
    *,
    source_text: str,
    target_text: str,
    word_type: str,
    source_language: str,
    target_language: str,
    source_line: str = "",
    target_line: str = "",
) -> tuple[str, str, str]:
    source_name = _language_display_name(source_language)
    target_name = _language_display_name(target_language)
    word_type = normalize_word_type(word_type)
    if not source_text.strip() or not target_text.strip() or not word_type:
        raise RuntimeError("Word metadata generation returned incomplete data")
    target_context = target_line.strip()
    parsed = _call_openai_json_logged(
        label=f"normalize_word_metadata_{word_type}",
        system_prompt=f"""
Normalize a {word_type} study entry for a language learner.

The contextual meaning and word type have already been chosen. Do not change word_type.

Return strict JSON:
{{
  "source_text": "string",
  "target_text": "string"
}}

Rules for this {word_type}:
{_normalization_rules_for_word_type(word_type, source_name=source_name, target_name=target_name)}

General rules:
- Avoid duplicate study items caused by conjugation, plural forms, case variations, or grammatical variants.
- Use only the selected target text and target-language context to normalize the already-selected word, not to choose a new meaning.
- source_text must be the best source-language translation of the normalized target study entry.
- Do not return markdown, numbering, quotes, explanations, or extra fields.
- JSON only.
""".strip(),
        user_input=(
            f"Source language: {source_name}\n"
            f"Target language: {target_name}\n"
            f"Word type: {word_type}\n"
            f"Selected target text: {target_text}\n"
            f"Target-language line context: {target_context}\n"
        ),
        timeout_seconds=8,
        temperature=0.0,
        top_p=1.0,
    )
    if not isinstance(parsed, dict):
        raise RuntimeError("Word metadata generation failed")

    normalized_source = str(parsed.get("source_text", "")).strip()
    normalized_target = str(parsed.get("target_text", "")).strip()
    if not normalized_source or not normalized_target:
        raise RuntimeError("Word metadata generation returned incomplete data")
    if word_type == "adjective" and _is_over_reduced_adjective(normalized_target, target_text):
        normalized_source = source_text
        normalized_target = target_text
    if word_type == "helper":
        if len(normalized_target.split()) != 1:
            raise RuntimeError("Word metadata generation returned invalid helper data")
        if source_language != target_language and _normalize_text(normalized_source) == _normalize_text(normalized_target):
            raise RuntimeError("Word metadata generation returned invalid helper translation")
    return normalized_source[:255], normalized_target[:255], word_type


def _is_over_reduced_adjective(normalized_target: str, original_target: str) -> bool:
    normalized = _normalize_text(normalized_target)
    original = _normalize_text(original_target)
    if not normalized or not original or normalized == original:
        return False
    if " " in normalized or " " in original:
        return False
    if not original.startswith(normalized):
        return False
    return len(original) - len(normalized) > 3


def _related_dialogs_by_item_ids(item_ids: list[int], *, user, per_item_limit: int = 8) -> dict[int, list[dict]]:
    if not item_ids:
        return {}
    occurrences = (
        apply_user_scope(ItemDialogOccurrence.objects, user, field="item__user")
        .filter(item_id__in=item_ids)
        .select_related("dialog", "turn")
        .order_by("-created_at", "-match_score", "-dialog__created_at", "-id")
    )
    by_item_dialog: dict[int, dict[int, dict]] = {}
    for occurrence in occurrences:
        dialogs_for_item = by_item_dialog.setdefault(occurrence.item_id, {})
        dialog_payload = dialogs_for_item.get(occurrence.dialog_id)
        if dialog_payload is None:
            if len(dialogs_for_item) >= per_item_limit:
                continue
            dialog_payload = {
                "dialog_id": occurrence.dialog_id,
                "topic": occurrence.dialog.topic,
                "context": occurrence.dialog.context,
                "audio_url": occurrence.dialog.audio_url,
                "created_at": occurrence.dialog.created_at.isoformat(),
                "turns": _dialog_turns_with_phrase_audio(occurrence.dialog, user=user),
                "matched_turns": [],
            }
            dialogs_for_item[occurrence.dialog_id] = dialog_payload
        matched_turn = {
            "turn_index": occurrence.turn_index,
            "side": occurrence.side,
            "match_score": occurrence.match_score,
            "source_text": occurrence.turn.source_text,
            "target_text": occurrence.turn.target_text,
        }
        if matched_turn not in dialog_payload["matched_turns"]:
            dialog_payload["matched_turns"].append(matched_turn)
    return {item_id: list(dialogs.values()) for item_id, dialogs in by_item_dialog.items()}


def _next_review_days(item: Item, now) -> int | None:
    due_values = [value for value in [item.due_at_es_to_de, item.due_at_de_to_es] if value is not None]
    if not due_values:
        return None
    due_at = min(due_values)
    delta_days = (due_at - now).total_seconds() / 86400.0
    return max(0, int(math.ceil(delta_days)))


def _dialog_turns_with_phrase_audio(dialog, *, user) -> list[dict]:
    raw_turns = dialog.turns if isinstance(dialog.turns, list) else []
    normalized_turns: list[dict] = []
    key_pairs: set[tuple[str, str]] = set()
    db_turns_by_index = {turn.turn_index: turn for turn in dialog.dialog_turns.all()}
    turn_audio_by_index = {
        turn.turn_index: str(turn.audio_url or "")
        for turn in db_turns_by_index.values()
        if str(turn.audio_url or "").strip()
    }
    if raw_turns:
        for index, turn in enumerate(raw_turns):
            if not isinstance(turn, dict):
                continue
            source_text = str(turn.get("source_text", "")).strip()
            target_text = str(turn.get("target_text", "")).strip()
            speaker = _normalize_dialog_speaker(turn.get("speaker", ""), len(normalized_turns))
            normalized_turns.append(
                {
                    "turn_index": index,
                    "source_text": source_text,
                    "target_text": target_text,
                    "speaker": speaker,
                }
            )
            if source_text and target_text:
                key_pairs.add((source_text.lower(), target_text.lower()))
    else:
        for turn in db_turns_by_index.values():
            source_text = str(turn.source_text or "").strip()
            target_text = str(turn.target_text or "").strip()
            speaker = _normalize_dialog_speaker("", len(normalized_turns))
            normalized_turns.append(
                {
                    "turn_index": turn.turn_index,
                    "source_text": source_text,
                    "target_text": target_text,
                    "speaker": speaker,
                }
            )
            if source_text and target_text:
                key_pairs.add((source_text.lower(), target_text.lower()))

    phrase_audio_by_key: dict[tuple[str, str], str] = {}
    if key_pairs:
        query = Q()
        for source_text, target_text in key_pairs:
            query |= Q(spanish_text__iexact=source_text, german_text__iexact=target_text)
        phrase_items = apply_user_scope(Item.objects, user).filter(
            item_type=Item.ItemType.PHRASE,
            source_language=dialog.source_language,
            target_language=dialog.target_language,
        ).filter(query).values("spanish_text", "german_text", "audio_url")
        phrase_audio_by_key = {
            (str(item["spanish_text"]).strip().lower(), str(item["german_text"]).strip().lower()): str(item["audio_url"] or "")
            for item in phrase_items
        }

    return [
        {
            "source_text": turn["source_text"],
            "target_text": turn["target_text"],
            "speaker": turn["speaker"],
            "phrase_audio_url": phrase_audio_by_key.get(
                (turn["source_text"].lower(), turn["target_text"].lower()),
                turn_audio_by_index.get(turn["turn_index"], ""),
            ),
        }
        for turn in normalized_turns
    ]


def _normalize_dialog_speaker(value, index: int) -> str:
    raw = str(value or "").strip().lower()
    if raw in {"a", "speaker_a", "person_a", "1", "first"}:
        return "a"
    if raw in {"b", "speaker_b", "person_b", "2", "second"}:
        return "b"
    return "a" if index % 2 == 0 else "b"


def _language_display_name(language_code: str) -> str:
    names = {
        "spanish": "Spanish",
        "english": "English",
        "german": "German",
        "french": "French",
        "italian": "Italian",
        "portuguese": "Portuguese",
    }
    return names.get(language_code, language_code.capitalize())


def _normalize_text(value: str) -> str:
    lowered = value.lower()
    return " ".join("".join(ch if ch.isalnum() or ch.isspace() else " " for ch in lowered).split())


def _looks_clearly_unrelated(normalized_question: str) -> bool:
    unrelated_terms = {
        "world cup",
        "president",
        "election",
        "stock",
        "bitcoin",
        "crypto",
        "weather",
        "recipe",
        "movie",
        "netflix",
        "politics",
        "programming",
        "python code",
        "bug fix",
    }
    for term in unrelated_terms:
        if term in normalized_question:
            return True
    return False


def _model_answer_or_reject_item_question(
    *,
    item: Item,
    question_text: str,
    source_language: str,
    target_language: str,
    conversation_history: list[dict] | None = None,
) -> dict:
    normalized_question = _normalize_text(question_text)
    if not normalized_question:
        return {"related": False, "code": "EMPTY_QUESTION", "answer": ""}

    # Single model request: decide relatedness and answer if related.
    item_source_norm = _normalize_text(item.spanish_text)
    item_target_norm = _normalize_text(item.german_text)
    question_norm = _normalize_text(question_text)
    direct_item_overlap = bool(item_source_norm and item_source_norm in question_norm) or bool(
        item_target_norm and item_target_norm in question_norm
    )

    history_rows = list(item.question_exchanges.order_by("created_at", "id"))
    merged_history: list[tuple[str, str]] = []
    seen_pairs: set[tuple[str, str]] = set()
    for row in history_rows:
        question = str(row.question_text or "").strip()
        answer = str(row.answer_text or "").strip()
        if not question and not answer:
            continue
        pair = (question, answer)
        if pair in seen_pairs:
            continue
        seen_pairs.add(pair)
        merged_history.append(pair)
    for entry in conversation_history or []:
        if not isinstance(entry, dict):
            continue
        question = str(entry.get("question_text", "")).strip()
        answer = str(entry.get("answer_text", "")).strip()
        if not question and not answer:
            continue
        pair = (question, answer)
        if pair in seen_pairs:
            continue
        seen_pairs.add(pair)
        merged_history.append(pair)
    history_lines: list[str] = []
    for idx, (question, answer) in enumerate(merged_history, start=1):
        history_lines.append(f"{idx}. Learner: {question}")
        history_lines.append(f"{idx}. Tutor: {answer}")
    history_text = "\n".join(history_lines) if history_lines else "(no previous conversation)"

    question_model = _require_question_model()

    source_name = _language_display_name(source_language)
    target_name = _language_display_name(target_language)
    parsed = _call_openai_json_logged(
        label="model_answer_or_reject_item_question",
        system_prompt=f"""
Decide if a learner question is related to learning a specific item.
If related, answer it. If not related, return a rejection code.

Return strict JSON:
{{
  "related": true,
  "result_code": "RELATED_OK",
  "answer": "string",
  "reason": "string"
}}

Rules:
- If question is related to learning/using/understanding this item, set:
  related=true, result_code="RELATED_OK", and provide concise answer (3 to 6 short lines, A1-A2), reason="".
- If question is NOT related to this item, set:
  related=false, result_code="UNRELATED_QUESTION", answer="", and provide a short reason.
- Treat the question intent as about {target_name} by default.
- Even when question text is in {source_name}, interpret it as a request about {target_name} usage.
- Do not reinterpret the question as source-language learning content.
- Be permissive with typos, misspellings, partial matches, and paraphrases.
- If the question could reasonably be about this item, treat it as related.
- Questions about words/phrases in either study language can still be related to this item
  when asked in the communicative context of the item.
- Do not assume language from spelling alone. A token may exist in both languages.
- If the learner asks about a word "in {target_name}" or within the item context, treat it as related.
- Only mark unrelated when it is clearly about a different domain/topic.
- Do not answer unrelated questions.
- Use full conversation history for context and continuity.
- Keep all explanations/comments focused on {target_name} usage (meaning, grammar, form, pronunciation, and context).
- If examples or forms are included, they should describe {target_name} usage.
- Do not include source-language teaching/explanations as the main topic.
- The answer text itself must be written in {source_name} (never in {target_name}).
- Interpret every related question through {target_name} meaning/usage, even when the question text is in {source_name}.
- Hard constraint: answer content topic must be {target_name}; answer language must be {source_name}.
- If a draft answer drifts to source-language-focused teaching, rewrite it before returning.
- Before returning, verify your answer satisfies the previous 5 rules exactly.
- JSON only.
""".strip(),
        user_input=(
            f"Question: {question_text}\n"
            f"Study pair: source={source_name}, target={target_name}\n"
            f"Item being asked about: {item.german_text} ({target_name})"
            f" / {item.spanish_text} ({source_name})\n"
            f"Item source text ({source_name}): {item.spanish_text}\n"
            f"Item target text ({target_name}): {item.german_text}\n"
            f"Item notes: {item.notes}\n"
            f"Item example: {item.example_sentence}\n"
            f"Conversation history (oldest to newest):\n{history_text}\n"
        ),
        timeout_seconds=8,
        model=question_model,
        temperature=0.0,
        top_p=1.0,
        presence_penalty=0.0,
    )
    logger.info(
        "content.item_question.decision item_id=%s direct_overlap=%s model_payload=%r",
        item.id,
        direct_item_overlap,
        parsed if isinstance(parsed, dict) else None,
    )

    if isinstance(parsed, dict):
        related = bool(parsed.get("related"))
        result_code = str(parsed.get("result_code", "")).strip()
        answer = str(parsed.get("answer", "")).strip()
        reason = str(parsed.get("reason", "")).strip()
        if not result_code:
            raise RuntimeError("Question model request failed")
        if related:
            if not answer:
                raise RuntimeError("Question model request failed")
            return {
                "related": True,
                "code": result_code,
                "answer": answer[:3000],
                "reason": reason,
            }
        return {"related": False, "code": result_code, "answer": "", "reason": reason}

    raise RuntimeError("Question model request failed")


def _serialize_question_exchange(exchange: ItemQuestionExchange) -> dict:
    return {
        "id": exchange.id,
        "question_type": exchange.question_type,
        "question_text": exchange.question_text,
        "answer_text": exchange.answer_text,
        "created_at": exchange.created_at.isoformat(),
    }


def _item_question_history(item: Item) -> list[dict]:
    rows = list(
        item.question_exchanges.order_by("-created_at", "-id")[:120]
    )
    return [_serialize_question_exchange(row) for row in rows]

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
