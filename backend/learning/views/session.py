from __future__ import annotations

import random
import math
import hashlib
from dataclasses import dataclass
from collections import defaultdict

from django.db.models import Q
from django.utils import timezone
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from ..auth import apply_user_scope, get_request_user
from ..models import DialogTurn, Item, ItemDialogOccurrence
from ..serializers import SessionItemSerializer
from .dialog_phrase_match import build_dialog_phrase_match_payload


@dataclass(frozen=True)
class SessionEntry:
    item: Item
    mode: str
    direction: str | None
    due_at_sort: object | None = None


REVIEW_WORD_SECONDS = 25
REVIEW_PHRASE_SECONDS = 35
NEW_WORD_SECONDS = 70
NEW_PHRASE_SECONDS = 80


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


class SessionView(APIView):
    def get(self, request: Request) -> Response:
        user = get_request_user(request)
        size = _safe_int(request.query_params.get("size"), default=5, minimum=1, maximum=100)
        duration_minutes = _safe_int(request.query_params.get("duration_minutes"), default=None, minimum=1, maximum=180)
        source_language = (request.query_params.get("source_language", "spanish") or "spanish").strip().lower()
        target_language = (request.query_params.get("target_language", "german") or "german").strip().lower()
        now = timezone.now()

        entries = build_session_entries(
            user=user,
            size=size,
            duration_minutes=duration_minutes,
            now=now,
            source_language=source_language,
            target_language=target_language,
        )
        payload = serialize_entries(entries, user=user)
        serializer = SessionItemSerializer(payload, many=True)
        return Response({"items": serializer.data})


def build_session_entries(
    *,
    user,
    size: int,
    now,
    source_language: str,
    target_language: str,
    duration_minutes: int | None = None,
) -> list[SessionEntry]:
    if duration_minutes is not None:
        return build_duration_based_session_entries(
            user=user,
            duration_minutes=duration_minutes,
            now=now,
            source_language=source_language,
            target_language=target_language,
        )

    due_entries = build_due_entries(user=user, now=now, limit=size, source_language=source_language, target_language=target_language)

    remaining = size - len(due_entries)
    new_entries: list[SessionEntry] = []
    if remaining > 0:
        new_entries = build_new_entries(user=user, limit=remaining, source_language=source_language, target_language=target_language)

    remaining -= len(new_entries)
    upcoming_entries: list[SessionEntry] = []
    if remaining > 0:
        selected_keys = {entry_key(entry) for entry in due_entries + new_entries}
        upcoming_entries = build_upcoming_entries(
            user=user,
            now=now,
            limit=remaining,
            excluded_keys=selected_keys,
            source_language=source_language,
            target_language=target_language,
        )

    return due_entries + new_entries + upcoming_entries


def build_duration_based_session_entries(
    *,
    user,
    duration_minutes: int,
    now,
    source_language: str,
    target_language: str,
) -> list[SessionEntry]:
    target_seconds = duration_minutes * 60
    planning_limit = max(1, math.ceil(target_seconds / REVIEW_WORD_SECONDS) + 4)

    due_entries = build_due_entries(
        user=user,
        now=now,
        limit=planning_limit,
        source_language=source_language,
        target_language=target_language,
    )
    remaining = planning_limit - len(due_entries)

    new_entries: list[SessionEntry] = []
    if remaining > 0:
        new_entries = build_new_entries(user=user, limit=remaining, source_language=source_language, target_language=target_language)
    remaining -= len(new_entries)

    upcoming_entries: list[SessionEntry] = []
    if remaining > 0:
        selected_keys = {entry_key(entry) for entry in due_entries + new_entries}
        upcoming_entries = build_upcoming_entries(
            user=user,
            now=now,
            limit=remaining,
            excluded_keys=selected_keys,
            source_language=source_language,
            target_language=target_language,
        )

    ordered_entries = due_entries + new_entries + upcoming_entries
    return trim_entries_to_target_duration(ordered_entries, target_seconds=target_seconds)


