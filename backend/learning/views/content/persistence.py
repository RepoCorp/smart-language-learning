from __future__ import annotations

import logging
import re

from ...auth import apply_user_scope
from ...models import DialogTurn, Item, ItemDialogOccurrence, SavedDialog
from .audio import create_audio_file, create_openai_audio_file
from .selection import word_selection_id
from .types import ContentCandidate, ContentPlan

logger = logging.getLogger(__name__)
WORD_TYPE_CHOICES = {"noun", "verb", "adjective", "adverb", "helper", "expression", "other"}


def normalize_word_type(value: str) -> str:
    word_type = " ".join((value or "").split()).strip().lower()
    return word_type if word_type in WORD_TYPE_CHOICES else ""


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
    audio_url_override: str = "",
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
        audio_url = create_openai_audio_file(candidate.german_text, "phrase", target_language=target_language)
    except TypeError:
        # Backward compatibility for tests/mocks that still accept only (text, prefix).
        audio_url = create_openai_audio_file(candidate.german_text, "phrase")
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


def save_dialog_turns(dialog: SavedDialog, turns: list[dict[str, str]], speaker_voice_ids: tuple[str, str] | None = None) -> list[DialogTurn]:
    created_turns: list[DialogTurn] = []
    for index, turn in enumerate(turns):
        source_text = str(turn.get("source_text", "")).strip()
        target_text = str(turn.get("target_text", "")).strip()
        voice_id = speaker_voice_ids[index % 2] if speaker_voice_ids else ""
        audio_url = create_audio_file(target_text, "phrase", target_language=dialog.target_language, voice_id=voice_id) if target_text else ""
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
