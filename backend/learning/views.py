from __future__ import annotations

import random
import re
from dataclasses import dataclass

from django.utils import timezone
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Item
from .serializers import ContentConfirmSerializer, ContentTopicSerializer, MarkSeenSerializer, SessionItemSerializer, SubmitReviewSerializer
from .srs import apply_review_result, mark_item_seen


@dataclass(frozen=True)
class SessionEntry:
    item: Item
    mode: str
    direction: str | None
    due_at_sort: object | None = None


class SessionView(APIView):
    def get(self, request: Request) -> Response:
        size = int(request.query_params.get("size", 5))
        now = timezone.now()

        entries = build_session_entries(size=size, now=now)
        payload = serialize_entries(entries)
        serializer = SessionItemSerializer(payload, many=True)
        return Response({"items": serializer.data})


class SubmitReviewView(APIView):
    def post(self, request: Request) -> Response:
        serializer = SubmitReviewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        item_id = serializer.validated_data["item_id"]
        correct = serializer.validated_data["correct"]
        direction = serializer.validated_data.get("direction")

        try:
            item = Item.objects.get(id=item_id)
        except Item.DoesNotExist:
            return Response({"detail": "Item not found"}, status=status.HTTP_404_NOT_FOUND)

        if direction is None:
            return Response({"detail": "Reviews require direction"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            apply_review_result(item, correct, direction=direction)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"ok": True})


class MarkSeenView(APIView):
    def post(self, request: Request) -> Response:
        serializer = MarkSeenSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        item_id = serializer.validated_data["item_id"]

        try:
            item = Item.objects.get(id=item_id)
        except Item.DoesNotExist:
            return Response({"detail": "Item not found"}, status=status.HTTP_404_NOT_FOUND)

        mark_item_seen(item)
        return Response({"ok": True})


class HealthView(APIView):
    def get(self, request: Request) -> Response:
        return Response({"status": "ok", "service": "smart-language-learning-backend", "timestamp": timezone.now().isoformat()})


class ContentPreviewView(APIView):
    def post(self, request: Request) -> Response:
        serializer = ContentTopicSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        topic = serializer.validated_data["topic"].strip()
        plan = build_content_plan(topic)
        return Response(
            {
                "topic": topic,
                "phrase": serialize_candidate(plan.phrase),
                "words": [serialize_candidate(word) for word in plan.words],
                "new_items_count": count_new_items(plan),
            }
        )


class ContentConfirmView(APIView):
    def post(self, request: Request) -> Response:
        serializer = ContentConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        topic = serializer.validated_data["topic"].strip()
        selected_words = serializer.validated_data.get("selected_words", [])
        selected_words_normalized = {word.strip().lower() for word in selected_words if word.strip()}
        plan = build_content_plan(topic)

        created_phrase = create_phrase_if_missing(plan.phrase, topic)
        created_words = [
            create_word_if_missing(word, plan.phrase.spanish_text, topic)
            for word in plan.words
            if word.spanish_text.lower() in selected_words_normalized
        ]
        created_word_items = [word for word in created_words if word is not None]

        return Response(
            {
                "topic": topic,
                "created_phrase": created_phrase is not None,
                "created_words_count": len(created_word_items),
                "created_words": [item.spanish_text for item in created_word_items],
            }
        )


def build_session_entries(size: int, now) -> list[SessionEntry]:
    due_entries = build_due_entries(now=now, limit=size)

    remaining = size - len(due_entries)
    new_entries: list[SessionEntry] = []
    if remaining > 0:
        new_entries = build_new_entries(limit=remaining)

    remaining -= len(new_entries)
    upcoming_entries: list[SessionEntry] = []
    if remaining > 0:
        selected_keys = {entry_key(entry) for entry in due_entries + new_entries}
        upcoming_entries = build_upcoming_entries(now=now, limit=remaining, excluded_keys=selected_keys)

    return due_entries + new_entries + upcoming_entries


