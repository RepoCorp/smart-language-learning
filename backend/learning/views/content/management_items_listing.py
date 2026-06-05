from __future__ import annotations

import base64
import hashlib
import json
import logging
from pathlib import Path
from uuid import uuid4
from urllib.error import HTTPError, URLError
from urllib.request import Request as UrlRequest, urlopen

from django.conf import settings

from .management import (
    APIView,
    ContentCandidate,
    Item,
    Q,
    Request,
    Response,
    _basic_word_metadata,
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
from ...models import DialogTurn, ItemDialogOccurrence, SavedDialog
from .core import (
    generate_funny_image_exercise_phrase_with_chatgpt,
    generate_word_exercise_phrases_with_chatgpt,
    normalize_word_type,
    save_word_dialog_occurrences,
)

logger = logging.getLogger(__name__)


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
        dialog_phrase_answer, dialog_phrase_scene, dialog_phrase_scene_audio_urls, dialog_phrase_options = _dialog_phrase_options_for_item(item, user=user)
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
                "dialog_phrase_answer": dialog_phrase_answer,
                "dialog_phrase_scene": dialog_phrase_scene,
                "dialog_phrase_scene_audio_urls": dialog_phrase_scene_audio_urls,
                "dialog_phrase_options": dialog_phrase_options,
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


def _dialog_phrase_options_for_item(item: Item, *, user) -> tuple[str, str, list[str], list[str]]:
    if item.item_type != Item.ItemType.PHRASE:
        return "", "", [], []

    occurrences = list(
        apply_user_scope(ItemDialogOccurrence.objects, user, field="item__user")
        .filter(item=item)
        .select_related("dialog", "turn")
    )
    origin_dialog_ids = {occurrence.dialog_id for occurrence in occurrences}
    adjacent_scenes: list[tuple[str, str, tuple[str, ...]]] = []
    for occurrence in occurrences:
        adjacent_turns = DialogTurn.objects.filter(
            dialog=occurrence.dialog,
            turn_index__in=[occurrence.turn_index - 1, occurrence.turn_index + 1],
        ).order_by("turn_index")
        for turn in adjacent_turns:
            source_text = turn.source_text.strip()
            target_text = turn.target_text.strip()
            if source_text and target_text and source_text.lower() != item.spanish_text.lower():
                scene_lines = (
                    [target_text, item.german_text]
                    if turn.turn_index < occurrence.turn_index
                    else [item.german_text, target_text]
                )
                current_audio_url = _phrase_audio_url_for_turn(occurrence.turn, user=user, fallback_item=item)
                adjacent_audio_url = _phrase_audio_url_for_turn(turn, user=user)
                audio_urls = (
                    [adjacent_audio_url, current_audio_url]
                    if turn.turn_index < occurrence.turn_index
                    else [current_audio_url, adjacent_audio_url]
                )
                adjacent_scenes.append((source_text, "\n".join(scene_lines), tuple(audio_url for audio_url in audio_urls if audio_url)))
    adjacent_scenes = list(dict.fromkeys(adjacent_scenes))
    deterministic_scene = _deterministic_choice(
        adjacent_scenes,
        seed=f"phrase-scene:{item.item_type}:{item.spanish_text}:{item.german_text}",
        key_fn=lambda scene: f"{scene[0]}|{scene[1]}|{'|'.join(scene[2])}",
    )
    correct_answer, correct_scene, correct_audio_urls = deterministic_scene if deterministic_scene else ("", "", ())
    if not correct_answer:
        return "", "", [], []

    turns = apply_user_scope(DialogTurn.objects, user, field="dialog__user").filter(
        dialog__source_language=item.source_language,
        dialog__target_language=item.target_language,
    )
    if origin_dialog_ids:
        turns = turns.exclude(dialog_id__in=origin_dialog_ids)
    source_answers = list(
        turns.exclude(source_text__iexact=item.spanish_text)
        .exclude(target_text__iexact=item.german_text)
        .exclude(source_text__iexact=correct_answer)
        .values_list("source_text", flat=True)
    )
    distractors = list(dict.fromkeys(answer.strip() for answer in source_answers if answer and answer.strip()))
    distractors = [answer for answer in distractors if answer.lower() != correct_answer.lower()]
    sorted_distractors = _deterministic_sort(
        distractors,
        seed=f"text-distractors:{correct_answer}",
        key_fn=lambda answer: answer,
    )
    choices = sorted_distractors[:3] + [correct_answer]
    choices = _deterministic_sort(
        choices,
        seed=f"text-choices:{correct_answer}",
        key_fn=lambda answer: answer,
    )
    return correct_answer, correct_scene, list(correct_audio_urls), choices


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
        should_refresh_metadata = (
            not normalized_word_type
            or (
                normalized_word_type == "noun"
                and (
                    not _text_has_article(item.spanish_text, source_language)
                    or not _text_has_article(item.german_text, target_language)
                )
            )
        )
        if should_refresh_metadata:
            try:
                resolved_source, resolved_target, resolved_word_type = _basic_word_metadata(
                    source_text=item.spanish_text,
                    target_text=item.german_text,
                    source_language=source_language,
                    target_language=target_language,
                    source_line="",
                    target_line=item.example_sentence or "",
                )
            except RuntimeError:
                return Response({"detail": "Word metadata generation failed"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
            resolved_word_type = normalize_word_type(resolved_word_type)
            if not resolved_word_type:
                return Response({"detail": "Word metadata is incomplete"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
            if normalized_word_type and resolved_word_type != normalized_word_type:
                return Response({"detail": "Word metadata type mismatch"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
            if resolved_word_type == "noun":
                normalized_source = _normalize_spacing(resolved_source)
                normalized_target = _normalize_spacing(resolved_target)
                source_needs_article = not _text_has_article(item.spanish_text, source_language)
                target_needs_article = not _text_has_article(item.german_text, target_language)
                if source_needs_article and not _text_has_article(normalized_source, source_language):
                    return Response({"detail": "Word metadata is missing source article"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
                if target_needs_article and not _text_has_article(normalized_target, target_language):
                    return Response({"detail": "Word metadata is missing target article"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
                if (
                    normalized_source
                    and _text_has_article(normalized_source, source_language)
                    and normalized_source != item.spanish_text
                ):
                    item.spanish_text = normalized_source
                    word_text_updated = True
                if (
                    normalized_target
                    and _text_has_article(normalized_target, target_language)
                    and normalized_target != item.german_text
                ):
                    item.german_text = normalized_target
                    word_text_updated = True
            if not normalized_word_type:
                item.word_type = resolved_word_type
                word_type_added = True

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
        )
        cleaned = _sanitize_exercise_payload(generated)
        if not cleaned["phrases"]:
            return Response({"detail": "Exercise generation failed"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        item.exercise_phrases = cleaned
        update_fields = ["exercise_phrases", "updated_at"]
        if word_type_added:
            update_fields.append("word_type")
        if word_text_updated:
            update_fields.extend(["spanish_text", "german_text"])
        item.save(update_fields=update_fields)

        related_dialogs_map = _related_dialogs_by_item_ids([item.id], per_item_limit=12, user=user)
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

        _scan_all_dialogs_for_word(
            user=user,
            item=item,
            source_language=source_language,
            target_language=target_language,
        )
        phrase = generate_funny_image_exercise_phrase_with_chatgpt(
            item.spanish_text,
            item.german_text,
            notes=item.notes or "",
            word_type=item.word_type or "",
            source_language=source_language,
            target_language=target_language,
            target_contexts=_target_contexts_for_word_exercises(user=user, item=item),
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