def trim_entries_to_target_duration(entries: list[SessionEntry], target_seconds: int) -> list[SessionEntry]:
    if target_seconds <= 0:
        return []
    selected: list[SessionEntry] = []
    elapsed = 0
    for entry in entries:
        selected.append(entry)
        elapsed += estimated_seconds_for_entry(entry)
        if elapsed >= target_seconds:
            break
    return selected


def estimated_seconds_for_entry(entry: SessionEntry) -> int:
    if entry.mode == "new":
        return NEW_PHRASE_SECONDS if entry.item.item_type == Item.ItemType.PHRASE else NEW_WORD_SECONDS
    return REVIEW_PHRASE_SECONDS if entry.item.item_type == Item.ItemType.PHRASE else REVIEW_WORD_SECONDS


def _safe_int(raw_value, *, default: int | None, minimum: int, maximum: int) -> int | None:
    if raw_value is None:
        return default
    try:
        parsed = int(str(raw_value))
    except (TypeError, ValueError):
        return default
    return max(minimum, min(maximum, parsed))


def build_due_entries(*, user, now, limit: int, source_language: str, target_language: str) -> list[SessionEntry]:
    rows: list[tuple[object, int, str, Item]] = []

    phrase_due_es_to_de = apply_user_scope(Item.objects, user).filter(
        item_type=Item.ItemType.PHRASE,
        is_learned=False,
        source_language=source_language,
        target_language=target_language,
        last_reviewed_at_es_to_de__isnull=False,
        due_at_es_to_de__lte=now,
    ).order_by("due_at_es_to_de", "id")
    for item in phrase_due_es_to_de:
        rows.append((item.due_at_es_to_de, item.id, Item.ReviewDirection.SPANISH_TO_GERMAN, item))

    phrase_due_de_to_es = apply_user_scope(Item.objects, user).filter(
        item_type=Item.ItemType.PHRASE,
        is_learned=False,
        source_language=source_language,
        target_language=target_language,
        last_reviewed_at_de_to_es__isnull=False,
        due_at_de_to_es__lte=now,
    ).order_by("due_at_de_to_es", "id")
    for item in phrase_due_de_to_es:
        rows.append((item.due_at_de_to_es, item.id, Item.ReviewDirection.GERMAN_TO_SPANISH, item))

    word_due_es_to_de = apply_user_scope(Item.objects, user).filter(
        item_type=Item.ItemType.WORD,
        is_learned=False,
        source_language=source_language,
        target_language=target_language,
        last_reviewed_at_es_to_de__isnull=False,
        due_at_es_to_de__lte=now,
    ).order_by("due_at_es_to_de", "id")
    for item in word_due_es_to_de:
        rows.append((item.due_at_es_to_de, item.id, Item.ReviewDirection.SPANISH_TO_GERMAN, item))

    word_due_de_to_es = apply_user_scope(Item.objects, user).filter(
        item_type=Item.ItemType.WORD,
        is_learned=False,
        source_language=source_language,
        target_language=target_language,
        last_reviewed_at_de_to_es__isnull=False,
        due_at_de_to_es__lte=now,
    ).order_by("due_at_de_to_es", "id")
    for item in word_due_de_to_es:
        rows.append((item.due_at_de_to_es, item.id, Item.ReviewDirection.GERMAN_TO_SPANISH, item))

    rows.sort(key=lambda row: (row[0], row[1], row[2]))
    entries = [review_entry(item=row[3], direction=row[2], due_at=row[0]) for row in rows]
    randomize_review_order(entries)
    return entries[:limit]


