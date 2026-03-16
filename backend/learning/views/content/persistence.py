from __future__ import annotations

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

from ...models import DialogTurn, ExcludedWordSuggestion, Item, ItemDialogOccurrence, SavedDialog
from .selection import normalize_word_pair, word_selection_id
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
OPENAI_TTS_VOICES = ("alloy", "echo", "fable", "onyx", "nova", "shimmer")
OPENAI_TTS_SAMPLE_RATE = 24000
OPENAI_TTS_DEFAULT_SPEED = 1.25
OPENAI_TTS_ITEM_DEFAULT_SPEED = 1.0


def get_excluded_words_lookup() -> set[tuple[str, str]]:
    return {
        normalize_word_pair(spanish_word, german_word)
        for spanish_word, german_word in ExcludedWordSuggestion.objects.values_list(
            "spanish_text",
            "german_text",
        )
    }


def save_excluded_words(words: list[ContentCandidate]) -> None:
    saved_count = 0
    for word in words:
        normalized_spanish, normalized_german = normalize_word_pair(word.spanish_text, word.german_text)
        if not normalized_spanish or not normalized_german:
            continue
        _, created = ExcludedWordSuggestion.objects.get_or_create(
            spanish_text=normalized_spanish,
            german_text=normalized_german,
        )
        if created:
            saved_count += 1
    if words:
        logger.info("content.exclude.saved requested=%d created=%d", len(words), saved_count)


def item_exists(
    item_type: str,
    spanish_text: str,
    german_text: str,
    source_language: str = "spanish",
    target_language: str = "german",
) -> bool:
    return Item.objects.filter(
        item_type=item_type,
        spanish_text__iexact=spanish_text,
        german_text__iexact=german_text,
        source_language=source_language,
        target_language=target_language,
    ).exists()


def serialize_candidate(candidate: ContentCandidate) -> dict:
    return {
        "spanish_text": candidate.spanish_text,
        "german_text": candidate.german_text,
        "exists": candidate.exists,
        "notes": candidate.notes,
        "selection_key": word_selection_id(candidate),
    }


def count_new_items(plan: ContentPlan) -> int:
    return sum(1 for phrase in plan.phrases if not phrase.exists) + sum(1 for word in plan.words if not word.exists)


def create_phrase_if_missing(
    candidate: ContentCandidate,
    topic: str,
    source_language: str = "spanish",
    target_language: str = "german",
) -> Item | None:
    if item_exists(
        Item.ItemType.PHRASE,
        candidate.spanish_text,
        candidate.german_text,
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
    candidate: ContentCandidate,
    topic: str,
    source_language: str = "spanish",
    target_language: str = "german",
    exercise_phrases: dict | None = None,
) -> Item | None:
    if item_exists(
        Item.ItemType.WORD,
        candidate.spanish_text,
        candidate.german_text,
        source_language=source_language,
        target_language=target_language,
    ):
        logger.info("content.create.word.skipped_exists topic=%s spanish=%s", topic, candidate.spanish_text)
        return None
    phrase_german = candidate.source_phrase_german.strip()
    audio_text = f"{candidate.german_text}. {phrase_german}" if phrase_german else candidate.german_text
    try:
        audio_url = create_audio_file(audio_text, "word", target_language=target_language)
    except TypeError:
        # Backward compatibility for tests/mocks that still accept only (text, prefix).
        audio_url = create_audio_file(audio_text, "word")
    item = Item.objects.create(
        item_type=Item.ItemType.WORD,
        spanish_text=candidate.spanish_text,
        german_text=candidate.german_text,
        source_language=source_language,
        target_language=target_language,
        notes=candidate.notes,
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

    audio_dir = Path(settings.MEDIA_ROOT) / "audio"
    audio_dir.mkdir(parents=True, exist_ok=True)

    slug = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    if not slug:
        slug = "audio"
    filename = f"{prefix}-{slug[:32]}-{uuid4().hex[:8]}.mp3"
    file_path = audio_dir / filename

    voice = OPENAI_TTS_ITEM_VOICE_BY_STUDY_LANGUAGE.get(target_language, "alloy")
    audio_bytes = _openai_tts_audio(
        text=text,
        voice=voice,
        speed=float(getattr(settings, "OPENAI_TTS_ITEM_SPEED", OPENAI_TTS_ITEM_DEFAULT_SPEED)),
        response_format="mp3",
    )
    if not audio_bytes:
        logger.warning("content.audio.failed prefix=%s filename=%s target_language=%s", prefix, filename, target_language)
        return ""
    try:
        file_path.write_bytes(audio_bytes)
    except Exception:
        logger.warning("content.audio.failed_write prefix=%s filename=%s", prefix, filename)
        return ""

    relative_url = f"{settings.MEDIA_URL.rstrip('/')}/audio/{filename}"
    audio_url = f"{settings.APP_BASE_URL.rstrip('/')}{relative_url}"
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
    request = UrlRequest(
        "https://api.openai.com/v1/audio/speech",
        data=json.dumps(body).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urlopen(request, timeout=20) as response:
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

    audio_dir = Path(settings.MEDIA_ROOT) / "audio"
    audio_dir.mkdir(parents=True, exist_ok=True)
    filename = f"dialog-{uuid4().hex[:12]}.wav"
    file_path = audio_dir / filename

    try:
        with wave.open(str(file_path), "wb") as wav_file:
            wav_file.setnchannels(1)
            wav_file.setsampwidth(2)
            wav_file.setframerate(OPENAI_TTS_SAMPLE_RATE)
            wav_file.writeframes(b"".join(pcm_chunks))
    except Exception:
        logger.warning("content.audio.dialog.failed filename=%s", filename)
        return ""

    relative_url = f"{settings.MEDIA_URL.rstrip('/')}/audio/{filename}"
    audio_url = f"{settings.APP_BASE_URL.rstrip('/')}{relative_url}"
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
    topic: str,
    context: str,
    source_language: str,
    target_language: str,
    turns: list[dict[str, str]],
    audio_url: str,
) -> SavedDialog:
    return SavedDialog.objects.create(
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
        created_turns.append(
            DialogTurn.objects.create(
                dialog=dialog,
                turn_index=index,
                source_text=source_text,
                target_text=target_text,
            )
        )
    return created_turns


def save_phrase_dialog_occurrences(
    *,
    dialog: SavedDialog,
    turns: list[DialogTurn],
    source_language: str,
    target_language: str,
) -> int:
    created = 0
    for turn in turns:
        phrase_item = Item.objects.filter(
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
    dialog: SavedDialog,
    turns: list[DialogTurn],
    word_candidates: list[ContentCandidate],
    source_language: str,
    target_language: str,
) -> int:
    created = 0
    for candidate in word_candidates:
        matching_word_items = Item.objects.filter(
            item_type=Item.ItemType.WORD,
            source_language=source_language,
            target_language=target_language,
            spanish_text__iexact=candidate.spanish_text,
            german_text__iexact=candidate.german_text,
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
