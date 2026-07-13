from __future__ import annotations

import math
import logging

from django.conf import settings
from django.utils import timezone
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from ...auth import apply_user_scope, get_request_user
from ...languages import language_display_name
from ...models import DialogTurn, Item, SavedDialog, SavedTopic
from ...prompts import (
    ITEM_CONVERSATION_REPLY_PROMPT,
    MISTAKE_EXPLANATION_PROMPT,
    NEXT_GOAL_SUGGESTION_PROMPT,
)
from ...serializers import ContentTopicSerializer
from .core import call_openai_json
from .conversation_history import parse_item_conversation_history as _parse_item_conversation_history
from .transcription import openai_transcribe_audio_upload as _openai_transcribe_audio_upload

logger = logging.getLogger(__name__)


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


def _render_prompt(template: str, **values: str) -> str:
    rendered = template
    for key, value in values.items():
        rendered = rendered.replace("{" + key + "}", value)
    return rendered


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
        system_prompt=_render_prompt(
            ITEM_CONVERSATION_REPLY_PROMPT,
            source_name=source_name,
            target_name=target_name,
        ),
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
        system_prompt=_render_prompt(
            MISTAKE_EXPLANATION_PROMPT,
            source_name=source_name,
            target_name=target_name,
        ),
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
        system_prompt=_render_prompt(
            NEXT_GOAL_SUGGESTION_PROMPT,
            source_name=source_name,
        ),
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
    ContentTopicConversationGoalEvaluationView,
    ContentTopicConversationHelpView,
    ContentTopicConversationRealtimeSessionView,
    ContentTopicConversationReviewView,
    ContentTopicConversationStartView,
    ContentTopicConversationTurnView,
    ContentTopicConversationUserCorrectionView,
    ContentTopicConversationUserTranslationView,
)