def build_due_entries(now, limit: int) -> list[SessionEntry]:
    rows: list[tuple[object, int, str, Item]] = []

    phrase_due_es_to_de = Item.objects.filter(
        item_type=Item.ItemType.PHRASE,
        last_reviewed_at_es_to_de__isnull=False,
        due_at_es_to_de__lte=now,
    ).order_by("due_at_es_to_de", "id")
    for item in phrase_due_es_to_de:
        rows.append((item.due_at_es_to_de, item.id, Item.ReviewDirection.SPANISH_TO_GERMAN, item))

    phrase_due_de_to_es = Item.objects.filter(
        item_type=Item.ItemType.PHRASE,
        last_reviewed_at_de_to_es__isnull=False,
        due_at_de_to_es__lte=now,
    ).order_by("due_at_de_to_es", "id")
    for item in phrase_due_de_to_es:
        rows.append((item.due_at_de_to_es, item.id, Item.ReviewDirection.GERMAN_TO_SPANISH, item))

    word_due_es_to_de = Item.objects.filter(
        item_type=Item.ItemType.WORD,
        last_reviewed_at_es_to_de__isnull=False,
        due_at_es_to_de__lte=now,
    ).order_by("due_at_es_to_de", "id")
    for item in word_due_es_to_de:
        rows.append((item.due_at_es_to_de, item.id, Item.ReviewDirection.SPANISH_TO_GERMAN, item))

    word_due_de_to_es = Item.objects.filter(
        item_type=Item.ItemType.WORD,
        last_reviewed_at_de_to_es__isnull=False,
        due_at_de_to_es__lte=now,
    ).order_by("due_at_de_to_es", "id")
    for item in word_due_de_to_es:
        rows.append((item.due_at_de_to_es, item.id, Item.ReviewDirection.GERMAN_TO_SPANISH, item))

    rows.sort(key=lambda row: (row[0], row[1], row[2]))
    return [review_entry(item=row[3], direction=row[2], due_at=row[0]) for row in rows[:limit]]


def build_new_entries(limit: int) -> list[SessionEntry]:
    new_words = list(
        Item.objects.filter(
            item_type=Item.ItemType.WORD,
            last_reviewed_at_es_to_de__isnull=True,
            last_reviewed_at_de_to_es__isnull=True,
        ).order_by("created_at", "id")
    )
    new_phrases = list(
        Item.objects.filter(
            item_type=Item.ItemType.PHRASE,
            last_reviewed_at_es_to_de__isnull=True,
            last_reviewed_at_de_to_es__isnull=True,
        ).order_by("created_at", "id")
    )

    combined = sorted(new_words + new_phrases, key=lambda item: (item.created_at, item.id))
    return [new_entry(item) for item in combined[:limit]]


