from __future__ import annotations

import base64
import json
import logging
from pathlib import Path
from uuid import uuid4
from urllib.error import HTTPError, URLError
from urllib.request import Request as UrlRequest, urlopen

from django.conf import settings

from .management import (
    APIView,
    Item,
    Q,
    Request,
    Response,
    _item_question_history,
    _next_review_days,
    _normalized_pair,
    _related_dialogs_by_item_ids,
    apply_user_scope,
    create_audio_file,
    get_request_user,
    status,
    timezone,
)
from .core import generate_funny_image_exercise_phrase_with_chatgpt, generate_word_exercise_phrases_with_chatgpt

logger = logging.getLogger(__name__)
MAX_EXERCISE_PHRASES = 30


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
                "word_type": item.word_type,
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
    try:
        with urlopen(image_url, timeout=int(getattr(settings, "OPENAI_IMAGE_REQUEST_TIMEOUT_SECONDS", 120))) as response:
            return response.read()
    except (HTTPError, URLError, TimeoutError):
        return None


def _generate_openai_image(prompt: str) -> bytes | None:
    api_key = settings.OPENAI_API_KEY
    if not api_key or not prompt.strip():
        return None
    body = {
        "model": str(getattr(settings, "OPENAI_IMAGE_MODEL", "gpt-image-1")).strip() or "gpt-image-1",
        "prompt": prompt,
        "size": str(getattr(settings, "OPENAI_IMAGE_SIZE", "1024x1024")).strip() or "1024x1024",
        "n": 1,
    }
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
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError) as exc:
        logger.warning("content.exercises.image_generation_failed error=%s", exc.__class__.__name__)
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

        generated = generate_word_exercise_phrases_with_chatgpt(
            item.spanish_text,
            item.german_text,
            notes=item.notes or "",
            word_type=item.word_type or "",
            source_language=source_language,
            target_language=target_language,
        )
        cleaned = _sanitize_exercise_payload(generated)
        if not cleaned["phrases"]:
            return Response({"detail": "Exercise generation failed"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        item.exercise_phrases = cleaned
        item.save(update_fields=["exercise_phrases", "updated_at"])
        return Response({"exercise_phrases": cleaned})


class ContentItemFunnyImageExerciseView(APIView):
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
            return Response({"detail": "Image exercises are only available for word items"}, status=status.HTTP_400_BAD_REQUEST)

        phrase = generate_funny_image_exercise_phrase_with_chatgpt(
            item.spanish_text,
            item.german_text,
            notes=item.notes or "",
            word_type=item.word_type or "",
            source_language=source_language,
            target_language=target_language,
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
        image_bytes = _generate_openai_image(final_image_prompt)
        image_url = _save_exercise_image(image_bytes or b"")
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
        return Response({"exercise_phrases": exercise_phrases})
