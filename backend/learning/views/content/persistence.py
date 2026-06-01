from __future__ import annotations

import io
import json
import logging
import re
import wave
from concurrent.futures import Future, ThreadPoolExecutor
from pathlib import Path
from random import sample
from uuid import uuid4
from urllib.error import HTTPError, URLError
from urllib.request import Request as UrlRequest, urlopen

from django.conf import settings

from ...auth import apply_user_scope
from ...models import DialogTurn, Item, ItemDialogOccurrence, SavedDialog
from .selection import word_selection_id
from .types import ContentCandidate, ContentPlan

logger = logging.getLogger(__name__)
OPENAI_TTS_ITEM_VOICE_BY_STUDY_LANGUAGE = {
    "spanish": "nova",
    "english": "alloy",
    "german": "onyx",
    "french": "shimmer",
    "italian": "echo",
    "portuguese": "fable",
}
OPENAI_TTS_LANGUAGE_LABEL_BY_STUDY_LANGUAGE = {
    "spanish": "Spanish",
    "english": "English",
    "german": "German",
    "french": "French",
    "italian": "Italian",
    "portuguese": "Portuguese",
}
OPENAI_TTS_VOICES = ("alloy", "echo", "fable", "onyx", "nova", "shimmer")
OPENAI_TTS_SAMPLE_RATE = 24000
OPENAI_TTS_DEFAULT_SPEED = 1.25
OPENAI_TTS_ITEM_DEFAULT_SPEED = 1.0
WORD_TYPE_CHOICES = {"noun", "verb", "adjective", "adverb", "helper", "expression", "other"}


def normalize_word_type(value: str) -> str:
    word_type = " ".join((value or "").split()).strip().lower()
    return word_type if word_type in WORD_TYPE_CHOICES else ""


def _tts_language_instruction(target_language: str) -> str:
    language_label = OPENAI_TTS_LANGUAGE_LABEL_BY_STUDY_LANGUAGE.get(target_language, target_language.capitalize())
    return (
        f"Speak only in {language_label}. "
        f"Every word, syllable, abbreviation, article, and phrase must be pronounced with {language_label} phonetics and accent. "
        f"If a token looks like English or another language, still pronounce it as {language_label} text. "
        "Do not translate, switch languages, infer an English pronunciation, or reinterpret words as another language."
    )


def _build_local_audio_url(filename: str) -> str:
    relative_url = f"{settings.MEDIA_URL.rstrip('/')}/audio/{filename}"
    return f"{settings.APP_BASE_URL.rstrip('/')}{relative_url}"


def _build_s3_audio_url(key: str) -> str:
    explicit_base_url = str(getattr(settings, "AWS_S3_AUDIO_BASE_URL", "")).strip().rstrip("/")
    if explicit_base_url:
        normalized_key = key.lstrip("/")
        prefix = str(getattr(settings, "AWS_S3_AUDIO_PREFIX", "audio")).strip().strip("/")
        if prefix:
            base_suffix = f"/{prefix.lower()}"
            key_prefix = f"{prefix.lower()}/"
            if explicit_base_url.lower().endswith(base_suffix) and normalized_key.lower().startswith(key_prefix):
                normalized_key = normalized_key[len(prefix) + 1 :]
        return f"{explicit_base_url}/{normalized_key}"

    bucket = str(getattr(settings, "AWS_S3_AUDIO_BUCKET", "")).strip()
    region = str(getattr(settings, "AWS_S3_AUDIO_REGION", "")).strip()
    if region:
        return f"https://{bucket}.s3.{region}.amazonaws.com/{key}"
    return f"https://{bucket}.s3.amazonaws.com/{key}"


