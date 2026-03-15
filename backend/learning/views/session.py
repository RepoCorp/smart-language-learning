from __future__ import annotations

import random
from dataclasses import dataclass

from django.utils import timezone
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from ..models import Item
from ..serializers import SessionItemSerializer


@dataclass(frozen=True)
class SessionEntry:
    item: Item
    mode: str
    direction: str | None
    due_at_sort: object | None = None


class SessionView(APIView):
    def get(self, request: Request) -> Response:
        size = int(request.query_params.get("size", 5))
        source_language = (request.query_params.get("source_language", "spanish") or "spanish").strip().lower()
        target_language = (request.query_params.get("target_language", "german") or "german").strip().lower()
        now = timezone.now()

        entries = build_session_entries(
            size=size,
            now=now,
            source_language=source_language,
            target_language=target_language,
        )
        payload = serialize_entries(entries)
        serializer = SessionItemSerializer(payload, many=True)
        return Response({"items": serializer.data})


def build_session_entries(size: int, now, source_language: str, target_language: str) -> list[SessionEntry]:
    due_entries = build_due_entries(now=now, limit=size, source_language=source_language, target_language=target_language)

    remaining = size - len(due_entries)
    new_entries: list[SessionEntry] = []
    if remaining > 0:
        new_entries = build_new_entries(limit=remaining, source_language=source_language, target_language=target_language)

    remaining -= len(new_entries)
    upcoming_entries: list[SessionEntry] = []
    if remaining > 0:
        selected_keys = {entry_key(entry) for entry in due_entries + new_entries}
        upcoming_entries = build_upcoming_entries(
            now=now,
            limit=remaining,
            excluded_keys=selected_keys,
            source_language=source_language,
            target_language=target_language,
        )

    return due_entries + new_entries + upcoming_entries


def build_due_entries(now, limit: int, source_language: str, target_language: str) -> list[SessionEntry]:
    rows: list[tuple[object, int, str, Item]] = []

    phrase_due_es_to_de = Item.objects.filter(
        item_type=Item.ItemType.PHRASE,
        source_language=source_language,
        target_language=target_language,
        last_reviewed_at_es_to_de__isnull=False,
        due_at_es_to_de__lte=now,
    ).order_by("due_at_es_to_de", "id")
    for item in phrase_due_es_to_de:
        rows.append((item.due_at_es_to_de, item.id, Item.ReviewDirection.SPANISH_TO_GERMAN, item))

    phrase_due_de_to_es = Item.objects.filter(
        item_type=Item.ItemType.PHRASE,
        source_language=source_language,
        target_language=target_language,
        last_reviewed_at_de_to_es__isnull=False,
        due_at_de_to_es__lte=now,
    ).order_by("due_at_de_to_es", "id")
    for item in phrase_due_de_to_es:
        rows.append((item.due_at_de_to_es, item.id, Item.ReviewDirection.GERMAN_TO_SPANISH, item))

    word_due_es_to_de = Item.objects.filter(
        item_type=Item.ItemType.WORD,
        source_language=source_language,
        target_language=target_language,
        last_reviewed_at_es_to_de__isnull=False,
        due_at_es_to_de__lte=now,
    ).order_by("due_at_es_to_de", "id")
    for item in word_due_es_to_de:
        rows.append((item.due_at_es_to_de, item.id, Item.ReviewDirection.SPANISH_TO_GERMAN, item))

    word_due_de_to_es = Item.objects.filter(
        item_type=Item.ItemType.WORD,
        source_language=source_language,
        target_language=target_language,
        last_reviewed_at_de_to_es__isnull=False,
        due_at_de_to_es__lte=now,
    ).order_by("due_at_de_to_es", "id")
    for item in word_due_de_to_es:
        rows.append((item.due_at_de_to_es, item.id, Item.ReviewDirection.GERMAN_TO_SPANISH, item))

    rows.sort(key=lambda row: (row[0], row[1], row[2]))
    return [review_entry(item=row[3], direction=row[2], due_at=row[0]) for row in rows[:limit]]


def build_new_entries(limit: int, source_language: str, target_language: str) -> list[SessionEntry]:
    new_words = list(
        Item.objects.filter(
            item_type=Item.ItemType.WORD,
            source_language=source_language,
            target_language=target_language,
            last_reviewed_at_es_to_de__isnull=True,
            last_reviewed_at_de_to_es__isnull=True,
        ).order_by("created_at", "id")
    )
    new_phrases = list(
        Item.objects.filter(
            item_type=Item.ItemType.PHRASE,
            source_language=source_language,
            target_language=target_language,
            last_reviewed_at_es_to_de__isnull=True,
            last_reviewed_at_de_to_es__isnull=True,
        ).order_by("created_at", "id")
    )

    combined = sorted(new_words + new_phrases, key=lambda item: (item.created_at, item.id))
    return [new_entry(item) for item in combined[:limit]]


