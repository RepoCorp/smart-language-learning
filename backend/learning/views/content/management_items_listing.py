from __future__ import annotations

import base64
import hashlib
import json
import logging
from pathlib import Path
import time
from uuid import uuid4
from urllib.error import HTTPError, URLError
from urllib.request import Request as UrlRequest, urlopen

from django.conf import settings
from django.db.models import Q

from .management import (
    APIView,
    Request,
    Response,
    _next_review_days,
    _normalized_pair,
    apply_user_scope,
    get_request_user,
    status,
    timezone,
)
from .dialog_item_context import related_dialogs_by_item_ids
from .item_questions import item_question_history
from .types import ContentCandidate
from .word_metadata import basic_word_metadata as _basic_word_metadata
from ...models import DialogTurn, Item, ItemDialogOccurrence, SavedDialog
from ..dialog_phrase_match import build_dialog_phrase_match_payload
from .core import (
    create_audio_file,
    generate_funny_image_exercise_phrase_with_chatgpt,
    generate_word_exercise_phrases_with_chatgpt,
    normalize_word_type,
    save_word_dialog_occurrences,
)

logger = logging.getLogger(__name__)

DEFAULT_MANAGE_PAGE_SIZE = 25
MAX_MANAGE_PAGE_SIZE = 100


def _safe_positive_int(raw_value, default: int, *, minimum: int = 1, maximum: int | None = None) -> int:
    try:
        parsed = int(str(raw_value))
    except (TypeError, ValueError):
        return default
    parsed = max(minimum, parsed)
    if maximum is not None:
        parsed = min(maximum, parsed)
    return parsed


def _deterministic_hash(*parts: object) -> str:
    normalized = "||".join(str(part).strip().lower() for part in parts)
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def _deterministic_sort(values: list, *, seed: str, key_fn) -> list:
    decorated = [
        (f"{_deterministic_hash(seed, key_fn(value), index)}", index, value)
        for index, value in enumerate(values)
    ]
    decorated.sort(key=lambda entry: (entry[0], entry[1]))
    return [value for _, _, value in decorated]


def _deterministic_choice(values: list, *, seed: str, key_fn):
    if not values:
        return None
    return _deterministic_sort(values, seed=seed, key_fn=key_fn)[0]
MAX_EXERCISE_PHRASES = 30
ARTICLES_BY_LANGUAGE = {
    "spanish": {"el", "la", "los", "las", "un", "una", "unos", "unas"},
    "german": {"der", "die", "das", "den", "dem", "des", "ein", "eine", "einen", "einem", "einer", "eines"},
}


def _compare_words_payload(item: Item) -> list[dict]:
    if item.item_type != Item.ItemType.WORD:
        return []
    linked_words = list(
        item.confusing_with.filter(item_type=Item.ItemType.WORD)
        .order_by("german_text", "spanish_text", "id")
        .values(
            "id",
            "item_type",
            "spanish_text",
            "german_text",
            "word_type",
            "audio_url",
            "exercise_phrases",
            "created_at",
        )
    )
    return linked_words


def _word_refresh_model() -> str:
    configured = str(getattr(settings, "OPENAI_WORD_REFRESH_MODEL", "")).strip()
    if configured:
        return configured
    question_model = str(getattr(settings, "OPENAI_QUESTION_MODEL", "")).strip()
    if question_model:
        return question_model
    return str(getattr(settings, "OPENAI_MODEL", "gpt-4o-mini")).strip() or "gpt-4o-mini"


def _word_refresh_reasoning_effort() -> str:
    configured = str(getattr(settings, "OPENAI_WORD_REFRESH_REASONING_EFFORT", "")).strip()
    if configured:
        return configured
    return str(getattr(settings, "OPENAI_REASONING_EFFORT", "")).strip()