def _store_audio_bytes(filename: str, payload: bytes, content_type: str) -> str:
    storage_backend = str(getattr(settings, "AUDIO_STORAGE_BACKEND", "local")).strip().lower()
    if storage_backend == "s3":
        bucket = str(getattr(settings, "AWS_S3_AUDIO_BUCKET", "")).strip()
        if not bucket:
            logger.warning("content.audio.failed_s3 reason=missing_bucket filename=%s", filename)
            return ""

        prefix = str(getattr(settings, "AWS_S3_AUDIO_PREFIX", "audio")).strip().strip("/")
        key = f"{prefix}/{filename}" if prefix else filename

        try:
            import boto3
        except Exception:
            logger.warning("content.audio.failed_s3 reason=missing_boto3 filename=%s", filename)
            return ""

        s3_client_kwargs: dict[str, str] = {}
        region = str(getattr(settings, "AWS_S3_AUDIO_REGION", "")).strip()
        if region:
            s3_client_kwargs["region_name"] = region

        logger.info(
            "content.audio.s3.upload_started filename=%s bucket=%s key=%s content_type=%s bytes=%d region=%s",
            filename,
            bucket,
            key,
            content_type,
            len(payload),
            region or "default",
        )
        try:
            boto3.client("s3", **s3_client_kwargs).put_object(
                Bucket=bucket,
                Key=key,
                Body=payload,
                ContentType=content_type,
            )
        except Exception as exc:
            logger.warning(
                "content.audio.failed_s3_upload filename=%s bucket=%s key=%s error=%s",
                filename,
                bucket,
                key,
                exc.__class__.__name__,
            )
            return ""

        audio_url = _build_s3_audio_url(key)
        logger.info("content.audio.s3.upload_succeeded filename=%s bucket=%s key=%s", filename, bucket, key)
        return audio_url

    audio_dir = Path(settings.MEDIA_ROOT) / "audio"
    audio_dir.mkdir(parents=True, exist_ok=True)
    file_path = audio_dir / filename
    try:
        file_path.write_bytes(payload)
    except Exception:
        logger.warning("content.audio.failed_write filename=%s", filename)
        return ""
    return _build_local_audio_url(filename)


def item_exists(
    *,
    user,
    item_type: str,
    spanish_text: str,
    german_text: str,
    source_language: str = "spanish",
    target_language: str = "german",
    word_type: str | None = None,
) -> bool:
    query = apply_user_scope(Item.objects, user).filter(
        item_type=item_type,
        spanish_text__iexact=spanish_text,
        german_text__iexact=german_text,
        source_language=source_language,
        target_language=target_language,
    )
    if item_type == Item.ItemType.WORD and word_type is not None:
        query = query.filter(word_type=normalize_word_type(word_type))
    return query.exists()


def normalize_word_pair_for_item_save(
    *,
    spanish_text: str,
    german_text: str,
    source_language: str,
    target_language: str,
) -> tuple[str, str]:
    source_text_norm = " ".join((spanish_text or "").split()).strip()
    target_text_norm = " ".join((german_text or "").split()).strip()
    return source_text_norm, target_text_norm


def serialize_candidate(candidate: ContentCandidate) -> dict:
    return {
        "spanish_text": candidate.spanish_text,
        "german_text": candidate.german_text,
        "exists": candidate.exists,
        "word_type": candidate.word_type,
        "notes": candidate.notes,
        "selection_key": word_selection_id(candidate),
    }


def count_new_items(plan: ContentPlan) -> int:
    return sum(1 for phrase in plan.phrases if not phrase.exists) + sum(1 for word in plan.words if not word.exists)


