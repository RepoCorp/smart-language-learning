from __future__ import annotations

import logging
import re

from ...models import Item
from .generation import (
    generate_content_with_chatgpt,
    generate_conversation_with_chatgpt,
    generate_keywords_for_phrase_with_chatgpt,
)
from .persistence import enrich_notes_with_plural, item_exists
from .selection import german_word_has_article, normalize_topic
from .types import ContentCandidate, ContentPlan

logger = logging.getLogger(__name__)
GERMAN_ARTICLES = {"der", "die", "das", "den", "dem", "des", "ein", "eine", "einen", "einem", "einer", "eines"}


def _generate_conversation(
    topic: str,
    context: str,
    source_language: str,
    target_language: str,
) -> list[dict[str, str]] | None:
    try:
        return generate_conversation_with_chatgpt(
            topic,
            context=context,
            source_language=source_language,
            target_language=target_language,
        )
    except TypeError:
        try:
            return generate_conversation_with_chatgpt(topic, context=context)
        except TypeError:
            return generate_conversation_with_chatgpt(topic)


def _generate_content(
    topic: str,
    context: str,
    source_language: str,
    target_language: str,
) -> tuple[str, str, str, list[dict[str, str]]] | None:
    try:
        return generate_content_with_chatgpt(
            topic,
            context=context,
            source_language=source_language,
            target_language=target_language,
        )
    except TypeError:
        try:
            return generate_content_with_chatgpt(topic, context=context)
        except TypeError:
            return generate_content_with_chatgpt(topic)


def _normalize_for_phrase_match(value: str) -> str:
    lowered = value.lower()
    cleaned = re.sub(r"[^\w\s]", " ", lowered, flags=re.UNICODE)
    return " ".join(cleaned.split())


def _strip_german_article(german_keyword: str) -> str:
    normalized = _normalize_for_phrase_match(german_keyword)
    if not normalized:
        return ""
    parts = normalized.split()
    if parts and parts[0] in GERMAN_ARTICLES:
        return " ".join(parts[1:])
    return normalized


def _keyword_matches_phrase(spanish_word: str, german_word: str, phrase_spanish: str, phrase_german: str) -> bool:
    spanish_norm = _normalize_for_phrase_match(spanish_word)
    phrase_spanish_norm = _normalize_for_phrase_match(phrase_spanish)
    german_core = _strip_german_article(german_word)
    phrase_german_norm = _normalize_for_phrase_match(phrase_german)
    if not spanish_norm or not german_core:
        return False
    return spanish_norm in phrase_spanish_norm and german_core in phrase_german_norm


def _append_non_literal_note(notes: str, spanish_word: str, german_word: str) -> str:
    base = notes.strip()
    suffix = (
        f" Non-literal mapping kept: '{spanish_word}' -> '{german_word}' "
        "does not appear literally in the phrase."
    )
    if not base:
        return suffix.strip()
    return f"{base}{suffix}"


def build_content_plan(
    *,
    user,
    topic: str,
    context: str = "",
    source_language: str = "spanish",
    target_language: str = "german",
) -> ContentPlan:
    normalized_topic = normalize_topic(topic)
    normalized_context = " ".join(context.split()).strip()
    generated_conversation = _generate_conversation(
        normalized_topic,
        normalized_context,
        source_language=source_language,
        target_language=target_language,
    )
    phrase_sources: list[tuple[str, str, str, list[dict[str, str]]]] = []

    for phrase in generated_conversation:
        spanish_text = phrase["spanish_text"].strip()
        german_text = phrase["german_text"].strip()
        notes = str(phrase.get("notes", "")).strip()
        phrase_sources.append((spanish_text, german_text, notes, []))

    phrases: list[ContentCandidate] = []
    for phrase_es, phrase_de, phrase_notes, _ in phrase_sources:
        phrase_exists = item_exists(
            user=user,
            item_type=Item.ItemType.PHRASE,
            spanish_text=phrase_es,
            german_text=phrase_de,
            source_language=source_language,
            target_language=target_language,
        )
        phrases.append(
            ContentCandidate(
                spanish_text=phrase_es,
                german_text=phrase_de,
                exists=phrase_exists,
                notes=phrase_notes,
            )
        )

    words: list[ContentCandidate] = []
    seen: set[tuple[str, str, str]] = set()
    skipped_missing_fields = 0
    skipped_without_article = 0
    skipped_not_in_phrase = 0
    skipped_duplicate = 0
    total_generated_words = 0

    logger.info(
        (
            "content.plan.built topic=%s generated=%d kept=%d "
            "phrases=%d skipped_missing=%d skipped_no_article=%d skipped_not_in_phrase=%d "
            "skipped_duplicate=%d"
        ),
        normalized_topic,
        total_generated_words,
        len(words),
        len(phrases),
        skipped_missing_fields,
        skipped_without_article,
        skipped_not_in_phrase,
        skipped_duplicate,
    )
    return ContentPlan(phrases=phrases, words=words)
