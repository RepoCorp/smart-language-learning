from __future__ import annotations

import hashlib

from django.db.models import Q

from ..auth import apply_user_scope
from ..models import Item, ItemDialogOccurrence, SavedDialog


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


def _normalize_dialog_speaker(value, index: int) -> str:
    raw = str(value or "").strip().lower()
    if raw in {"a", "speaker_a", "person_a", "1", "first"}:
        return "a"
    if raw in {"b", "speaker_b", "person_b", "2", "second"}:
        return "b"
    return "a" if index % 2 == 0 else "b"


def _phrase_audio_by_pair(*, dialog, user, source_target_pairs: set[tuple[str, str]]) -> dict[tuple[str, str], str]:
    if not source_target_pairs:
        return {}
    query = Q()
    for source_text, target_text in source_target_pairs:
        query |= Q(spanish_text__iexact=source_text, german_text__iexact=target_text)
    phrase_items = apply_user_scope(Item.objects, user).filter(
        item_type=Item.ItemType.PHRASE,
        source_language=dialog.source_language,
        target_language=dialog.target_language,
    ).filter(query).values("spanish_text", "german_text", "audio_url")
    return {
        (str(item["spanish_text"]).strip().lower(), str(item["german_text"]).strip().lower()): str(item["audio_url"] or "").strip()
        for item in phrase_items
        if str(item["spanish_text"]).strip() and str(item["german_text"]).strip()
    }


def build_dialog_phrase_match_payload(item: Item, *, user) -> dict:
    empty_payload = {
        "answer": "",
        "scene": "",
        "scene_audio_urls": [],
        "options": [],
        "turns": [],
        "odd_index": None,
    }
    if item.item_type != Item.ItemType.PHRASE:
        return empty_payload

    origin_dialog_ids = set(
        apply_user_scope(ItemDialogOccurrence.objects, user, field="item__user")
        .filter(item=item)
        .values_list("dialog_id", flat=True)
    )
    dialogs = apply_user_scope(SavedDialog.objects, user).filter(
        source_language=item.source_language,
        target_language=item.target_language,
    ).prefetch_related("dialog_turns")
    if origin_dialog_ids:
        dialogs = dialogs.exclude(id__in=origin_dialog_ids)

    candidate_windows: list[dict] = []
    for dialog in dialogs:
        ordered_turns = sorted(dialog.dialog_turns.all(), key=lambda turn: (turn.turn_index, turn.id))
        if len(ordered_turns) < 4:
            continue
        raw_turns = dialog.turns if isinstance(dialog.turns, list) else []
        source_target_pairs = {
            (turn.source_text.strip(), turn.target_text.strip())
            for turn in ordered_turns
            if turn.source_text.strip() and turn.target_text.strip()
        }
        phrase_audio_map = _phrase_audio_by_pair(dialog=dialog, user=user, source_target_pairs=source_target_pairs)
        normalized_turns = []
        for index, turn in enumerate(ordered_turns):
            raw_turn = raw_turns[turn.turn_index] if turn.turn_index < len(raw_turns) and isinstance(raw_turns[turn.turn_index], dict) else {}
            source_text = str(turn.source_text or "").strip()
            target_text = str(turn.target_text or "").strip()
            normalized_turns.append(
                {
                    "turn_index": turn.turn_index,
                    "source_text": source_text,
                    "target_text": target_text,
                    "speaker": _normalize_dialog_speaker(raw_turn.get("speaker", ""), index),
                    "phrase_audio_url": str(turn.audio_url or "").strip()
                    or phrase_audio_map.get((source_text.lower(), target_text.lower()), ""),
                }
            )
        for start_index in range(len(normalized_turns) - 3):
            window_turns = normalized_turns[start_index:start_index + 4]
            if any(turn["target_text"].strip().lower() == item.german_text.strip().lower() for turn in window_turns):
                continue
            candidate_windows.append(
                {
                    "dialog_id": dialog.id,
                    "window_start": start_index,
                    "turns": window_turns,
                }
            )

    if not candidate_windows:
        return empty_payload

    selected_window = _deterministic_sort(
        candidate_windows,
        seed=f"dialog-phrase-window:{item.id}:{item.spanish_text}:{item.german_text}",
        key_fn=lambda window: f"{window['dialog_id']}:{window['window_start']}",
    )[0]
    odd_index = int(
        hashlib.sha256(
            f"{item.id}:{selected_window['dialog_id']}:{selected_window['window_start']}:dialog-phrase-slot".encode("utf-8")
        ).hexdigest(),
        16,
    ) % 4

    displayed_turns: list[dict] = []
    scene_audio_urls: list[str] = []
    option_lines: list[str] = []
    for index, turn in enumerate(selected_window["turns"]):
        displayed_turn = {
            "source_text": turn["source_text"],
            "target_text": item.german_text if index == odd_index else turn["target_text"],
            "speaker": turn["speaker"],
            "phrase_audio_url": str(item.audio_url or "").strip() if index == odd_index else turn["phrase_audio_url"],
        }
        displayed_turns.append(displayed_turn)
        option_lines.append(displayed_turn["target_text"])
        if displayed_turn["phrase_audio_url"]:
            scene_audio_urls.append(displayed_turn["phrase_audio_url"])

    return {
        "answer": item.german_text,
        "scene": "\n".join(turn["target_text"] for turn in displayed_turns),
        "scene_audio_urls": scene_audio_urls,
        "options": option_lines,
        "turns": displayed_turns,
        "odd_index": odd_index,
    }
