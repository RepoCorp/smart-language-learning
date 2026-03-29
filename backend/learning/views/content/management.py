from __future__ import annotations

import json
import math
import logging
import re
from uuid import uuid4
from urllib.error import HTTPError, URLError
from urllib.request import Request as UrlRequest, urlopen

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
from .core import ContentCandidate, call_openai_json, create_audio_file, create_phrase_if_missing, create_word_if_missing, item_exists

logger = logging.getLogger(__name__)


def _normalized_pair(request: Request) -> tuple[str, str]:
    source_language = (request.query_params.get("source_language", "spanish") or "spanish").strip().lower()
    target_language = (request.query_params.get("target_language", "german") or "german").strip().lower()
    return source_language, target_language


class ContentItemsView(APIView):
    def get(self, request: Request) -> Response:
        user = get_request_user(request)
        source_language, target_language = _normalized_pair(request)
        now = timezone.now()
        rows = list(
            apply_user_scope(Item.objects, user).filter(source_language=source_language, target_language=target_language)
            .order_by("-created_at", "-id")[:200]
        )
        items = [
            {
                "id": item.id,
                "item_type": item.item_type,
                "spanish_text": item.spanish_text,
                "german_text": item.german_text,
                "created_at": item.created_at,
                "next_review_days": _next_review_days(item, now),
                "audio_url": item.audio_url,
                "is_learned": item.is_learned,
            }
            for item in rows
        ]
        return Response({"items": items})


class ContentWordsView(APIView):
    def get(self, request: Request) -> Response:
        user = get_request_user(request)
        source_language, target_language = _normalized_pair(request)
        query = (request.query_params.get("q", "") or "").strip()

        words_queryset = apply_user_scope(Item.objects, user).filter(
            item_type=Item.ItemType.WORD,
            source_language=source_language,
            target_language=target_language,
        )
        if query:
            words_queryset = words_queryset.filter(
                Q(spanish_text__icontains=query) | Q(german_text__icontains=query)
            )

        words = list(
            words_queryset.order_by("-created_at", "-id").values(
                "id",
                "item_type",
                "spanish_text",
                "german_text",
                "example_sentence",
                "notes",
                "audio_url",
                "created_at",
            )[:1000]
        )
        item_ids = [word["id"] for word in words]
        related_dialogs_map = _related_dialogs_by_item_ids(item_ids, user=user)
        for word in words:
            word["related_dialogs"] = related_dialogs_map.get(word["id"], [])
        return Response({"words": words})