class ContentItemsView(APIView):
    def get(self, request: Request) -> Response:
        user = get_request_user(request)
        source_language, target_language = _normalized_pair(request)
        now = timezone.now()
        section = (request.query_params.get("section", "all") or "all").strip().lower()
        query = (request.query_params.get("q", "") or "").strip()
        page = _safe_positive_int(request.query_params.get("page"), 1)
        page_size = _safe_positive_int(request.query_params.get("page_size"), DEFAULT_MANAGE_PAGE_SIZE, maximum=MAX_MANAGE_PAGE_SIZE)
        offset = (page - 1) * page_size

        queryset = apply_user_scope(Item.objects, user).filter(
            source_language=source_language,
            target_language=target_language,
        )
        if section == "words":
            queryset = queryset.filter(item_type=Item.ItemType.WORD)
        elif section == "phrases":
            queryset = queryset.filter(item_type=Item.ItemType.PHRASE)
        if query:
            queryset = queryset.filter(Q(spanish_text__icontains=query) | Q(german_text__icontains=query))

        rows = list(queryset.order_by("-created_at", "-id")[offset : offset + page_size + 1])
        has_more = len(rows) > page_size
        rows = rows[:page_size]
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
        return Response({
            "items": items,
            "page": page,
            "page_size": page_size,
            "has_more": has_more,
            "next_page": page + 1 if has_more else None,
            "section": section,
            "query": query,
        })


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
            words_queryset = words_queryset.filter(Q(spanish_text__icontains=query) | Q(german_text__icontains=query))

        words = list(
            words_queryset.order_by("-created_at", "-id").values(
                "id",
                "item_type",
                "spanish_text",
                "german_text",
                "example_sentence",
                "notes",
                "word_type",
                "audio_url",
                "created_at",
            )[:1000]
        )
        item_ids = [word["id"] for word in words]
        related_dialogs_map = related_dialogs_by_item_ids(item_ids, user=user)
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

        related_dialogs_map = related_dialogs_by_item_ids([item.id], per_item_limit=12, user=user)
        dialog_phrase_payload = _dialog_phrase_options_for_item(item, user=user)
        return Response(
            {
                "id": item.id,
                "item_type": item.item_type,
                "spanish_text": item.spanish_text,
                "german_text": item.german_text,
                "example_sentence": item.example_sentence,
                "notes": item.notes,
                "word_type": item.word_type,
                "audio_url": item.audio_url,
                "exercise_phrases": item.exercise_phrases or {},
                "created_at": item.created_at,
                "dialog_phrase_answer": dialog_phrase_payload["answer"],
                "dialog_phrase_scene": dialog_phrase_payload["scene"],
                "dialog_phrase_scene_audio_urls": dialog_phrase_payload["scene_audio_urls"],
                "dialog_phrase_options": dialog_phrase_payload["options"],
                "dialog_phrase_turns": dialog_phrase_payload["turns"],
                "dialog_phrase_odd_index": dialog_phrase_payload["odd_index"],
                "related_dialogs": related_dialogs_map.get(item.id, []),
                "compare_words": _compare_words_payload(item),
                "item_questions": item_question_history(item),
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


def _dialog_phrase_options_for_item(item: Item, *, user) -> dict:
    return build_dialog_phrase_match_payload(item, user=user)


class ContentItemCompareWordsSearchView(APIView):
    def get(self, request: Request, item_id: int) -> Response:
        user = get_request_user(request)
        source_language, target_language = _normalized_pair(request)
        query = (request.query_params.get("q", "") or "").strip()
        page = _safe_positive_int(request.query_params.get("page"), 1)
        page_size = _safe_positive_int(request.query_params.get("page_size"), 10, maximum=50)
        offset = (page - 1) * page_size
        item = apply_user_scope(Item.objects, user).filter(
            id=item_id,
            item_type=Item.ItemType.WORD,
            source_language=source_language,
            target_language=target_language,
        ).first()
        if not item:
            return Response({"detail": "Item not found"}, status=status.HTTP_404_NOT_FOUND)

        linked_ids = set(item.confusing_with.values_list("id", flat=True))
        queryset = apply_user_scope(Item.objects, user).filter(
            item_type=Item.ItemType.WORD,
            source_language=source_language,
            target_language=target_language,
        ).exclude(id=item.id)
        if linked_ids:
            queryset = queryset.exclude(id__in=linked_ids)
        if query:
            queryset = queryset.filter(Q(spanish_text__icontains=query) | Q(german_text__icontains=query))

        rows = list(
            queryset.order_by("german_text", "spanish_text", "id")
            .values("id", "item_type", "spanish_text", "german_text", "word_type", "audio_url", "created_at")[offset : offset + page_size + 1]
        )
        has_more = len(rows) > page_size
        rows = rows[:page_size]
        return Response({
            "items": rows,
            "page": page,
            "page_size": page_size,
            "has_more": has_more,
            "next_page": page + 1 if has_more else None,
            "query": query,
        })


class ContentItemCompareWordsView(APIView):
    def post(self, request: Request, item_id: int) -> Response:
        user = get_request_user(request)
        source_language, target_language = _normalized_pair(request)
        item = apply_user_scope(Item.objects, user).filter(
            id=item_id,
            item_type=Item.ItemType.WORD,
            source_language=source_language,
            target_language=target_language,
        ).first()
        if not item:
            return Response({"detail": "Item not found"}, status=status.HTTP_404_NOT_FOUND)

        raw_word_ids = request.data.get("word_ids", [])
        if not isinstance(raw_word_ids, list):
            return Response({"detail": "word_ids must be a list"}, status=status.HTTP_400_BAD_REQUEST)

        requested_ids: list[int] = []
        for raw_id in raw_word_ids:
            try:
                parsed_id = int(raw_id)
            except (TypeError, ValueError):
                continue
            if parsed_id > 0 and parsed_id != item.id and parsed_id not in requested_ids:
                requested_ids.append(parsed_id)

        if requested_ids:
            linked_items = list(
                apply_user_scope(Item.objects, user).filter(
                    id__in=requested_ids,
                    item_type=Item.ItemType.WORD,
                    source_language=source_language,
                    target_language=target_language,
                )
            )
            item.confusing_with.add(*linked_items)

        item.refresh_from_db()
        return Response({"compare_words": _compare_words_payload(item)})


class ContentItemCompareWordDetailView(APIView):
    def delete(self, request: Request, item_id: int, linked_item_id: int) -> Response:
        user = get_request_user(request)
        source_language, target_language = _normalized_pair(request)
        item = apply_user_scope(Item.objects, user).filter(
            id=item_id,
            item_type=Item.ItemType.WORD,
            source_language=source_language,
            target_language=target_language,
        ).first()
        if not item:
            return Response({"detail": "Item not found"}, status=status.HTTP_404_NOT_FOUND)

        linked_item = apply_user_scope(Item.objects, user).filter(
            id=linked_item_id,
            item_type=Item.ItemType.WORD,
            source_language=source_language,
            target_language=target_language,
        ).first()
        if not linked_item:
            return Response({"detail": "Linked item not found"}, status=status.HTTP_404_NOT_FOUND)

        item.confusing_with.remove(linked_item)
        item.refresh_from_db()
        return Response({"compare_words": _compare_words_payload(item)})


def _phrase_audio_url_for_turn(turn: DialogTurn, *, user, fallback_item: Item | None = None) -> str:
    turn_audio_url = str(turn.audio_url or "").strip()
    if turn_audio_url:
        return turn_audio_url
    if fallback_item and str(fallback_item.audio_url or "").strip():
        return str(fallback_item.audio_url or "").strip()
    phrase_item = apply_user_scope(Item.objects, user).filter(
        item_type=Item.ItemType.PHRASE,
        source_language=turn.dialog.source_language,
        target_language=turn.dialog.target_language,
        spanish_text__iexact=turn.source_text.strip(),
        german_text__iexact=turn.target_text.strip(),
    ).first()
    return str(phrase_item.audio_url or "").strip() if phrase_item else ""


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


class ContentItemRefreshWordView(APIView):
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
        if item.item_type != Item.ItemType.WORD:
            return Response({"detail": "Refresh is only available for word items"}, status=status.HTTP_400_BAD_REQUEST)

        word_type_added = False
        word_text_updated = False
        normalized_word_type = normalize_word_type(item.word_type)
        refresh_model = _word_refresh_model()
        refresh_reasoning_effort = _word_refresh_reasoning_effort()
        try:
            resolved_source, resolved_target, resolved_word_type = _basic_word_metadata(
                source_text="",
                target_text=_refresh_target_clicked_token(item.german_text, target_language),
                source_language=source_language,
                target_language=target_language,
                source_line="",
                target_line=item.example_sentence or "",
                model=refresh_model,
                reasoning_effort=refresh_reasoning_effort,
            )
        except RuntimeError:
            return Response({"detail": "Word metadata generation failed"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        resolved_word_type = normalize_word_type(resolved_word_type)
        if not resolved_word_type:
            return Response({"detail": "Word metadata is incomplete"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        normalized_source = _normalize_spacing(resolved_source)
        normalized_target = _normalize_spacing(resolved_target)
        if resolved_word_type == "noun":
            if not _text_has_article(normalized_source, source_language):
                return Response({"detail": "Word metadata is missing source article"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
            if not _text_has_article(normalized_target, target_language):
                return Response({"detail": "Word metadata is missing target article"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        if normalized_source and normalized_source != item.spanish_text:
            item.spanish_text = normalized_source
            word_text_updated = True
        if normalized_target and normalized_target != item.german_text:
            item.german_text = normalized_target
            word_text_updated = True
        word_type_updated = item.word_type != resolved_word_type
        if item.word_type != resolved_word_type:
            word_type_added = not normalized_word_type
            item.word_type = resolved_word_type

        if word_type_added or word_type_updated or word_text_updated:
            metadata_update_fields = ["updated_at"]
            if word_type_added or word_type_updated:
                metadata_update_fields.append("word_type")
            if word_text_updated:
                metadata_update_fields.extend(["spanish_text", "german_text"])
            item.save(update_fields=metadata_update_fields)

        dialog_occurrences_created = _scan_all_dialogs_for_word(
            user=user,
            item=item,
            source_language=source_language,
            target_language=target_language,
        )
        generated = generate_word_exercise_phrases_with_chatgpt(
            item.spanish_text,
            item.german_text,
            notes=item.notes or "",
            word_type=item.word_type or "",
            source_language=source_language,
            target_language=target_language,
            target_contexts=_target_contexts_for_word_exercises(user=user, item=item),
            model=refresh_model,
            reasoning_effort=refresh_reasoning_effort,
        )
        cleaned = _sanitize_exercise_payload(generated)
        if not cleaned["phrases"]:
            return Response({"detail": "Exercise generation failed"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        item.exercise_phrases = cleaned
        item.save(update_fields=["exercise_phrases", "updated_at"])

        related_dialogs_map = related_dialogs_by_item_ids([item.id], per_item_limit=12, user=user)
        return Response(
            {
                "ok": True,
                "spanish_text": item.spanish_text,
                "german_text": item.german_text,
                "word_type": item.word_type,
                "word_type_added": word_type_added,
                "word_text_updated": word_text_updated,
                "exercise_phrases": cleaned,
                "dialog_occurrences_created": dialog_occurrences_created,
                "related_dialogs": related_dialogs_map.get(item.id, []),
            }
        )


def _text_has_article(text: str, language: str) -> bool:
    first = text.strip().split(" ", 1)[0].lower() if text.strip() else ""
    return first in ARTICLES_BY_LANGUAGE.get(language, set())


def _normalize_spacing(text: str) -> str:
    return " ".join((text or "").split()).strip()


def _refresh_target_clicked_token(text: str, language: str) -> str:
    normalized = _normalize_spacing(text)
    if not normalized:
        return ""
    parts = normalized.split(" ", 1)
    if parts[0].lower() in ARTICLES_BY_LANGUAGE.get(language, set()):
        return parts[1].strip() if len(parts) == 2 else ""
    return normalized


def _scan_all_dialogs_for_word(
    *,
    user,
    item: Item,
    source_language: str,
    target_language: str,
) -> int:
    candidate = ContentCandidate(
        spanish_text=item.spanish_text,
        german_text=item.german_text,
        exists=True,
        word_type=item.word_type or "",
    )
    created = 0
    dialogs = apply_user_scope(SavedDialog.objects, user).filter(
        source_language=source_language,
        target_language=target_language,
    )
    for dialog in dialogs.order_by("id"):
        turns = list(DialogTurn.objects.filter(dialog=dialog).order_by("turn_index", "id"))
        if not turns:
            continue
        created += save_word_dialog_occurrences(
            user=user,
            dialog=dialog,
            turns=turns,
            word_candidates=[candidate],
            source_language=source_language,
            target_language=target_language,
        )
    return created


def _target_contexts_for_word_exercises(*, user, item: Item, limit: int = 1) -> list[str]:
    occurrences = (
        apply_user_scope(ItemDialogOccurrence.objects, user, field="item__user")
        .filter(item=item)
        .select_related("turn")
        .order_by("-match_score", "created_at", "id")
    )
    contexts: list[str] = []
    seen: set[str] = set()
    for occurrence in occurrences:
        target_text = _normalize_spacing(occurrence.turn.target_text)
        if not target_text:
            continue
        key = target_text.casefold()
        if key in seen:
            continue
        seen.add(key)
        contexts.append(target_text)
        if len(contexts) >= limit:
            break
    return contexts


def _sanitize_exercise_entries(value) -> list[dict[str, str]]:
    if not isinstance(value, list):
        return []
    entries: list[dict[str, str]] = []
    for entry in value:
        if not isinstance(entry, dict):
            continue
        source_text = str(entry.get("source_text", "")).strip()
        target_text = str(entry.get("target_text", "")).strip()
        label = str(entry.get("label", "")).strip()
        if not source_text or not target_text:
            continue
        entries.append({"label": label, "source_text": source_text, "target_text": target_text})
        if len(entries) >= MAX_EXERCISE_PHRASES:
            break
    return entries


def _sanitize_exercise_payload(payload) -> dict:
    if not isinstance(payload, dict):
        return {"phrases": []}
    phrases = _sanitize_exercise_entries(payload.get("phrases"))
    if not phrases:
        phrases = [
            *_sanitize_exercise_entries(payload.get("first_section")),
            *_sanitize_exercise_entries(payload.get("second_section")),
        ]
    cleaned = {"phrases": phrases[:MAX_EXERCISE_PHRASES]}
    generation_mode = str(payload.get("generation_mode", "")).strip()
    if generation_mode:
        cleaned["generation_mode"] = generation_mode
    return cleaned


def _build_local_image_url(filename: str) -> str:
    relative_url = f"{settings.MEDIA_URL.rstrip('/')}/exercise-images/{filename}"
    return f"{settings.APP_BASE_URL.rstrip('/')}{relative_url}"


def _build_s3_image_url(key: str) -> str:
    explicit_base_url = str(getattr(settings, "AWS_S3_IMAGE_BASE_URL", "")).strip().rstrip("/")
    if explicit_base_url:
        normalized_key = key.lstrip("/")
        prefix = str(getattr(settings, "AWS_S3_IMAGE_PREFIX", "exercise-images")).strip().strip("/")
        if prefix:
            base_suffix = f"/{prefix.lower()}"
            key_prefix = f"{prefix.lower()}/"
            if explicit_base_url.lower().endswith(base_suffix) and normalized_key.lower().startswith(key_prefix):
                normalized_key = normalized_key[len(prefix) + 1 :]
        return f"{explicit_base_url}/{normalized_key}"

    bucket = str(getattr(settings, "AWS_S3_IMAGE_BUCKET", "")).strip()
    region = str(getattr(settings, "AWS_S3_IMAGE_REGION", "")).strip()
    if region:
        return f"https://{bucket}.s3.{region}.amazonaws.com/{key}"
    return f"https://{bucket}.s3.amazonaws.com/{key}"


def _save_exercise_image(image_bytes: bytes) -> str:
    if not image_bytes:
        return ""
    filename = f"exercise-image-{uuid4().hex}.png"
    storage_backend = str(getattr(settings, "IMAGE_STORAGE_BACKEND", "local")).strip().lower()
    if storage_backend == "s3":
        bucket = str(getattr(settings, "AWS_S3_IMAGE_BUCKET", "")).strip()
        if not bucket:
            logger.warning("content.exercises.image_failed_s3 reason=missing_bucket filename=%s", filename)
            return ""

        prefix = str(getattr(settings, "AWS_S3_IMAGE_PREFIX", "exercise-images")).strip().strip("/")
        key = f"{prefix}/{filename}" if prefix else filename

        try:
            import boto3
        except Exception:
            logger.warning("content.exercises.image_failed_s3 reason=missing_boto3 filename=%s", filename)
            return ""

        s3_client_kwargs: dict[str, str] = {}
        region = str(getattr(settings, "AWS_S3_IMAGE_REGION", "")).strip()
        if region:
            s3_client_kwargs["region_name"] = region

        logger.info(
            "content.exercises.image_s3_upload_started filename=%s bucket=%s key=%s bytes=%d region=%s",
            filename,
            bucket,
            key,
            len(image_bytes),
            region or "default",
        )
        try:
            boto3.client("s3", **s3_client_kwargs).put_object(
                Bucket=bucket,
                Key=key,
                Body=image_bytes,
                ContentType="image/png",
            )
        except Exception as exc:
            logger.warning(
                "content.exercises.image_failed_s3_upload filename=%s bucket=%s key=%s error=%s",
                filename,
                bucket,
                key,
                exc.__class__.__name__,
            )
            return ""

        logger.info("content.exercises.image_s3_upload_succeeded filename=%s bucket=%s key=%s", filename, bucket, key)
        return _build_s3_image_url(key)

    image_dir = Path(settings.MEDIA_ROOT) / "exercise-images"
    image_dir.mkdir(parents=True, exist_ok=True)
    (image_dir / filename).write_bytes(image_bytes)
    return _build_local_image_url(filename)


def _download_image_url(image_url: str) -> bytes | None:
    if not image_url:
        return None
    started_at = time.perf_counter()
    try:
        with urlopen(image_url, timeout=int(getattr(settings, "OPENAI_IMAGE_REQUEST_TIMEOUT_SECONDS", 120))) as response:
            image_bytes = response.read()
            logger.info(
                "content.exercises.image_download_succeeded elapsed_ms=%d bytes=%d",
                round((time.perf_counter() - started_at) * 1000),
                len(image_bytes),
            )
            return image_bytes
    except (HTTPError, URLError, TimeoutError):
        logger.warning(
            "content.exercises.image_download_failed elapsed_ms=%d",
            round((time.perf_counter() - started_at) * 1000),
        )
        return None


def _generate_openai_image(prompt: str) -> bytes | None:
    api_key = settings.OPENAI_API_KEY
    if not api_key or not prompt.strip():
        return None
    body = {
        "model": str(getattr(settings, "OPENAI_IMAGE_MODEL", "gpt-image-1")).strip() or "gpt-image-1",
        "prompt": prompt,
        "size": str(getattr(settings, "OPENAI_FUNNY_IMAGE_SIZE", getattr(settings, "OPENAI_IMAGE_SIZE", "1024x1024"))).strip() or "1024x1024",
        "n": 1,
    }
    attempt_started_at = time.perf_counter()
    request = UrlRequest(
        "https://api.openai.com/v1/images/generations",
        data=json.dumps(body).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urlopen(request, timeout=int(getattr(settings, "OPENAI_IMAGE_REQUEST_TIMEOUT_SECONDS", 120))) as response:
            payload = json.loads(response.read().decode("utf-8"))
            logger.info(
                "content.exercises.image_generation_succeeded model=%s size=%s elapsed_ms=%d",
                body["model"],
                body["size"],
                round((time.perf_counter() - attempt_started_at) * 1000),
            )
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError) as exc:
        error_details: dict[str, object] = {
            "error_class": exc.__class__.__name__,
            "model": body["model"],
            "size": body["size"],
            "elapsed_ms": round((time.perf_counter() - attempt_started_at) * 1000),
        }
        if isinstance(exc, HTTPError):
            try:
                error_details["response_body"] = exc.read().decode("utf-8", errors="replace")
            except Exception:
                error_details["response_body"] = ""
            error_details["http_status"] = exc.code
            error_details["http_reason"] = exc.reason
        elif isinstance(exc, URLError):
            error_details["url_error_reason"] = str(getattr(exc, "reason", ""))
        logger.warning("content.exercises.image_generation_attempt_failed details=%s", json.dumps(error_details, ensure_ascii=False))
        return None

    try:
        image_payload = payload["data"][0]
    except (KeyError, IndexError, TypeError):
        return None
    b64_json = str(image_payload.get("b64_json", "")).strip() if isinstance(image_payload, dict) else ""
    if b64_json:
        try:
            return base64.b64decode(b64_json)
        except ValueError:
            return None
    image_url = str(image_payload.get("url", "")).strip() if isinstance(image_payload, dict) else ""
    return _download_image_url(image_url)


class ContentItemExercisesView(APIView):
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
        if item.item_type != Item.ItemType.WORD:
            return Response({"detail": "Exercises are only available for word items"}, status=status.HTTP_400_BAD_REQUEST)

        _scan_all_dialogs_for_word(
            user=user,
            item=item,
            source_language=source_language,
            target_language=target_language,
        )
        generated = generate_word_exercise_phrases_with_chatgpt(
            item.spanish_text,
            item.german_text,
            notes=item.notes or "",
            word_type=item.word_type or "",
            source_language=source_language,
            target_language=target_language,
            target_contexts=_target_contexts_for_word_exercises(user=user, item=item),
        )
        cleaned = _sanitize_exercise_payload(generated)
        if not cleaned["phrases"]:
            return Response({"detail": "Exercise generation failed"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        item.exercise_phrases = cleaned
        item.save(update_fields=["exercise_phrases", "updated_at"])
        return Response({"exercise_phrases": cleaned})


class ContentItemFunnyImageExerciseView(APIView):
    def post(self, request: Request, item_id: int) -> Response:
        request_started_at = time.perf_counter()
        user = get_request_user(request)
        source_language, target_language = _normalized_pair(request)
        item = apply_user_scope(Item.objects, user).filter(
            id=item_id,
            source_language=source_language,
            target_language=target_language,
        ).first()
        if not item:
            return Response({"detail": "Item not found"}, status=status.HTTP_404_NOT_FOUND)
        if item.item_type != Item.ItemType.WORD:
            return Response({"detail": "Image exercises are only available for word items"}, status=status.HTTP_400_BAD_REQUEST)

        phrase_started_at = time.perf_counter()
        phrase = generate_funny_image_exercise_phrase_with_chatgpt(
            item.spanish_text,
            item.german_text,
            notes=item.notes or "",
            word_type=item.word_type or "",
            source_language=source_language,
            target_language=target_language,
            target_contexts=_target_contexts_for_word_exercises(user=user, item=item),
        )
        logger.info(
            "content.exercises.funny_image_phrase_finished item_id=%s elapsed_ms=%d success=%s",
            item.id,
            round((time.perf_counter() - phrase_started_at) * 1000),
            bool(phrase),
        )
        if not phrase:
            return Response({"detail": "Funny image phrase generation failed"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        target_text = str(phrase.get("target_text", "")).strip()
        final_image_prompt = (
            "Create a funny, playful, safe illustration of this simple language-learning phrase.\n"
            f'Phrase: "{target_text}"\n'
            "The scene should clearly correspond to the phrase, with a humorous visual implementation of the literal meaning.\n"
            f'Visibly include the exact phrase text in the image: "{target_text}".'
        ).strip()
        image_started_at = time.perf_counter()
        image_bytes = _generate_openai_image(final_image_prompt)
        logger.info(
            "content.exercises.funny_image_generation_finished item_id=%s elapsed_ms=%d bytes=%d",
            item.id,
            round((time.perf_counter() - image_started_at) * 1000),
            len(image_bytes or b""),
        )
        save_started_at = time.perf_counter()
        image_url = _save_exercise_image(image_bytes or b"")
        logger.info(
            "content.exercises.funny_image_save_finished item_id=%s elapsed_ms=%d success=%s",
            item.id,
            round((time.perf_counter() - save_started_at) * 1000),
            bool(image_url),
        )
        if not image_url:
            return Response({"detail": "Funny image generation failed"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        funny_image_phrase = {
            "label": "funny image",
            "source_text": str(phrase.get("source_text", "")).strip(),
            "target_text": target_text,
            "image_url": image_url,
            "image_prompt": final_image_prompt,
        }
        exercise_phrases = dict(item.exercise_phrases or {})
        exercise_phrases["funny_image_phrase"] = funny_image_phrase
        item.exercise_phrases = exercise_phrases
        item.save(update_fields=["exercise_phrases", "updated_at"])
        logger.info(
            "content.exercises.funny_image_request_finished item_id=%s elapsed_ms=%d",
            item.id,
            round((time.perf_counter() - request_started_at) * 1000),
        )
        return Response({"exercise_phrases": exercise_phrases})
