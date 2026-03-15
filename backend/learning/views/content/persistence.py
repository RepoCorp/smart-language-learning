from __future__ import annotations

import logging
import re
from pathlib import Path
from uuid import uuid4

from django.conf import settings

from ...models import ExcludedWordSuggestion, Item
from .selection import normalize_word_pair, word_selection_id
from .types import ContentCandidate, ContentPlan

logger = logging.getLogger(__name__)
TTS_LANGUAGE_BY_STUDY_LANGUAGE = {
    "spanish": "es",
    "english": "en",
    "german": "de",
    "french": "fr",
    "italian": "it",
    "portuguese": "pt",
}


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

    try:
        from gtts import gTTS
    except ImportError:
        logger.warning("content.audio.skipped prefix=%s reason=gtts_not_installed", prefix)
        return ""

    audio_dir = Path(settings.MEDIA_ROOT) / "audio"
    audio_dir.mkdir(parents=True, exist_ok=True)

    slug = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    if not slug:
        slug = "audio"
    filename = f"{prefix}-{slug[:32]}-{uuid4().hex[:8]}.mp3"
    file_path = audio_dir / filename

    tts_language = TTS_LANGUAGE_BY_STUDY_LANGUAGE.get(target_language, "de")
    try:
        gTTS(text=text, lang=tts_language, slow=False).save(str(file_path))
    except Exception:
        logger.warning(
            "content.audio.failed prefix=%s filename=%s tts_language=%s",
            prefix,
            filename,
            tts_language,
        )
        return ""

    relative_url = f"{settings.MEDIA_URL.rstrip('/')}/audio/{filename}"
    audio_url = f"{settings.APP_BASE_URL.rstrip('/')}{relative_url}"
    logger.info(
        "content.audio.created prefix=%s filename=%s tts_language=%s",
        prefix,
        filename,
        tts_language,
    )
    return audio_url