def build_new_entries(*, user, limit: int, source_language: str, target_language: str) -> list[SessionEntry]:
    new_words = list(
        apply_user_scope(Item.objects, user).filter(
            item_type=Item.ItemType.WORD,
            is_learned=False,
            source_language=source_language,
            target_language=target_language,
            last_reviewed_at_es_to_de__isnull=True,
            last_reviewed_at_de_to_es__isnull=True,
        ).order_by("created_at", "id")
    )
    new_phrases = list(
        apply_user_scope(Item.objects, user).filter(
            item_type=Item.ItemType.PHRASE,
            is_learned=False,
            source_language=source_language,
            target_language=target_language,
            last_reviewed_at_es_to_de__isnull=True,
            last_reviewed_at_de_to_es__isnull=True,
        ).order_by("created_at", "id")
    )

    combined = sorted(new_words + new_phrases, key=lambda item: (item.created_at, item.id))
    return [new_entry(item) for item in combined[:limit]]


def build_upcoming_entries(
    *,
    user,
    now,
    limit: int,
    excluded_keys: set[tuple[int, str | None]],
    source_language: str,
    target_language: str,
) -> list[SessionEntry]:
    rows: list[tuple[object, int, str, Item]] = []

    phrase_upcoming_es_to_de = apply_user_scope(Item.objects, user).filter(
        item_type=Item.ItemType.PHRASE,
        is_learned=False,
        source_language=source_language,
        target_language=target_language,
        last_reviewed_at_es_to_de__isnull=False,
        due_at_es_to_de__gt=now,
    ).order_by("due_at_es_to_de", "id")
    for item in phrase_upcoming_es_to_de:
        rows.append((item.due_at_es_to_de, item.id, Item.ReviewDirection.SPANISH_TO_GERMAN, item))

    phrase_upcoming_de_to_es = apply_user_scope(Item.objects, user).filter(
        item_type=Item.ItemType.PHRASE,
        is_learned=False,
        source_language=source_language,
        target_language=target_language,
        last_reviewed_at_de_to_es__isnull=False,
        due_at_de_to_es__gt=now,
    ).order_by("due_at_de_to_es", "id")
    for item in phrase_upcoming_de_to_es:
        rows.append((item.due_at_de_to_es, item.id, Item.ReviewDirection.GERMAN_TO_SPANISH, item))

    word_upcoming_es_to_de = apply_user_scope(Item.objects, user).filter(
        item_type=Item.ItemType.WORD,
        is_learned=False,
        source_language=source_language,
        target_language=target_language,
        last_reviewed_at_es_to_de__isnull=False,
        due_at_es_to_de__gt=now,
    ).order_by("due_at_es_to_de", "id")
    for item in word_upcoming_es_to_de:
        rows.append((item.due_at_es_to_de, item.id, Item.ReviewDirection.SPANISH_TO_GERMAN, item))

    word_upcoming_de_to_es = apply_user_scope(Item.objects, user).filter(
        item_type=Item.ItemType.WORD,
        is_learned=False,
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

    randomize_review_order(entries)
    return entries


def randomize_review_order(entries: list[SessionEntry]) -> None:
    random.shuffle(entries)


def review_entry(item: Item, direction: str | None, due_at) -> SessionEntry:
    return SessionEntry(item=item, mode="review", direction=direction, due_at_sort=due_at)


def new_entry(item: Item) -> SessionEntry:
    return SessionEntry(item=item, mode="new", direction=None)


def entry_key(entry: SessionEntry) -> tuple[int, str | None]:
    return entry.item.id, entry.direction


def serialize_entries(entries: list[SessionEntry], *, user) -> list[dict]:
    option_items_map = build_review_options(entries, user=user)
    (
        dialog_phrase_answers_map,
        dialog_phrase_scenes_map,
        dialog_phrase_scene_audio_map,
        dialog_phrase_options_map,
        dialog_phrase_turns_map,
        dialog_phrase_odd_index_map,
    ) = build_dialog_phrase_options(entries, user=user)
    related_dialogs_map = build_related_dialogs_map(entries, user=user)
    payload: list[dict] = []

    for entry in entries:
        option_items = option_items_map.get(entry_key(entry), [])
        payload.append(
            {
                "id": entry.item.id,
                "item_type": entry.item.item_type,
                "spanish_text": entry.item.spanish_text,
                "german_text": entry.item.german_text,
                "example_sentence": entry.item.example_sentence,
                "notes": entry.item.notes,
                "word_type": entry.item.word_type,
                "audio_url": entry.item.audio_url,
                "exercise_phrases": entry.item.exercise_phrases or {},
                "mode": entry.mode,
                "direction": entry.direction,
                "options": [option["text"] for option in option_items],
                "option_items": option_items,
                "dialog_phrase_answer": dialog_phrase_answers_map.get(entry_key(entry), ""),
                "dialog_phrase_scene": dialog_phrase_scenes_map.get(entry_key(entry), ""),
                "dialog_phrase_scene_audio_urls": dialog_phrase_scene_audio_map.get(entry_key(entry), []),
                "dialog_phrase_options": dialog_phrase_options_map.get(entry_key(entry), []),
                "dialog_phrase_turns": dialog_phrase_turns_map.get(entry_key(entry), []),
                "dialog_phrase_odd_index": dialog_phrase_odd_index_map.get(entry_key(entry)),
                "related_dialogs": related_dialogs_map.get(entry.item.id, []),
            }
        )

    return payload


def build_review_options(entries: list[SessionEntry], *, user) -> dict[tuple[int, str | None], list[dict]]:
    review_entries_with_options = [
        entry
        for entry in entries
        if entry.mode == "review"
        and (
            entry.item.item_type == Item.ItemType.PHRASE
            or (
                entry.item.item_type == Item.ItemType.WORD
                and entry.direction == Item.ReviewDirection.GERMAN_TO_SPANISH
            )
        )
    ]
    if not review_entries_with_options:
        return {}

    pair_set = {(entry.item.source_language, entry.item.target_language) for entry in review_entries_with_options}
    all_phrase_answers_es_to_de_by_pair: dict[tuple[str, str], list[tuple[int, str]]] = {}
    all_phrase_answers_de_to_es_by_pair: dict[tuple[str, str], list[tuple[int, str]]] = {}
    all_word_answers_de_to_es_by_pair: dict[tuple[str, str], list[tuple[int, str]]] = {}
    for source_language, target_language in pair_set:
        all_phrase_answers_es_to_de_by_pair[(source_language, target_language)] = list(
            apply_user_scope(Item.objects, user).filter(
                item_type=Item.ItemType.PHRASE,
                is_learned=False,
                source_language=source_language,
                target_language=target_language,
            ).values_list("id", "german_text")
        )
        all_phrase_answers_de_to_es_by_pair[(source_language, target_language)] = list(
            apply_user_scope(Item.objects, user).filter(
                item_type=Item.ItemType.PHRASE,
                is_learned=False,
                source_language=source_language,
                target_language=target_language,
            ).values_list("id", "spanish_text")
        )
        all_word_answers_de_to_es_by_pair[(source_language, target_language)] = list(
            apply_user_scope(Item.objects, user).filter(
                item_type=Item.ItemType.WORD,
                is_learned=False,
                source_language=source_language,
                target_language=target_language,
            ).values_list("id", "spanish_text")
        )
    options_map: dict[tuple[int, str | None], list[dict]] = {}

    for entry in review_entries_with_options:
        item = entry.item
        pair_key = (item.source_language, item.target_language)
        if item.item_type == Item.ItemType.PHRASE:
            is_es_to_de = entry.direction == Item.ReviewDirection.SPANISH_TO_GERMAN
            correct_answer = item.german_text if is_es_to_de else item.spanish_text
            source_answers = (
                all_phrase_answers_es_to_de_by_pair[pair_key]
                if is_es_to_de
                else all_phrase_answers_de_to_es_by_pair[pair_key]
            )
            choices = build_choices(correct_answer, source_answers)
        else:
            correct_answer = item.spanish_text
            source_answers = all_word_answers_de_to_es_by_pair[pair_key]
            choices = build_choices(correct_answer, source_answers)
        options_map[entry_key(entry)] = choices

    return options_map


def build_dialog_phrase_options(entries: list[SessionEntry], *, user) -> tuple[
    dict[tuple[int, str | None], str],
    dict[tuple[int, str | None], str],
    dict[tuple[int, str | None], list[str]],
    dict[tuple[int, str | None], list[str]],
    dict[tuple[int, str | None], list[dict]],
    dict[tuple[int, str | None], int | None],
]:
    phrase_entries = [
        entry
        for entry in entries
        if entry.mode == "review"
        and entry.item.item_type == Item.ItemType.PHRASE
    ]
    if not phrase_entries:
        return {}, {}, {}, {}, {}, {}

    answers_map: dict[tuple[int, str | None], str] = {}
    scenes_map: dict[tuple[int, str | None], str] = {}
    scene_audio_map: dict[tuple[int, str | None], list[str]] = {}
    options_map: dict[tuple[int, str | None], list[str]] = {}
    turns_map: dict[tuple[int, str | None], list[dict]] = {}
    odd_index_map: dict[tuple[int, str | None], int | None] = {}
    for entry in phrase_entries:
        item = entry.item
        payload = build_dialog_phrase_match_payload(item, user=user)
        answers_map[entry_key(entry)] = payload["answer"]
        scenes_map[entry_key(entry)] = payload["scene"]
        scene_audio_map[entry_key(entry)] = payload["scene_audio_urls"]
        options_map[entry_key(entry)] = payload["options"]
        turns_map[entry_key(entry)] = payload["turns"]
        odd_index_map[entry_key(entry)] = payload["odd_index"]

    return answers_map, scenes_map, scene_audio_map, options_map, turns_map, odd_index_map


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


def build_text_choices(correct_answer: str, source_answers: list[str]) -> list[str]:
    unique_answers = list(dict.fromkeys(answer.strip() for answer in source_answers if answer and answer.strip()))
    distractors = [answer for answer in unique_answers if answer.lower() != correct_answer.lower()]
    sorted_distractors = _deterministic_sort(
        distractors,
        seed=f"text-distractors:{correct_answer}",
        key_fn=lambda answer: answer,
    )
    choice_texts = sorted_distractors[:3] + [correct_answer]
    choice_texts = _deterministic_sort(
        choice_texts,
        seed=f"text-choices:{correct_answer}",
        key_fn=lambda answer: answer,
    )
    return choice_texts


def build_choices(correct_answer: str, source_answers: list[tuple[int, str]]) -> list[dict]:
    unique_answers_by_text = {answer: item_id for item_id, answer in source_answers}
    distractors = [answer for answer in unique_answers_by_text if answer != correct_answer]
    sorted_distractors = _deterministic_sort(
        distractors,
        seed=f"item-distractors:{correct_answer}",
        key_fn=lambda answer: answer,
    )
    choice_texts = sorted_distractors[:3] + [correct_answer]
    choices = [
        {
            "id": unique_answers_by_text[answer],
            "text": answer,
        }
        for answer in choice_texts
        if answer in unique_answers_by_text
    ]
    choices = _deterministic_sort(
        choices,
        seed=f"item-choices:{correct_answer}",
        key_fn=lambda choice: f"{choice['id']}|{choice['text']}",
    )
    return choices


def build_related_dialogs_map(entries: list[SessionEntry], *, user, per_item_limit: int = 4) -> dict[int, list[dict]]:
    item_ids = {entry.item.id for entry in entries}
    if not item_ids:
        return {}

    occurrences = (
        apply_user_scope(ItemDialogOccurrence.objects, user, field="item__user")
        .filter(item_id__in=item_ids)
        .select_related("dialog", "turn")
        .order_by("-created_at", "-match_score", "-dialog__created_at", "-id")
    )

    by_item_dialog: dict[int, dict[int, dict]] = defaultdict(dict)
    for occurrence in occurrences:
        dialogs_for_item = by_item_dialog[occurrence.item_id]
        dialog_payload = dialogs_for_item.get(occurrence.dialog_id)
        if dialog_payload is None:
            if len(dialogs_for_item) >= per_item_limit:
                continue
            dialog_payload = {
                "dialog_id": occurrence.dialog_id,
                "topic": occurrence.dialog.topic,
                "context": occurrence.dialog.context,
                "audio_url": occurrence.dialog.audio_url,
                "created_at": occurrence.dialog.created_at.isoformat(),
                "turns": _dialog_turns_with_phrase_audio(occurrence.dialog, user=user),
                "matched_turns": [],
            }
            dialogs_for_item[occurrence.dialog_id] = dialog_payload

        matched_turn = {
            "turn_index": occurrence.turn_index,
            "side": occurrence.side,
            "match_score": occurrence.match_score,
            "source_text": occurrence.turn.source_text,
            "target_text": occurrence.turn.target_text,
        }
        if matched_turn not in dialog_payload["matched_turns"]:
            dialog_payload["matched_turns"].append(matched_turn)

    return {
        item_id: list(dialogs.values())
        for item_id, dialogs in by_item_dialog.items()
    }


def _dialog_turns_with_phrase_audio(dialog, *, user) -> list[dict]:
    raw_turns = dialog.turns if isinstance(dialog.turns, list) else []
    normalized_turns: list[dict] = []
    key_pairs: set[tuple[str, str]] = set()
    turn_audio_by_index = {
        turn.turn_index: str(turn.audio_url or "")
        for turn in dialog.dialog_turns.all()
        if str(turn.audio_url or "").strip()
    }
    for index, turn in enumerate(raw_turns):
        if not isinstance(turn, dict):
            continue
        source_text = str(turn.get("source_text", "")).strip()
        target_text = str(turn.get("target_text", "")).strip()
        speaker = _normalize_dialog_speaker(turn.get("speaker", ""), len(normalized_turns))
        normalized_turns.append(
            {
                "turn_index": index,
                "source_text": source_text,
                "target_text": target_text,
                "speaker": speaker,
            }
        )
        if source_text and target_text:
            key_pairs.add((source_text.lower(), target_text.lower()))

    phrase_audio_by_key: dict[tuple[str, str], str] = {}
    if key_pairs:
        query = Q()
        for source_text, target_text in key_pairs:
            query |= Q(spanish_text__iexact=source_text, german_text__iexact=target_text)
        phrase_items = apply_user_scope(Item.objects, user).filter(
            item_type=Item.ItemType.PHRASE,
            source_language=dialog.source_language,
            target_language=dialog.target_language,
        ).filter(query).values("spanish_text", "german_text", "audio_url")
        phrase_audio_by_key = {
            (str(item["spanish_text"]).strip().lower(), str(item["german_text"]).strip().lower()): str(item["audio_url"] or "")
            for item in phrase_items
        }

    return [
        {
            "source_text": turn["source_text"],
            "target_text": turn["target_text"],
            "speaker": turn["speaker"],
            "phrase_audio_url": phrase_audio_by_key.get(
                (turn["source_text"].lower(), turn["target_text"].lower()),
                turn_audio_by_index.get(turn["turn_index"], ""),
            ),
        }
        for turn in normalized_turns
    ]


def _normalize_dialog_speaker(value, index: int) -> str:
    raw = str(value or "").strip().lower()
    if raw in {"a", "speaker_a", "person_a", "1", "first"}:
        return "a"
    if raw in {"b", "speaker_b", "person_b", "2", "second"}:
        return "b"
    return "a" if index % 2 == 0 else "b"