class ContentItemDetailView(APIView):
    def get(self, request: Request, item_id: int) -> Response:
        user = get_request_user(request)
        source_language, target_language = _normalized_pair(request)
        item = apply_user_scope(Item.objects, user).filter(
            id=item_id,
            source_language=source_language,
            target_language=target_language,
        ).first()
        if not item:
            return Response({"detail": "Item not found"}, status=status.HTTP_404_NOT_FOUND)

        related_dialogs_map = _related_dialogs_by_item_ids([item.id], per_item_limit=12, user=user)
        return Response(
            {
                "id": item.id,
                "item_type": item.item_type,
                "spanish_text": item.spanish_text,
                "german_text": item.german_text,
                "example_sentence": item.example_sentence,
                "notes": item.notes,
                "audio_url": item.audio_url,
                "exercise_phrases": item.exercise_phrases or {},
                "created_at": item.created_at,
                "related_dialogs": related_dialogs_map.get(item.id, []),
                "item_questions": _item_question_history(item),
            }
        )

    def post(self, request: Request, item_id: int) -> Response:
        user = get_request_user(request)
        source_language, target_language = _normalized_pair(request)
        item = apply_user_scope(Item.objects, user).filter(
            id=item_id,
            source_language=source_language,
            target_language=target_language,
        ).first()
        if not item:
            return Response({"detail": "Item not found"}, status=status.HTTP_404_NOT_FOUND)

        if item.item_type == Item.ItemType.WORD:
            phrase_part = item.example_sentence.strip()
            audio_text = f"{item.german_text}. {phrase_part}".strip() if phrase_part else item.german_text
            audio_prefix = "word"
        else:
            audio_text = item.german_text
            audio_prefix = "phrase"

        audio_url = create_audio_file(audio_text, audio_prefix, target_language=target_language)
        if not audio_url:
            return Response({"detail": "Audio generation failed"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        item.audio_url = audio_url
        item.save(update_fields=["audio_url", "updated_at"])
        return Response({"audio_url": audio_url})

    def delete(self, request: Request, item_id: int) -> Response:
        user = get_request_user(request)
        source_language, target_language = _normalized_pair(request)
        deleted, _ = apply_user_scope(Item.objects, user).filter(
            id=item_id,
            source_language=source_language,
            target_language=target_language,
        ).delete()
        if deleted == 0:
            return Response({"detail": "Item not found"}, status=status.HTTP_404_NOT_FOUND)
        return Response(status=status.HTTP_204_NO_CONTENT)


class ContentItemMarkLearnedView(APIView):
    def post(self, request: Request, item_id: int) -> Response:
        user = get_request_user(request)
        source_language, target_language = _normalized_pair(request)
        is_learned_raw = request.data.get("is_learned", True)
        if isinstance(is_learned_raw, str):
            is_learned = is_learned_raw.strip().lower() in {"1", "true", "yes", "on"}
        else:
            is_learned = bool(is_learned_raw)
        updated = apply_user_scope(Item.objects, user).filter(
            id=item_id,
            source_language=source_language,
            target_language=target_language,
        ).update(is_learned=is_learned)
        if updated == 0:
            return Response({"detail": "Item not found"}, status=status.HTTP_404_NOT_FOUND)
        return Response({"ok": True, "is_learned": is_learned})


class ContentItemQuestionView(APIView):
    def post(self, request: Request, item_id: int) -> Response:
        user = get_request_user(request)
        source_language, target_language = _normalized_pair(request)
        item = apply_user_scope(Item.objects, user).filter(
            id=item_id,
            source_language=source_language,
            target_language=target_language,
        ).first()
        if not item:
            return Response({"detail": "Item not found"}, status=status.HTTP_404_NOT_FOUND)

        question_text = str(request.data.get("question_text", "")).strip()
        logger.info(
            "content.item_question.received item_id=%s source_lang=%s target_lang=%s question=%r",
            item_id,
            source_language,
            target_language,
            question_text[:255],
        )
        if not question_text:
            logger.info("content.item_question.rejected item_id=%s code=EMPTY_QUESTION", item_id)
            return Response({"detail": "question_text is required"}, status=status.HTTP_400_BAD_REQUEST)
        if len(question_text) > 255:
            logger.info("content.item_question.rejected item_id=%s code=QUESTION_TOO_LONG len=%s", item_id, len(question_text))
            return Response({"detail": "question_text is too long"}, status=status.HTTP_400_BAD_REQUEST)

        decision = _model_answer_or_reject_item_question(
            item=item,
            question_text=question_text,
            source_language=source_language,
            target_language=target_language,
        )
        if not decision["related"]:
            logger.info(
                "content.item_question.rejected item_id=%s code=%s reason=%r question=%r",
                item_id,
                decision["code"],
                decision.get("reason", ""),
                question_text[:255],
            )
            return Response(
                {
                    "detail": "Question must be related to learning this specific item.",
                    "code": decision["code"],
                    "reason": decision.get("reason", ""),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        answer_text = decision["answer"]
        logger.info(
            "content.item_question.accepted item_id=%s code=%s answer_len=%s",
            item_id,
            decision["code"],
            len(answer_text),
        )
        exchange = ItemQuestionExchange.objects.create(
            item=item,
            source_language=source_language,
            target_language=target_language,
            question_type=ItemQuestionExchange.QuestionType.CUSTOM_RELATED,
            question_text=question_text,
            answer_text=answer_text,
        )
        conversation = _item_question_history(item)
        return Response(
            {
                "exchange": _serialize_question_exchange(exchange),
                "conversation": conversation,
            },
            status=status.HTTP_201_CREATED,
        )


class ContentWordQuickAddView(APIView):
    def post(self, request: Request) -> Response:
        user = get_request_user(request)
        source_language, target_language = _normalized_pair(request)
        source_text = str(request.data.get("source_text", "")).strip()
        target_text = str(request.data.get("target_text", "")).strip()
        source_line = str(request.data.get("source_line", "")).strip()
        target_line = str(request.data.get("target_line", "")).strip()
        clicked_target_token = str(request.data.get("clicked_target_token", "")).strip()
        notes = str(request.data.get("notes", "")).strip()
        dialog_id_raw = request.data.get("dialog_id")
        turn_index_raw = request.data.get("turn_index")
        check_only_raw = request.data.get("check_only", False)
        if isinstance(check_only_raw, str):
            check_only = check_only_raw.strip().lower() in {"1", "true", "yes", "on"}
        else:
            check_only = bool(check_only_raw)

        if not source_text or not target_text:
            return Response({"detail": "source_text and target_text are required"}, status=status.HTTP_400_BAD_REQUEST)

        source_text, target_text = _resolve_dialog_click_word_pair(
            user=user,
            source_text=source_text,
            target_text=target_text,
            source_language=source_language,
            target_language=target_language,
            dialog_id_raw=dialog_id_raw,
            turn_index_raw=turn_index_raw,
            source_line=source_line,
            target_line=target_line,
            clicked_target_token=clicked_target_token,
        )

        exists = item_exists(
            user=user,
            item_type="word",
            spanish_text=source_text,
            german_text=target_text,
            source_language=source_language,
            target_language=target_language,
        )
        if exists:
            existing = (
                apply_user_scope(Item.objects, user).filter(
                    item_type=Item.ItemType.WORD,
                    source_language=source_language,
                    target_language=target_language,
                    spanish_text__iexact=source_text,
                    german_text__iexact=target_text,
                )
                .order_by("-id")
                .first()
            )
            if check_only:
                return Response(
                    {
                        "created": False,
                        "exists": True,
                        "id": existing.id if existing else None,
                        "source_text": source_text,
                        "target_text": target_text,
                    }
                )
            if existing:
                _link_word_to_dialog_turn(
                    user=user,
                    item=existing,
                    dialog_id_raw=dialog_id_raw,
                    turn_index_raw=turn_index_raw,
                )
            return Response(
                {
                    "created": False,
                    "exists": True,
                    "id": existing.id if existing else None,
                    "source_text": source_text,
                    "target_text": target_text,
                }
            )

        if check_only:
            return Response(
                {
                    "created": False,
                    "exists": False,
                    "id": None,
                    "source_text": source_text,
                    "target_text": target_text,
                }
            )

        candidate = ContentCandidate(
            spanish_text=source_text,
            german_text=target_text,
            exists=False,
            notes=notes,
        )
        created = create_word_if_missing(
            user=user,
            candidate=candidate,
            topic="dialog-click",
            source_language=source_language,
            target_language=target_language,
        )
        if created is None:
            return Response(
                {
                    "created": False,
                    "exists": True,
                    "source_text": source_text,
                    "target_text": target_text,
                }
            )

        _link_word_to_dialog_turn(
            user=user,
            item=created,
            dialog_id_raw=dialog_id_raw,
            turn_index_raw=turn_index_raw,
        )
        return Response(
            {
                "created": True,
                "exists": False,
                "id": created.id,
                "source_text": created.spanish_text,
                "target_text": created.german_text,
                "audio_url": created.audio_url,
            },
            status=status.HTTP_201_CREATED,
        )


class ContentPhraseQuickAddView(APIView):
    def post(self, request: Request) -> Response:
        user = get_request_user(request)
        source_language, target_language = _normalized_pair(request)
        source_text = str(request.data.get("source_text", "")).strip()
        target_text = str(request.data.get("target_text", "")).strip()
        notes = str(request.data.get("notes", "")).strip()
        check_only_raw = request.data.get("check_only", False)
        if isinstance(check_only_raw, str):
            check_only = check_only_raw.strip().lower() in {"1", "true", "yes", "on"}
        else:
            check_only = bool(check_only_raw)

        if not source_text or not target_text:
            return Response({"detail": "source_text and target_text are required"}, status=status.HTTP_400_BAD_REQUEST)

        exists = item_exists(
            user=user,
            item_type=Item.ItemType.PHRASE,
            spanish_text=source_text,
            german_text=target_text,
            source_language=source_language,
            target_language=target_language,
        )
        if exists:
            existing = (
                apply_user_scope(Item.objects, user).filter(
                    item_type=Item.ItemType.PHRASE,
                    source_language=source_language,
                    target_language=target_language,
                    spanish_text__iexact=source_text,
                    german_text__iexact=target_text,
                )
                .order_by("-id")
                .first()
            )
            return Response(
                {
                    "created": False,
                    "exists": True,
                    "id": existing.id if existing else None,
                    "source_text": source_text,
                    "target_text": target_text,
                }
            )

        if check_only:
            return Response(
                {
                    "created": False,
                    "exists": False,
                    "id": None,
                    "source_text": source_text,
                    "target_text": target_text,
                }
            )

        candidate = ContentCandidate(
            spanish_text=source_text,
            german_text=target_text,
            exists=False,
            notes=notes,
        )
        created = create_phrase_if_missing(
            user=user,
            candidate=candidate,
            topic="conversation-click",
            source_language=source_language,
            target_language=target_language,
        )
        if created is None:
            return Response(
                {
                    "created": False,
                    "exists": True,
                    "source_text": source_text,
                    "target_text": target_text,
                }
            )
        return Response(
            {
                "created": True,
                "exists": False,
                "id": created.id,
                "source_text": created.spanish_text,
                "target_text": created.german_text,
                "audio_url": created.audio_url,
            },
            status=status.HTTP_201_CREATED,
        )


class ContentItemConversationView(APIView):
    def post(self, request: Request, item_id: int) -> Response:
        user = get_request_user(request)
        source_language, target_language = _normalized_pair(request)
        item = apply_user_scope(Item.objects, user).filter(
            id=item_id,
            source_language=source_language,
            target_language=target_language,
        ).first()
        if not item:
            return Response({"detail": "Item not found"}, status=status.HTTP_404_NOT_FOUND)

        audio_file = request.FILES.get("audio")
        if audio_file is None:
            return Response({"detail": "audio file is required"}, status=status.HTTP_400_BAD_REQUEST)

        history = _parse_item_conversation_history(request.data.get("history"))
        user_text = _openai_transcribe_audio_upload(audio_file, target_language=target_language)
        if not user_text:
            return Response({"detail": "Could not transcribe audio"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        assistant_payload = _generate_item_conversation_reply(
            item=item,
            user_text=user_text,
            history=history,
            source_language=source_language,
            target_language=target_language,
        )
        assistant_text = assistant_payload["reply_text"]
        assistant_translation_text = assistant_payload.get("source_translation", "")
        user_translation_text = assistant_payload.get("user_source_translation", "")
        user_corrected_text = assistant_payload.get("corrected_user_text", "")
        user_corrected_translation_text = assistant_payload.get("corrected_user_source_translation", "")
        user_correction_explanation = assistant_payload.get("corrected_user_explanation", "")
        assistant_audio_url = ""
        if assistant_text:
            assistant_audio_url = create_audio_file(assistant_text, "conversation", target_language=target_language)

        return Response(
            {
                "user_text": user_text,
                "user_translation_text": user_translation_text,
                "user_corrected_text": user_corrected_text,
                "user_corrected_translation_text": user_corrected_translation_text,
                "user_correction_explanation": user_correction_explanation,
                "assistant_text": assistant_text,
                "assistant_translation_text": assistant_translation_text,
                "assistant_audio_url": assistant_audio_url,
            }
        )


class ContentTopicConversationStartView(APIView):
    def post(self, request: Request) -> Response:
        source_language, target_language = _normalized_pair(request)
        topic = str(request.data.get("topic", "")).strip()
        notes = str(request.data.get("notes", "")).strip()
        role_text = str(request.data.get("role_text", "")).strip()
        if not topic:
            return Response({"detail": "topic is required"}, status=status.HTTP_400_BAD_REQUEST)
        if len(topic) > 120:
            return Response({"detail": "topic is too long"}, status=status.HTTP_400_BAD_REQUEST)
        if len(notes) > 1000:
            return Response({"detail": "notes is too long"}, status=status.HTTP_400_BAD_REQUEST)
        if len(role_text) > 240:
            return Response({"detail": "role_text is too long"}, status=status.HTTP_400_BAD_REQUEST)

        start_payload = _generate_topic_conversation_start(
            topic=topic,
            notes=notes,
            role_text=role_text,
            source_language=source_language,
            target_language=target_language,
        )
        opening_text = start_payload.get("opening_text", "")
        opening_translation_text = start_payload.get("opening_translation_text", "")
        goal_text = start_payload.get("goal_text", "")
        opening_audio_url = ""
        if opening_text:
            opening_audio_url = create_audio_file(opening_text, "conversation", target_language=target_language)

        return Response(
            {
                "topic": topic,
                "notes": notes,
                "role_text": role_text,
                "goal_text": goal_text,
                "opening_text": opening_text,
                "opening_translation_text": opening_translation_text,
                "opening_audio_url": opening_audio_url,
            }
        )


class ContentTopicConversationTurnView(APIView):
    def post(self, request: Request) -> Response:
        source_language, target_language = _normalized_pair(request)
        topic = str(request.data.get("topic", "")).strip()
        notes = str(request.data.get("notes", "")).strip()
        role_text = str(request.data.get("role_text", "")).strip()
        goal_text = str(request.data.get("goal_text", "")).strip()
        if not topic:
            return Response({"detail": "topic is required"}, status=status.HTTP_400_BAD_REQUEST)
        if len(topic) > 120:
            return Response({"detail": "topic is too long"}, status=status.HTTP_400_BAD_REQUEST)
        if len(role_text) > 240:
            return Response({"detail": "role_text is too long"}, status=status.HTTP_400_BAD_REQUEST)

        audio_file = request.FILES.get("audio")
        if audio_file is None:
            return Response({"detail": "audio file is required"}, status=status.HTTP_400_BAD_REQUEST)

        history = _parse_item_conversation_history(request.data.get("history"))
        user_text = _openai_transcribe_audio_upload(audio_file, target_language=target_language)
        if not user_text:
            return Response({"detail": "Could not transcribe audio"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        assistant_payload = _generate_topic_conversation_reply(
            topic=topic,
            notes=notes,
            role_text=role_text,
            goal_text=goal_text,
            user_text=user_text,
            history=history,
            source_language=source_language,
            target_language=target_language,
        )
        assistant_text = assistant_payload["reply_text"]
        assistant_translation_text = assistant_payload.get("source_translation", "")
        user_translation_text = assistant_payload.get("user_source_translation", "")
        user_corrected_text = assistant_payload.get("corrected_user_text", "")
        user_corrected_translation_text = assistant_payload.get("corrected_user_source_translation", "")
        user_correction_explanation = assistant_payload.get("corrected_user_explanation", "")
        assistant_audio_url = ""
        if assistant_text:
            assistant_audio_url = create_audio_file(assistant_text, "conversation", target_language=target_language)

        return Response(
            {
                "user_text": user_text,
                "user_translation_text": user_translation_text,
                "user_corrected_text": user_corrected_text,
                "user_corrected_translation_text": user_corrected_translation_text,
                "user_correction_explanation": user_correction_explanation,
                "assistant_text": assistant_text,
                "assistant_translation_text": assistant_translation_text,
                "assistant_audio_url": assistant_audio_url,
            }
        )


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
) -> tuple[str, str]:
    try:
        dialog_id = int(dialog_id_raw)
        turn_index = int(turn_index_raw)
    except (TypeError, ValueError):
        return _resolve_word_pair_from_inline_context(
            source_text=source_text,
            target_text=target_text,
            source_language=source_language,
            target_language=target_language,
            source_line=source_line,
            target_line=target_line,
            clicked_target_token=clicked_target_token,
        )

    dialog = apply_user_scope(SavedDialog.objects, user).filter(
        id=dialog_id,
        source_language=source_language,
        target_language=target_language,
    ).first()
    if not dialog:
        return _resolve_word_pair_from_inline_context(
            source_text=source_text,
            target_text=target_text,
            source_language=source_language,
            target_language=target_language,
            source_line=source_line,
            target_line=target_line,
            clicked_target_token=clicked_target_token,
        )
    turn = DialogTurn.objects.filter(dialog_id=dialog_id, turn_index=turn_index).first()
    if not turn:
        return _resolve_word_pair_from_inline_context(
            source_text=source_text,
            target_text=target_text,
            source_language=source_language,
            target_language=target_language,
            source_line=source_line,
            target_line=target_line,
            clicked_target_token=clicked_target_token,
        )

    parsed = call_openai_json(
        """
Resolve a clicked word translation in context for a language-learning dialog turn.

Return strict JSON:
{
  "source_text": "string",
  "target_text": "string"
}

Rules:
- Keep target_text equal to the clicked target token, except trim punctuation/spacing.
- source_text must be the best source-language translation in THIS turn context.
- Prefer dictionary-style compact form (1-3 words).
- If uncertain, keep the clicked source_text.
- JSON only.
""".strip(),
        (
            f"Source language: {_language_display_name(source_language)}\n"
            f"Target language: {_language_display_name(target_language)}\n"
            f"Dialog topic: {dialog.topic}\n"
            f"Dialog context: {dialog.context}\n"
            f"Full source line: {turn.source_text}\n"
            f"Full target line: {turn.target_text}\n"
            f"Clicked source token: {source_text}\n"
            f"Clicked target token: {target_text}\n"
        ),
        timeout_seconds=6,
        temperature=0.0,
        top_p=1.0,
        presence_penalty=0.0,
    )
    if not isinstance(parsed, dict):
        return _resolve_word_pair_from_inline_context(
            source_text=source_text,
            target_text=target_text,
            source_language=source_language,
            target_language=target_language,
            source_line=source_line,
            target_line=target_line,
            clicked_target_token=clicked_target_token,
        )

    resolved_source = str(parsed.get("source_text", source_text)).strip()
    resolved_target = str(parsed.get("target_text", target_text)).strip()
    return _sanitize_resolved_dialog_click_pair(
        source_text=resolved_source or source_text,
        target_text=resolved_target or target_text,
        fallback_source_text=source_text,
        fallback_target_text=target_text,
        source_line=turn.source_text,
        target_line=turn.target_text,
        clicked_target_token=clicked_target_token or target_text,
    )


def _resolve_word_pair_from_inline_context(
    *,
    source_text: str,
    target_text: str,
    source_language: str,
    target_language: str,
    source_line: str,
    target_line: str,
    clicked_target_token: str,
) -> tuple[str, str]:
    if not source_line or not target_line or not clicked_target_token:
        return source_text, target_text

    parsed = call_openai_json(
        """
Resolve a clicked word translation from inline parallel sentence context.

Return strict JSON:
{
  "source_text": "string",
  "target_text": "string"
}

Rules:
- target_text must be the clicked target token (trim punctuation only).
- source_text must be the best source-language translation for that clicked token in this sentence context.
- Keep source_text short (1-3 words) when possible.
- If uncertain, keep provided source_text.
- JSON only.
""".strip(),
        (
            f"Source language: {_language_display_name(source_language)}\n"
            f"Target language: {_language_display_name(target_language)}\n"
            f"Full source line: {source_line}\n"
            f"Full target line: {target_line}\n"
            f"Clicked target token: {clicked_target_token}\n"
            f"Provided source token: {source_text}\n"
        ),
        timeout_seconds=6,
        temperature=0.0,
        top_p=1.0,
        presence_penalty=0.0,
    )
    if not isinstance(parsed, dict):
        return _sanitize_resolved_dialog_click_pair(
            source_text=source_text,
            target_text=target_text,
            fallback_source_text=source_text,
            fallback_target_text=target_text,
            source_line=source_line,
            target_line=target_line,
            clicked_target_token=clicked_target_token or target_text,
        )
    resolved_source = str(parsed.get("source_text", source_text)).strip()
    resolved_target = str(parsed.get("target_text", clicked_target_token or target_text)).strip()
    return _sanitize_resolved_dialog_click_pair(
        source_text=resolved_source or source_text,
        target_text=resolved_target or target_text,
        fallback_source_text=source_text,
        fallback_target_text=target_text,
        source_line=source_line,
        target_line=target_line,
        clicked_target_token=clicked_target_token or target_text,
    )


def _sanitize_resolved_dialog_click_pair(
    *,
    source_text: str,
    target_text: str,
    fallback_source_text: str,
    fallback_target_text: str,
    source_line: str,
    target_line: str,
    clicked_target_token: str,
) -> tuple[str, str]:
    source_tokens = _line_tokens(source_line)
    source_token_set = {_normalize_word_token(token) for token in source_tokens}
    target_tokens = _line_tokens(target_line)
    target_token_set = {_normalize_word_token(token) for token in target_tokens}

    resolved_target = _clean_edge_punctuation(target_text) or _clean_edge_punctuation(clicked_target_token) or _clean_edge_punctuation(fallback_target_text)
    if not resolved_target:
        resolved_target = fallback_target_text

    resolved_source = _clean_edge_punctuation(source_text) or _clean_edge_punctuation(fallback_source_text)
    resolved_source_norm = _normalize_word_token(resolved_source)
    resolved_target_norm = _normalize_word_token(resolved_target)

    fallback_source = _best_source_token_fallback(
        source_tokens=source_tokens,
        target_tokens=target_tokens,
        clicked_target_token=clicked_target_token or resolved_target,
    )
    fallback_source_norm = _normalize_word_token(fallback_source)

    provided_source_norm = _normalize_word_token(fallback_source_text)
    provided_source_is_from_source_line = provided_source_norm and provided_source_norm in source_token_set
    source_looks_like_target_language = bool(
        resolved_source_norm
        and (
            resolved_source_norm == resolved_target_norm
            or (resolved_source_norm in target_token_set and resolved_source_norm not in source_token_set)
        )
    )

    if not resolved_source_norm:
        if provided_source_is_from_source_line:
            resolved_source = fallback_source_text
        elif fallback_source_norm:
            resolved_source = fallback_source
        else:
            resolved_source = fallback_source_text
    elif source_looks_like_target_language:
        if fallback_source_norm:
            resolved_source = fallback_source
        elif provided_source_is_from_source_line:
            resolved_source = fallback_source_text

    return resolved_source[:120], resolved_target[:120]


def _line_tokens(value: str) -> list[str]:
    return [match.group(0) for match in re.finditer(r"[^\W\d_]+(?:[-'][^\W\d_]+)*", value, flags=re.UNICODE)]


def _normalize_word_token(value: str) -> str:
    return _clean_edge_punctuation(value).lower()


def _clean_edge_punctuation(value: str) -> str:
    return re.sub(r"^[^\wÀ-ÖØ-öø-ÿ]+|[^\wÀ-ÖØ-öø-ÿ]+$", "", value or "", flags=re.UNICODE).strip()


def _best_source_token_fallback(
    *,
    source_tokens: list[str],
    target_tokens: list[str],
    clicked_target_token: str,
) -> str:
    if not source_tokens:
        return ""

    clicked_norm = _normalize_word_token(clicked_target_token)
    target_index = -1
    if clicked_norm:
        for index, token in enumerate(target_tokens):
            if _normalize_word_token(token) == clicked_norm:
                target_index = index
                break

    if target_index < 0:
        return source_tokens[-1]
    if len(target_tokens) <= 1 or len(source_tokens) <= 1:
        mapped_index = min(target_index, len(source_tokens) - 1)
        return source_tokens[mapped_index]

    ratio = target_index / (len(target_tokens) - 1)
    mapped_index = round(ratio * (len(source_tokens) - 1))
    mapped_index = max(0, min(mapped_index, len(source_tokens) - 1))
    return source_tokens[mapped_index]


def _parse_item_conversation_history(raw_value) -> list[dict[str, str]]:
    if raw_value is None:
        return []
    if isinstance(raw_value, str):
        try:
            parsed = json.loads(raw_value)
        except json.JSONDecodeError:
            return []
    elif isinstance(raw_value, list):
        parsed = raw_value
    else:
        return []

    cleaned: list[dict[str, str]] = []
    for entry in parsed:
        if not isinstance(entry, dict):
            continue
        user_text = str(entry.get("user_text", "")).strip()
        assistant_text = str(entry.get("assistant_text", "")).strip()
        if not user_text and not assistant_text:
            continue
        cleaned.append({"user_text": user_text[:500], "assistant_text": assistant_text[:800]})
    return cleaned[-8:]


def _openai_transcribe_audio_upload(uploaded_file, *, target_language: str) -> str:
    api_key = settings.OPENAI_API_KEY
    if not api_key:
        return ""

    try:
        file_bytes = uploaded_file.read()
        if hasattr(uploaded_file, "seek"):
            uploaded_file.seek(0)
    except Exception:
        return ""
    if not file_bytes:
        return ""

    model_name = str(getattr(settings, "OPENAI_TRANSCRIBE_MODEL", "gpt-4o-mini-transcribe")).strip() or "gpt-4o-mini-transcribe"
    filename = str(getattr(uploaded_file, "name", "")).strip() or f"speech-{uuid4().hex[:8]}.webm"
    content_type = str(getattr(uploaded_file, "content_type", "")).strip() or "application/octet-stream"
    language_hint = {
        "spanish": "es",
        "english": "en",
        "german": "de",
        "french": "fr",
        "italian": "it",
        "portuguese": "pt",
    }.get(target_language, "")

    boundary = f"----smartlang-{uuid4().hex}"
    body = bytearray()

    def append_field(name: str, value: str) -> None:
        body.extend(f"--{boundary}\r\n".encode("utf-8"))
        body.extend(f'Content-Disposition: form-data; name="{name}"\r\n\r\n'.encode("utf-8"))
        body.extend(value.encode("utf-8"))
        body.extend(b"\r\n")

    append_field("model", model_name)
    if language_hint:
        append_field("language", language_hint)
    body.extend(f"--{boundary}\r\n".encode("utf-8"))
    body.extend(f'Content-Disposition: form-data; name="file"; filename="{filename}"\r\n'.encode("utf-8"))
    body.extend(f"Content-Type: {content_type}\r\n\r\n".encode("utf-8"))
    body.extend(file_bytes)
    body.extend(b"\r\n")
    body.extend(f"--{boundary}--\r\n".encode("utf-8"))

    request = UrlRequest(
        "https://api.openai.com/v1/audio/transcriptions",
        data=bytes(body),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": f"multipart/form-data; boundary={boundary}",
        },
        method="POST",
    )
    timeout_seconds = int(getattr(settings, "OPENAI_REQUEST_TIMEOUT_SECONDS", 30))
    try:
        with urlopen(request, timeout=timeout_seconds) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError):
        return ""
    return str(payload.get("text", "")).strip()[:1000]


def _generate_item_conversation_reply(
    *,
    item: Item,
    user_text: str,
    history: list[dict[str, str]],
    source_language: str,
    target_language: str,
) -> dict[str, str]:
    history_lines: list[str] = []
    for row in history:
        if row.get("user_text"):
            history_lines.append(f"Learner: {row['user_text']}")
        if row.get("assistant_text"):
            history_lines.append(f"Tutor: {row['assistant_text']}")

    parsed = call_openai_json(
        """
You are a conversation partner. Continue a short voice conversation focused on one study item.

Return strict JSON:
{
  "reply_text": "string",
  "source_translation": "string",
  "user_source_translation": "string",
  "corrected_user_text": "string",
  "corrected_user_source_translation": "string",
  "corrected_user_explanation": "string"
}

Rules:
- Write reply_text in the TARGET language only.
- Write source_translation in the SOURCE language only.
- user_source_translation must be the SOURCE-language translation of the learner input.
- Keep a natural peer-to-peer tone, like regular conversation with another person.
- Do not act like a teacher, tutor, or evaluator.
- corrected_user_text must be in TARGET language and should only be provided if the user explicitly asks for correction/help.
- corrected_user_source_translation must be in SOURCE language and only for corrected_user_text.
- corrected_user_explanation must be a short explanation in SOURCE language (1 short line), only when correction exists.
- Never include correction content inside reply_text.
- Keep it concise: 1 to 3 short sentences.
- Keep source_translation concise and natural, aligned to reply_text meaning.
- Keep the conversation centered on this specific item and its usage.
- Do not proactively correct mistakes unless the user explicitly asks for correction/help.
- End with one simple follow-up question to keep the conversation going.
- JSON only.
""".strip(),
        (
            f"Source language: {_language_display_name(source_language)}\n"
            f"Target language: {_language_display_name(target_language)}\n"
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
    if isinstance(parsed, dict):
        reply_text = str(parsed.get("reply_text", "")).strip()
        source_translation = _ensure_source_language_text(
            str(parsed.get("source_translation", "")).strip(),
            source_language=source_language,
        )
        user_source_translation = _ensure_source_language_text(
            str(parsed.get("user_source_translation", "")).strip(),
            source_language=source_language,
        )
        corrected_user_text = str(parsed.get("corrected_user_text", "")).strip()
        corrected_user_source_translation = _ensure_source_language_text(
            str(parsed.get("corrected_user_source_translation", "")).strip(),
            source_language=source_language,
        )
        corrected_user_explanation = _ensure_source_language_text(
            str(parsed.get("corrected_user_explanation", "")).strip(),
            source_language=source_language,
        )
        if corrected_user_text:
            refined_explanation = _generate_mistake_explanation_with_question_model(
                source_language=source_language,
                target_language=target_language,
                learner_text=user_text,
                corrected_text=corrected_user_text,
                corrected_source_translation=corrected_user_source_translation,
                context_label=(
                    f"Item source text: {item.spanish_text}\n"
                    f"Item target text: {item.german_text}\n"
                    f"Item notes: {item.notes}\n"
                ),
            )
            if refined_explanation:
                corrected_user_explanation = refined_explanation
        if reply_text:
            return {
                "reply_text": reply_text[:1200],
                "source_translation": source_translation[:1200],
                "user_source_translation": user_source_translation[:1200],
                "corrected_user_text": corrected_user_text[:1200],
                "corrected_user_source_translation": corrected_user_source_translation[:1200],
                "corrected_user_explanation": corrected_user_explanation[:1200],
            }

    fallback_by_language = {
        "german": f"{item.german_text} ist wichtig. Kannst du einen kurzen Satz mit {item.german_text} sagen?",
        "spanish": f"{item.german_text} es importante. Puedes decir una frase corta con {item.german_text}?",
        "english": f"{item.german_text} is important. Can you say one short sentence with {item.german_text}?",
        "french": f"{item.german_text} est important. Peux-tu dire une phrase courte avec {item.german_text} ?",
        "italian": f"{item.german_text} e importante. Puoi dire una frase breve con {item.german_text}?",
        "portuguese": f"{item.german_text} e importante. Voce pode dizer uma frase curta com {item.german_text}?",
    }
    return {
        "reply_text": fallback_by_language.get(
            target_language,
            f"{item.german_text} is important. Can you say one short sentence with {item.german_text}?",
        ),
        "source_translation": "",
        "user_source_translation": "",
        "corrected_user_text": "",
        "corrected_user_source_translation": "",
        "corrected_user_explanation": "",
    }


def _generate_topic_conversation_start(
    *,
    topic: str,
    notes: str,
    role_text: str,
    source_language: str,
    target_language: str,
) -> dict[str, str]:
    parsed = call_openai_json(
        """
Create a conversation setup for a language learner.

Return strict JSON:
{
  "goal_text": "string",
  "opening_text": "string",
  "opening_translation_text": "string"
}

Rules:
- goal_text must be in SOURCE language and include exactly one concrete condition.
- The condition must be specific and verifiable (clear done/not-done outcome).
- Include one concrete target detail (for example a number, exact item, exact decision, or exact piece of information).
- Keep it achievable in one short conversation.
- Avoid generic goals like "have a conversation about X".
- opening_text must be in TARGET language and sound like a normal person starting a conversation.
- opening_translation_text must be SOURCE-language translation of opening_text.
- Keep goal_text to one concise line.
- Keep opening_text to 1-2 short sentences and end with a simple question.
- Match the topic and notes context.
- If learner role is provided, tailor both goal and opening to that role.
- opening_text must be spoken by the conversation partner, not by the learner.
- Never write opening_text from the learner role perspective.
- If learner role is "customer", partner should sound like staff/seller/service person.
- Do not use teacher or tutor voice.
- JSON only.
""".strip(),
        (
            f"Source language: {_language_display_name(source_language)}\n"
            f"Target language: {_language_display_name(target_language)}\n"
            f"Topic: {topic}\n"
            f"Temporary notes: {notes}\n"
            f"Learner role: {role_text}\n"
        ),
        timeout_seconds=10,
        temperature=0.6,
        top_p=0.9,
        presence_penalty=0.2,
    )
    if isinstance(parsed, dict):
        goal_text = str(parsed.get("goal_text", "")).strip()
        opening_text = str(parsed.get("opening_text", "")).strip()
        opening_translation_text = str(parsed.get("opening_translation_text", "")).strip()
        if goal_text and opening_text:
            return {
                "goal_text": goal_text[:600],
                "opening_text": opening_text[:1200],
                "opening_translation_text": opening_translation_text[:1200],
            }

    fallback_opening_by_language = {
        "german": f"Hi! Lass uns ueber {topic} sprechen. Was ist dir dabei wichtig?",
        "spanish": f"Hola. Hablemos de {topic}. Que te parece mas importante?",
        "english": f"Hi. Let's talk about {topic}. What's most important to you?",
        "french": f"Salut. Parlons de {topic}. Qu'est-ce qui est le plus important pour toi ?",
        "italian": f"Ciao. Parliamo di {topic}. Cosa e piu importante per te?",
        "portuguese": f"Ola. Vamos falar sobre {topic}. O que e mais importante para voce?",
    }
    return {
        "goal_text": f"Objetivo: obtener un precio exacto para {topic}.",
        "opening_text": fallback_opening_by_language.get(
            target_language,
            f"Hi. Let's talk about {topic}. What's most important to you?",
        ),
        "opening_translation_text": "",
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

    question_model = str(getattr(settings, "OPENAI_QUESTION_MODEL", settings.OPENAI_MODEL)).strip() or settings.OPENAI_MODEL
    parsed = call_openai_json(
        """
Write a short mistake explanation for a corrected learner sentence.

Return strict JSON:
{
  "explanation": "string"
}

Rules:
- explanation must be in SOURCE language only.
- Keep it concise: one short line.
- Include:
  1) what changed (original -> corrected),
  2) why it is wrong in this context,
  3) one short rule of thumb.
- Focus on TARGET language usage only.
- JSON only.
""".strip(),
        (
            f"Source language: {_language_display_name(source_language)}\n"
            f"Target language: {_language_display_name(target_language)}\n"
            f"{context_label}"
            f"Learner original text ({_language_display_name(target_language)}): {learner_clean}\n"
            f"Corrected text ({_language_display_name(target_language)}): {corrected_clean}\n"
            f"Corrected translation ({_language_display_name(source_language)}): {corrected_source_translation}\n"
        ),
        timeout_seconds=8,
        model=question_model,
        temperature=0.1,
        top_p=1.0,
        presence_penalty=0.0,
    )
    if not isinstance(parsed, dict):
        return ""
    explanation = _ensure_source_language_text(
        str(parsed.get("explanation", "")).strip(),
        source_language=source_language,
    )
    return explanation[:1200]


def _generate_topic_conversation_reply(
    *,
    topic: str,
    notes: str,
    role_text: str,
    goal_text: str,
    user_text: str,
    history: list[dict[str, str]],
    source_language: str,
    target_language: str,
) -> dict[str, str]:
    history_lines: list[str] = []
    for row in history:
        if row.get("user_text"):
            history_lines.append(f"Learner: {row['user_text']}")
        if row.get("assistant_text"):
            history_lines.append(f"Partner: {row['assistant_text']}")

    parsed = call_openai_json(
        """
You are a conversation partner in a live speaking practice.

Return strict JSON:
{
  "reply_text": "string",
  "source_translation": "string",
  "user_source_translation": "string",
  "corrected_user_text": "string",
  "corrected_user_source_translation": "string",
  "corrected_user_explanation": "string"
}

Rules:
- Write reply_text in TARGET language only.
- Write source_translation in SOURCE language only.
- user_source_translation must be SOURCE-language translation of learner input.
- Keep natural peer-to-peer tone, like a regular conversation.
- Do not act like teacher/tutor.
- Do not proactively correct mistakes.
- corrected_user_text must be in TARGET language and only if learner explicitly asks for correction/help.
- corrected_user_source_translation must be in SOURCE language and only for corrected_user_text.
- corrected_user_explanation must be in SOURCE language and only when correction exists.
- corrected_user_explanation must clearly include:
  1) what part changed (original -> corrected),
  2) why the original is wrong in this context,
  3) one short rule of thumb to avoid repeating the mistake.
- Never include correction content inside reply_text.
- Keep reply concise: 1-3 short sentences.
- Keep it aligned with topic, notes, and goal.
- Keep the interaction consistent with learner role when provided.
- You are always the conversation partner, never the learner role.
- If learner role is "customer", reply as staff/seller/service person.
- End with one simple follow-up question.
- JSON only.
""".strip(),
        (
            f"Source language: {_language_display_name(source_language)}\n"
            f"Target language: {_language_display_name(target_language)}\n"
            f"Conversation topic: {topic}\n"
            f"Temporary notes: {notes}\n"
            f"Learner role: {role_text}\n"
            f"Conversation goal: {goal_text}\n"
            f"Recent conversation:\n{chr(10).join(history_lines[-12:])}\n"
            f"Learner new message: {user_text}\n"
        ),
        timeout_seconds=10,
        temperature=0.6,
        top_p=0.9,
        presence_penalty=0.2,
    )
    if isinstance(parsed, dict):
        reply_text = str(parsed.get("reply_text", "")).strip()
        source_translation = _ensure_source_language_text(
            str(parsed.get("source_translation", "")).strip(),
            source_language=source_language,
        )
        user_source_translation = _ensure_source_language_text(
            str(parsed.get("user_source_translation", "")).strip(),
            source_language=source_language,
        )
        corrected_user_text = str(parsed.get("corrected_user_text", "")).strip()
        corrected_user_source_translation = _ensure_source_language_text(
            str(parsed.get("corrected_user_source_translation", "")).strip(),
            source_language=source_language,
        )
        corrected_user_explanation = _ensure_source_language_text(
            str(parsed.get("corrected_user_explanation", "")).strip(),
            source_language=source_language,
        )
        if corrected_user_text:
            refined_explanation = _generate_mistake_explanation_with_question_model(
                source_language=source_language,
                target_language=target_language,
                learner_text=user_text,
                corrected_text=corrected_user_text,
                corrected_source_translation=corrected_user_source_translation,
                context_label=(
                    f"Conversation topic: {topic}\n"
                    f"Temporary notes: {notes}\n"
                    f"Learner role: {role_text}\n"
                    f"Conversation goal: {goal_text}\n"
                ),
            )
            if refined_explanation:
                corrected_user_explanation = refined_explanation
        if reply_text:
            return {
                "reply_text": reply_text[:1200],
                "source_translation": source_translation[:1200],
                "user_source_translation": user_source_translation[:1200],
                "corrected_user_text": corrected_user_text[:1200],
                "corrected_user_source_translation": corrected_user_source_translation[:1200],
                "corrected_user_explanation": corrected_user_explanation[:1200],
            }

    fallback_by_language = {
        "german": "Klingt gut. Kannst du mir ein konkretes Beispiel geben?",
        "spanish": "Suena bien. Puedes darme un ejemplo concreto?",
        "english": "Sounds good. Can you give me one concrete example?",
        "french": "Ca marche. Peux-tu me donner un exemple concret ?",
        "italian": "Va bene. Mi puoi dare un esempio concreto?",
        "portuguese": "Parece bom. Voce pode me dar um exemplo concreto?",
    }
    return {
        "reply_text": fallback_by_language.get(target_language, "Sounds good. Can you give me one concrete example?"),
        "source_translation": "",
        "user_source_translation": "",
        "corrected_user_text": "",
        "corrected_user_source_translation": "",
        "corrected_user_explanation": "",
    }


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


class ContentTopicDeleteView(APIView):
    def delete(self, request: Request) -> Response:
        user = get_request_user(request)
        serializer = ContentTopicSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        topic = serializer.validated_data["topic"].strip()
        source_language = serializer.validated_data.get("source_language", "spanish")
        target_language = serializer.validated_data.get("target_language", "german")

        deleted, _ = apply_user_scope(SavedTopic.objects, user).filter(
            topic=topic,
            source_language=source_language,
            target_language=target_language,
        ).delete()
        if deleted == 0:
            return Response({"detail": "Topic not found"}, status=status.HTTP_404_NOT_FOUND)
        return Response(status=status.HTTP_204_NO_CONTENT)


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
    for turn in raw_turns:
        if not isinstance(turn, dict):
            continue
        source_text = str(turn.get("source_text", "")).strip()
        target_text = str(turn.get("target_text", "")).strip()
        normalized_turns.append({"source_text": source_text, "target_text": target_text})
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
            "phrase_audio_url": phrase_audio_by_key.get(
                (turn["source_text"].lower(), turn["target_text"].lower()),
                "",
            ),
        }
        for turn in normalized_turns
    ]


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


def _ensure_source_language_text(text: str, *, source_language: str) -> str:
    value = str(text or "").strip()
    if not value:
        return ""
    parsed = call_openai_json(
        """
Rewrite the input strictly in SOURCE language.

Return strict JSON:
{
  "text": "string"
}

Rules:
- Output only in SOURCE language.
- Keep the same meaning.
- Keep concise style and similar length.
- JSON only.
""".strip(),
        (
            f"Source language: {_language_display_name(source_language)}\n"
            f"Input text: {value}\n"
        ),
        timeout_seconds=6,
        temperature=0.0,
        top_p=1.0,
        presence_penalty=0.0,
    )
    if isinstance(parsed, dict):
        rewritten = str(parsed.get("text", "")).strip()
        if rewritten:
            return rewritten[:1200]
    return value[:1200]


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
    history_lines: list[str] = []
    for idx, row in enumerate(history_rows, start=1):
        question = str(row.question_text or "").strip()
        answer = str(row.answer_text or "").strip()
        if not question and not answer:
            continue
        history_lines.append(f"{idx}. Learner: {question}")
        history_lines.append(f"{idx}. Tutor: {answer}")
    history_text = "\n".join(history_lines) if history_lines else "(no previous conversation)"

    question_model = str(getattr(settings, "OPENAI_QUESTION_MODEL", settings.OPENAI_MODEL)).strip() or settings.OPENAI_MODEL

    parsed = call_openai_json(
        """
Decide if a learner question is related to learning a specific item.
If related, answer it. If not related, return a rejection code.

Return strict JSON:
{
  "related": true,
  "result_code": "RELATED_OK",
  "answer": "string",
  "reason": "string"
}

Rules:
- If question is related to learning/using/understanding this item, set:
  related=true, result_code="RELATED_OK", and provide concise answer (3 to 6 short lines, A1-A2), reason="".
- If question is NOT related to this item, set:
  related=false, result_code="UNRELATED_QUESTION", answer="", and provide a short reason.
- Assume the learner's primary interest is the TARGET language usage/meaning.
- Do not reinterpret the question as source-language-focused unless the learner explicitly asks for source-language analysis.
- Be permissive with typos, misspellings, partial matches, and paraphrases.
- If the question could reasonably be about this item, treat it as related.
- Questions about words/phrases in either study language can still be related to this item
  when asked in the communicative context of the item.
- Do not assume language from spelling alone. A token may exist in both languages.
- If the learner asks about a word "in {target language}" or within the item context, treat it as related.
- Only mark unrelated when it is clearly about a different domain/topic.
- Do not answer unrelated questions.
- Use full conversation history for context and continuity.
- Keep all explanations/comments focused on TARGET language usage (meaning, grammar, form, pronunciation, and context).
- If examples or forms are included, they should describe TARGET language usage.
- Do not include source-language teaching/explanations.
- The answer text itself must be written in SOURCE language (never in TARGET language).
- Interpret every related question through TARGET language meaning/usage, even when the question text is in SOURCE language.
- Before returning, verify your answer satisfies the previous 5 rules exactly.
- JSON only.
""".strip(),
        (
            f"Question: {question_text}\n"
            f"Study pair: source={_language_display_name(source_language)}, target={_language_display_name(target_language)}\n"
            f"Item being asked about: {item.german_text} ({_language_display_name(target_language)})"
            f" / {item.spanish_text} ({_language_display_name(source_language)})\n"
            f"Item source text ({_language_display_name(source_language)}): {item.spanish_text}\n"
            f"Item target text ({_language_display_name(target_language)}): {item.german_text}\n"
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
        result_code = str(parsed.get("result_code", "")).strip() or ("RELATED_OK" if related else "UNRELATED_QUESTION")
        answer = str(parsed.get("answer", "")).strip()
        reason = str(parsed.get("reason", "")).strip()
        if related:
            if answer:
                return {
                    "related": True,
                    "code": result_code,
                    "answer": answer[:3000],
                    "reason": reason,
                }
            return {
                "related": True,
                "code": "RELATED_FALLBACK",
                "answer": _fallback_item_question_answer(
                    item=item,
                    question_text=question_text,
                    source_language=source_language,
                ),
                "reason": reason,
            }

        # If model says unrelated but question still appears tied to the item, allow it.
        if direct_item_overlap:
            return {
                "related": True,
                "code": "RELATED_OVERLAP_OVERRIDE",
                "answer": _fallback_item_question_answer(
                    item=item,
                    question_text=question_text,
                    source_language=source_language,
                ),
                "reason": reason,
            }

        # Only hard-block explicit unrelated when it is also clearly unrelated by fallback check.
        if result_code == "UNRELATED_QUESTION":
            if _looks_clearly_unrelated(normalized_question):
                return {"related": False, "code": result_code, "answer": "", "reason": reason}
            return {
                "related": True,
                "code": "RELATED_SOFT_OVERRIDE",
                "answer": _fallback_item_question_answer(
                    item=item,
                    question_text=question_text,
                    source_language=source_language,
                ),
                "reason": reason,
            }
        return {
            "related": True,
            "code": "RELATED_AMBIGUOUS_OVERRIDE",
            "answer": _fallback_item_question_answer(
                item=item,
                question_text=question_text,
                source_language=source_language,
            ),
            "reason": reason,
        }

    # If the model classifier is unavailable, block only clearly unrelated questions.
    if _looks_clearly_unrelated(normalized_question):
        return {"related": False, "code": "UNRELATED_FALLBACK", "answer": "", "reason": "fallback clearly unrelated term"}
    return {
        "related": True,
        "code": "RELATED_FALLBACK",
        "answer": _fallback_item_question_answer(
            item=item,
            question_text=question_text,
            source_language=source_language,
        ),
        "reason": "fallback allow",
    }


def _fallback_item_question_answer(*, item: Item, question_text: str, source_language: str) -> str:
    target = item.german_text.strip()
    normalized_question = _normalize_text(question_text)
    if "example" in normalized_question or "ejemplo" in normalized_question:
        base = (
            f"Use {target} in short target-language sentences.\n"
            f"Example 1 ({target}): short everyday use.\n"
            f"Example 2 ({target}): polite conversational use."
        )
        return _ensure_source_language_text(base, source_language=source_language)
    if "grammar" in normalized_question or "gramatica" in normalized_question:
        base = (
            f"Grammar focus for {target} in the target language:\n"
            "Pay attention to article and word order.\n"
            "Keep one sentence pattern and replace one word at a time."
        )
        return _ensure_source_language_text(base, source_language=source_language)
    base = (
        f"Focus on how {target} is used in the target language.\n"
        "Practice pronunciation and one clean sentence pattern.\n"
        "Ask for target-language examples, grammar, or common mistakes."
    )
    return _ensure_source_language_text(base, source_language=source_language)


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