def build_upcoming_entries(
    now,
    limit: int,
    excluded_keys: set[tuple[int, str | None]],
    source_language: str,
    target_language: str,
) -> list[SessionEntry]:
    rows: list[tuple[object, int, str, Item]] = []

    phrase_upcoming_es_to_de = Item.objects.filter(
        item_type=Item.ItemType.PHRASE,
        source_language=source_language,
        target_language=target_language,
        last_reviewed_at_es_to_de__isnull=False,
        due_at_es_to_de__gt=now,
    ).order_by("due_at_es_to_de", "id")
    for item in phrase_upcoming_es_to_de:
        rows.append((item.due_at_es_to_de, item.id, Item.ReviewDirection.SPANISH_TO_GERMAN, item))

    phrase_upcoming_de_to_es = Item.objects.filter(
        item_type=Item.ItemType.PHRASE,
        source_language=source_language,
        target_language=target_language,
        last_reviewed_at_de_to_es__isnull=False,
        due_at_de_to_es__gt=now,
    ).order_by("due_at_de_to_es", "id")
    for item in phrase_upcoming_de_to_es:
        rows.append((item.due_at_de_to_es, item.id, Item.ReviewDirection.GERMAN_TO_SPANISH, item))

    word_upcoming_es_to_de = Item.objects.filter(
        item_type=Item.ItemType.WORD,
        source_language=source_language,
        target_language=target_language,
        last_reviewed_at_es_to_de__isnull=False,
        due_at_es_to_de__gt=now,
    ).order_by("due_at_es_to_de", "id")
    for item in word_upcoming_es_to_de:
        rows.append((item.due_at_es_to_de, item.id, Item.ReviewDirection.SPANISH_TO_GERMAN, item))

    word_upcoming_de_to_es = Item.objects.filter(
        item_type=Item.ItemType.WORD,
        source_language=source_language,
        target_language=target_language,
        last_reviewed_at_de_to_es__isnull=False,
        due_at_de_to_es__gt=now,
    ).order_by("due_at_de_to_es", "id")
    for item in word_upcoming_de_to_es:
        rows.append((item.due_at_de_to_es, item.id, Item.ReviewDirection.GERMAN_TO_SPANISH, item))

    rows.sort(key=lambda row: (row[0], row[1], row[2]))

    entries: list[SessionEntry] = []
    for due_at, _, direction, item in rows:
        session_entry = review_entry(item=item, direction=direction, due_at=due_at)
        if entry_key(session_entry) in excluded_keys:
            continue
        entries.append(session_entry)
        if len(entries) >= limit:
            break

    return entries


def review_entry(item: Item, direction: str | None, due_at) -> SessionEntry:
    return SessionEntry(item=item, mode="review", direction=direction, due_at_sort=due_at)


def new_entry(item: Item) -> SessionEntry:
    return SessionEntry(item=item, mode="new", direction=None)


def entry_key(entry: SessionEntry) -> tuple[int, str | None]:
    return entry.item.id, entry.direction


def serialize_entries(entries: list[SessionEntry]) -> list[dict]:
    options_map = build_phrase_options(entries)
    payload: list[dict] = []

    for entry in entries:
        payload.append(
            {
                "id": entry.item.id,
                "item_type": entry.item.item_type,
                "spanish_text": entry.item.spanish_text,
                "german_text": entry.item.german_text,
                "example_sentence": entry.item.example_sentence,
                "notes": entry.item.notes,
                "audio_url": entry.item.audio_url,
                "mode": entry.mode,
                "direction": entry.direction,
                "options": options_map.get(entry_key(entry), []),
            }
        )

    return payload


def build_phrase_options(entries: list[SessionEntry]) -> dict[tuple[int, str | None], list[str]]:
    phrase_review_entries = [
        entry for entry in entries if entry.item.item_type == Item.ItemType.PHRASE and entry.mode == "review"
    ]
    if not phrase_review_entries:
        return {}

    pair_set = {(entry.item.source_language, entry.item.target_language) for entry in phrase_review_entries}
    all_phrase_answers_es_to_de_by_pair: dict[tuple[str, str], list[str]] = {}
    all_phrase_answers_de_to_es_by_pair: dict[tuple[str, str], list[str]] = {}
    for source_language, target_language in pair_set:
        all_phrase_answers_es_to_de_by_pair[(source_language, target_language)] = list(
            Item.objects.filter(
                item_type=Item.ItemType.PHRASE,
                source_language=source_language,
                target_language=target_language,
            ).values_list("german_text", flat=True)
        )
        all_phrase_answers_de_to_es_by_pair[(source_language, target_language)] = list(
            Item.objects.filter(
                item_type=Item.ItemType.PHRASE,
                source_language=source_language,
                target_language=target_language,
            ).values_list("spanish_text", flat=True)
        )
    options_map: dict[tuple[int, str | None], list[str]] = {}

    for entry in phrase_review_entries:
        item = entry.item
        is_es_to_de = entry.direction == Item.ReviewDirection.SPANISH_TO_GERMAN
        correct_answer = item.german_text if is_es_to_de else item.spanish_text
        pair_key = (item.source_language, item.target_language)
        source_answers = (
            all_phrase_answers_es_to_de_by_pair[pair_key]
            if is_es_to_de
            else all_phrase_answers_de_to_es_by_pair[pair_key]
        )
        distractors = [answer for answer in source_answers if answer != correct_answer]
        random.shuffle(distractors)
        choices = distractors[:3] + [correct_answer]
        random.shuffle(choices)
        options_map[entry_key(entry)] = choices

    return options_map