def create_phrase_if_missing(
    *,
    user,
    candidate: ContentCandidate,
    topic: str,
    source_language: str = "spanish",
    target_language: str = "german",
) -> Item | None:
    if item_exists(
        user=user,
        item_type=Item.ItemType.PHRASE,
        spanish_text=candidate.spanish_text,
        german_text=candidate.german_text,
        source_language=source_language,
        target_language=target_language,
    ):
        logger.info("content.create.phrase.skipped_exists topic=%s spanish=%s", topic, candidate.spanish_text)
        return None
    try:
        audio_url = create_audio_file(candidate.german_text, "phrase", target_language=target_language)
    except TypeError:
        # Backward compatibility for tests/mocks that still accept only (text, prefix).
        audio_url = create_audio_file(candidate.german_text, "phrase")
    item = Item.objects.create(
        user=user,
        item_type=Item.ItemType.PHRASE,
        spanish_text=candidate.spanish_text,
        german_text=candidate.german_text,
        source_language=source_language,
        target_language=target_language,
        notes=candidate.notes,
        example_sentence="",
        audio_url=audio_url,
    )
    logger.info("content.create.phrase.created topic=%s item_id=%s has_audio=%s", topic, item.id, bool(audio_url))
    return item


def enrich_notes_with_plural(notes: str, plural_german: str) -> str:
    plural = plural_german.strip()
    base_notes = notes.strip()
    if not plural:
        return base_notes
    plural_note = f"Plural: {plural}"
    if not base_notes:
        return plural_note
    if re.search(r"\bplural\b", base_notes, flags=re.IGNORECASE):
        return base_notes
    return f"{base_notes} {plural_note}"


def create_word_if_missing(
    *,
    user,
    candidate: ContentCandidate,
    topic: str,
    source_language: str = "spanish",
    target_language: str = "german",
    exercise_phrases: dict | None = None,
) -> Item | None:
    normalized_word_type = normalize_word_type(candidate.word_type)
    normalized_spanish, normalized_german = normalize_word_pair_for_item_save(
        spanish_text=candidate.spanish_text,
        german_text=candidate.german_text,
        source_language=source_language,
        target_language=target_language,
    )
    if item_exists(
        user=user,
        item_type=Item.ItemType.WORD,
        spanish_text=normalized_spanish,
        german_text=normalized_german,
        source_language=source_language,
        target_language=target_language,
        word_type=normalized_word_type,
    ):
        logger.info("content.create.word.skipped_exists topic=%s spanish=%s", topic, normalized_spanish)
        return None
    phrase_german = candidate.source_phrase_german.strip()
    audio_text = f"{normalized_german}. {phrase_german}" if phrase_german else normalized_german
    try:
        audio_url = create_audio_file(audio_text, "word", target_language=target_language)
    except TypeError:
        # Backward compatibility for tests/mocks that still accept only (text, prefix).
        audio_url = create_audio_file(audio_text, "word")
    item = Item.objects.create(
        user=user,
        item_type=Item.ItemType.WORD,
        spanish_text=normalized_spanish,
        german_text=normalized_german,
        source_language=source_language,
        target_language=target_language,
        notes=candidate.notes,
        word_type=normalized_word_type,
        example_sentence=phrase_german,
        audio_url=audio_url,
        exercise_phrases=exercise_phrases or {},
    )
    logger.info(
        "content.create.word.created topic=%s item_id=%s spanish=%s has_audio=%s",
        topic,
        item.id,
        item.spanish_text,
        bool(audio_url),
    )
    return item


def create_audio_file(text: str, prefix: str, target_language: str = "german") -> str:
    if not text.strip():
        logger.warning("content.audio.skipped prefix=%s reason=empty_text", prefix)
        return ""

    slug = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    if not slug:
        slug = "audio"
    filename = f"{prefix}-{slug[:32]}-{uuid4().hex[:8]}.mp3"

    voice = OPENAI_TTS_ITEM_VOICE_BY_STUDY_LANGUAGE.get(target_language, "alloy")
    audio_bytes = _openai_tts_audio(
        text=text,
        voice=voice,
        speed=float(getattr(settings, "OPENAI_TTS_ITEM_SPEED", OPENAI_TTS_ITEM_DEFAULT_SPEED)),
        response_format="mp3",
        instructions=_tts_language_instruction(target_language),
    )
    if not audio_bytes:
        logger.warning("content.audio.failed prefix=%s filename=%s target_language=%s", prefix, filename, target_language)
        return ""
    audio_url = _store_audio_bytes(filename, audio_bytes, content_type="audio/mpeg")
    if not audio_url:
        logger.warning("content.audio.failed_store prefix=%s filename=%s", prefix, filename)
        return ""
    logger.info(
        "content.audio.created prefix=%s filename=%s target_language=%s voice=%s",
        prefix,
        filename,
        target_language,
        voice,
    )
    return audio_url