def build_upcoming_entries(now, limit: int, excluded_keys: set[tuple[int, str | None]]) -> list[SessionEntry]:
    rows: list[tuple[object, int, str, Item]] = []

    phrase_upcoming_es_to_de = Item.objects.filter(
        item_type=Item.ItemType.PHRASE,
        last_reviewed_at_es_to_de__isnull=False,
        due_at_es_to_de__gt=now,
    ).order_by("due_at_es_to_de", "id")
    for item in phrase_upcoming_es_to_de:
        rows.append((item.due_at_es_to_de, item.id, Item.ReviewDirection.SPANISH_TO_GERMAN, item))

    phrase_upcoming_de_to_es = Item.objects.filter(
        item_type=Item.ItemType.PHRASE,
        last_reviewed_at_de_to_es__isnull=False,
        due_at_de_to_es__gt=now,
    ).order_by("due_at_de_to_es", "id")
    for item in phrase_upcoming_de_to_es:
        rows.append((item.due_at_de_to_es, item.id, Item.ReviewDirection.GERMAN_TO_SPANISH, item))

    word_upcoming_es_to_de = Item.objects.filter(
        item_type=Item.ItemType.WORD,
        last_reviewed_at_es_to_de__isnull=False,
        due_at_es_to_de__gt=now,
    ).order_by("due_at_es_to_de", "id")
    for item in word_upcoming_es_to_de:
        rows.append((item.due_at_es_to_de, item.id, Item.ReviewDirection.SPANISH_TO_GERMAN, item))

    word_upcoming_de_to_es = Item.objects.filter(
        item_type=Item.ItemType.WORD,
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

    all_phrase_answers_es_to_de = list(Item.objects.filter(item_type=Item.ItemType.PHRASE).values_list("german_text", flat=True))
    all_phrase_answers_de_to_es = list(Item.objects.filter(item_type=Item.ItemType.PHRASE).values_list("spanish_text", flat=True))
    options_map: dict[tuple[int, str | None], list[str]] = {}

    for entry in phrase_review_entries:
        item = entry.item
        is_es_to_de = entry.direction == Item.ReviewDirection.SPANISH_TO_GERMAN
        correct_answer = item.german_text if is_es_to_de else item.spanish_text
        source_answers = all_phrase_answers_es_to_de if is_es_to_de else all_phrase_answers_de_to_es
        distractors = [answer for answer in source_answers if answer != correct_answer]
        random.shuffle(distractors)
        choices = distractors[:3] + [correct_answer]
        random.shuffle(choices)
        options_map[entry_key(entry)] = choices

    return options_map


@dataclass(frozen=True)
class ContentCandidate:
    spanish_text: str
    german_text: str
    exists: bool


@dataclass(frozen=True)
class ContentPlan:
    phrase: ContentCandidate
    words: list[ContentCandidate]


SPANISH_COMMON_WORDS = {
    "a", "al", "ante", "bajo", "cabe", "con", "contra", "de", "del", "desde", "durante", "en", "entre",
    "hacia", "hasta", "mediante", "para", "por", "segun", "sin", "so", "sobre", "tras", "el", "la", "los",
    "las", "un", "una", "unos", "unas", "y", "e", "o", "u", "ni", "que", "si", "no", "yo", "tu", "el", "ella",
    "nosotros", "vosotros", "ellos", "ellas", "me", "te", "se", "nos", "os", "mi", "tu", "su", "nuestro",
    "vuestro", "hoy", "estudio", "aprendo", "tema", "sobre", "muy", "mas", "menos", "es", "son", "ser", "estar",
    "tener", "hacer", "ir", "venir", "decir", "dar", "ver", "saber", "poder", "hola", "gracias", "adios",
    "perdon", "favor", "casa", "perro", "gato", "comida", "agua", "dia", "noche", "persona", "gente",
}


def build_content_plan(topic: str) -> ContentPlan:
    normalized_topic = normalize_topic(topic)
    phrase_es = f"Hoy estudio {normalized_topic}."
    phrase_de = f"Heute lerne ich {normalized_topic}."

    phrase_exists = Item.objects.filter(item_type=Item.ItemType.PHRASE, spanish_text__iexact=phrase_es).exists()
    phrase_candidate = ContentCandidate(spanish_text=phrase_es, german_text=phrase_de, exists=phrase_exists)

    words: list[ContentCandidate] = []
    seen: set[str] = set()
    for token in extract_non_common_words(phrase_es):
        key = token.lower()
        if key in seen:
            continue
        seen.add(key)
        exists = Item.objects.filter(item_type=Item.ItemType.WORD, spanish_text__iexact=token).exists()
        words.append(ContentCandidate(spanish_text=token, german_text=token.capitalize(), exists=exists))

    return ContentPlan(phrase=phrase_candidate, words=words)


def normalize_topic(topic: str) -> str:
    cleaned = " ".join(topic.split()).strip()
    if not cleaned:
        return "un tema"
    return cleaned


def extract_non_common_words(sentence: str) -> list[str]:
    tokens = re.findall(r"[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+", sentence)
    result: list[str] = []
    for token in tokens:
        normalized = token.lower()
        if normalized in SPANISH_COMMON_WORDS:
            continue
        if len(normalized) <= 2:
            continue
        result.append(token)
    return result


def serialize_candidate(candidate: ContentCandidate) -> dict:
    return {
        "spanish_text": candidate.spanish_text,
        "german_text": candidate.german_text,
        "exists": candidate.exists,
    }


def count_new_items(plan: ContentPlan) -> int:
    count = 0
    if not plan.phrase.exists:
        count += 1
    count += sum(1 for word in plan.words if not word.exists)
    return count


def create_phrase_if_missing(candidate: ContentCandidate, topic: str) -> Item | None:
    if Item.objects.filter(item_type=Item.ItemType.PHRASE, spanish_text__iexact=candidate.spanish_text).exists():
        return None
    return Item.objects.create(
        item_type=Item.ItemType.PHRASE,
        spanish_text=candidate.spanish_text,
        german_text=candidate.german_text,
        notes=f"Auto-created from topic: {topic}",
        example_sentence=candidate.spanish_text,
    )


def create_word_if_missing(candidate: ContentCandidate, sentence: str, topic: str) -> Item | None:
    if Item.objects.filter(item_type=Item.ItemType.WORD, spanish_text__iexact=candidate.spanish_text).exists():
        return None
    return Item.objects.create(
        item_type=Item.ItemType.WORD,
        spanish_text=candidate.spanish_text,
        german_text=candidate.german_text,
        notes=f"Auto-created from topic: {topic}",
        example_sentence=sentence,
    )