def _openai_tts_audio(
    *,
    text: str,
    voice: str,
    speed: float,
    response_format: str,
    instructions: str = "",
) -> bytes | None:
    api_key = settings.OPENAI_API_KEY
    if not api_key:
        return None
    model = getattr(settings, "OPENAI_TTS_MODEL", "gpt-4o-mini-tts")
    body = {
        "model": model,
        "voice": voice,
        "input": text,
        "speed": speed,
        "response_format": response_format,
    }
    if instructions.strip():
        body["instructions"] = instructions.strip()
    request = UrlRequest(
        "https://api.openai.com/v1/audio/speech",
        data=json.dumps(body).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    timeout_seconds = int(getattr(settings, "OPENAI_TTS_REQUEST_TIMEOUT_SECONDS", 40))
    try:
        with urlopen(request, timeout=timeout_seconds) as response:
            return response.read()
    except (HTTPError, URLError, TimeoutError):
        return None


def _openai_tts_pcm(text: str, voice: str) -> bytes | None:
    return _openai_tts_audio(
        text=text,
        voice=voice,
        speed=float(getattr(settings, "OPENAI_TTS_SPEED", OPENAI_TTS_DEFAULT_SPEED)),
        response_format="pcm",
    )


def create_dialog_audio_file(dialog_lines: list[str], target_language: str = "german") -> str:
    cleaned_lines = [line.strip() for line in dialog_lines if line and line.strip()]
    if len(cleaned_lines) < 2:
        return ""
    if len(OPENAI_TTS_VOICES) < 2:
        return ""

    voice_a, voice_b = sample(list(OPENAI_TTS_VOICES), 2)
    silence = b"\x00\x00" * int(OPENAI_TTS_SAMPLE_RATE * 0.12)
    pcm_chunks: list[bytes] = []
    futures: list[tuple[int, str, Future[bytes | None]]] = []
    max_workers = min(6, len(cleaned_lines))

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        for index, line in enumerate(cleaned_lines):
            voice = voice_a if index % 2 == 0 else voice_b
            futures.append((index, voice, executor.submit(_openai_tts_pcm, line, voice)))

        for index, voice, future in futures:
            pcm = future.result()
            if not pcm:
                logger.warning("content.audio.dialog.turn_failed line_index=%d voice=%s", index, voice)
                continue
            pcm_chunks.append(pcm)
            pcm_chunks.append(silence)

    if not pcm_chunks:
        return ""

    filename = f"dialog-{uuid4().hex[:12]}.wav"

    try:
        audio_buffer = io.BytesIO()
        with wave.open(audio_buffer, "wb") as wav_file:
            wav_file.setnchannels(1)
            wav_file.setsampwidth(2)
            wav_file.setframerate(OPENAI_TTS_SAMPLE_RATE)
            wav_file.writeframes(b"".join(pcm_chunks))
    except Exception:
        logger.warning("content.audio.dialog.failed filename=%s", filename)
        return ""

    audio_url = _store_audio_bytes(filename, audio_buffer.getvalue(), content_type="audio/wav")
    if not audio_url:
        logger.warning("content.audio.dialog.failed_store filename=%s", filename)
        return ""
    logger.info(
        "content.audio.dialog.created filename=%s voices=%s,%s target_language=%s",
        filename,
        voice_a,
        voice_b,
        target_language,
    )
    return audio_url


def save_dialog(
    *,
    user,
    topic: str,
    context: str,
    source_language: str,
    target_language: str,
    turns: list[dict[str, str]],
    audio_url: str,
) -> SavedDialog:
    return SavedDialog.objects.create(
        user=user,
        topic=topic,
        context=context,
        source_language=source_language,
        target_language=target_language,
        turns=turns,
        audio_url=audio_url,
    )


def save_dialog_turns(dialog: SavedDialog, turns: list[dict[str, str]]) -> list[DialogTurn]:
    created_turns: list[DialogTurn] = []
    for index, turn in enumerate(turns):
        source_text = str(turn.get("source_text", "")).strip()
        target_text = str(turn.get("target_text", "")).strip()
        audio_url = create_audio_file(target_text, "phrase", target_language=dialog.target_language) if target_text else ""
        created_turns.append(
            DialogTurn.objects.create(
                dialog=dialog,
                turn_index=index,
                source_text=source_text,
                target_text=target_text,
                audio_url=audio_url,
            )
        )
    return created_turns


def save_phrase_dialog_occurrences(
    *,
    user,
    dialog: SavedDialog,
    turns: list[DialogTurn],
    source_language: str,
    target_language: str,
) -> int:
    created = 0
    for turn in turns:
        phrase_item = apply_user_scope(Item.objects, user).filter(
            item_type=Item.ItemType.PHRASE,
            source_language=source_language,
            target_language=target_language,
            spanish_text__iexact=turn.source_text,
            german_text__iexact=turn.target_text,
        ).first()
        if not phrase_item:
            continue
        _, was_created = ItemDialogOccurrence.objects.get_or_create(
            item=phrase_item,
            dialog=dialog,
            turn=turn,
            turn_index=turn.turn_index,
            side=ItemDialogOccurrence.Side.TARGET,
            defaults={"match_score": 1.0},
        )
        if was_created:
            created += 1
    return created


def save_word_dialog_occurrences(
    *,
    user,
    dialog: SavedDialog,
    turns: list[DialogTurn],
    word_candidates: list[ContentCandidate],
    source_language: str,
    target_language: str,
) -> int:
    created = 0
    for candidate in word_candidates:
        matching_word_items = apply_user_scope(Item.objects, user).filter(
            item_type=Item.ItemType.WORD,
            source_language=source_language,
            target_language=target_language,
            spanish_text__iexact=candidate.spanish_text,
            german_text__iexact=candidate.german_text,
            word_type=normalize_word_type(candidate.word_type),
        )
        if not matching_word_items.exists():
            continue

        source_pattern = _compile_word_pattern(candidate.spanish_text)
        target_pattern = _compile_word_pattern(candidate.german_text)
        for turn in turns:
            source_hit = bool(source_pattern.search(turn.source_text)) if source_pattern else False
            target_hit = bool(target_pattern.search(turn.target_text)) if target_pattern else False
            if not source_hit and not target_hit:
                continue
            for item in matching_word_items:
                if source_hit:
                    _, was_created = ItemDialogOccurrence.objects.get_or_create(
                        item=item,
                        dialog=dialog,
                        turn=turn,
                        turn_index=turn.turn_index,
                        side=ItemDialogOccurrence.Side.SOURCE,
                        defaults={"match_score": 0.75},
                    )
                    if was_created:
                        created += 1
                if target_hit:
                    _, was_created = ItemDialogOccurrence.objects.get_or_create(
                        item=item,
                        dialog=dialog,
                        turn=turn,
                        turn_index=turn.turn_index,
                        side=ItemDialogOccurrence.Side.TARGET,
                        defaults={"match_score": 0.8},
                    )
                    if was_created:
                        created += 1
    return created


def _compile_word_pattern(text: str):
    normalized = text.strip()
    if not normalized:
        return None
    escaped = re.escape(normalized)
    return re.compile(rf"\b{escaped}\b", re.IGNORECASE)
