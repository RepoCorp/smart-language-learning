from __future__ import annotations

from django.db.models import Q

from ...auth import apply_user_scope
from ...models import DialogTurn, Item, ItemDialogOccurrence, SavedDialog
from .core import create_audio_file


def link_item_to_dialog_turn(*, user, item: Item, dialog_id_raw, turn_index_raw) -> None:
    resolved = _resolve_dialog_turn(user=user, dialog_id_raw=dialog_id_raw, turn_index_raw=turn_index_raw)
    if not resolved:
        return
    dialog, turn, turn_index = resolved
    ItemDialogOccurrence.objects.get_or_create(
        item=item,
        dialog=dialog,
        turn=turn,
        turn_index=turn_index,
        side=ItemDialogOccurrence.Side.TARGET,
        defaults={"match_score": 1.0},
    )


def ensure_audio_for_dialog_turn(*, user, dialog_id_raw, turn_index_raw) -> str:
    resolved = _resolve_dialog_turn(user=user, dialog_id_raw=dialog_id_raw, turn_index_raw=turn_index_raw)
    if not resolved:
        return ""
    dialog, turn, _turn_index = resolved
    target_text = str(turn.target_text or "").strip()
    if not target_text:
        return ""
    if turn.audio_url:
        return turn.audio_url

    audio_url = create_audio_file(target_text, "phrase", target_language=dialog.target_language)
    if not audio_url:
        return ""
    turn.audio_url = audio_url
    turn.save(update_fields=["audio_url"])
    return audio_url


def related_dialogs_by_item_ids(item_ids: list[int], *, user, per_item_limit: int = 8) -> dict[int, list[dict]]:
    if not item_ids:
        return {}
    occurrences = (
        apply_user_scope(ItemDialogOccurrence.objects, user, field="item__user")
        .filter(item_id__in=item_ids)
        .select_related("dialog", "turn")
        .order_by("-created_at", "-match_score", "-dialog__created_at", "-id")
    )
    by_item_dialog: dict[int, dict[int, dict]] = {}
    for occurrence in occurrences:
        dialogs_for_item = by_item_dialog.setdefault(occurrence.item_id, {})
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
                "turns": dialog_turns_with_phrase_audio(occurrence.dialog, user=user),
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
    return {item_id: list(dialogs.values()) for item_id, dialogs in by_item_dialog.items()}


def dialog_turns_with_phrase_audio(dialog, *, user) -> list[dict]:
    db_turns_by_index = {turn.turn_index: turn for turn in dialog.dialog_turns.all()}
    normalized_turns, key_pairs = _normalized_dialog_turns(dialog, db_turns_by_index)
    phrase_audio_by_key = _phrase_audio_by_key(
        key_pairs,
        user=user,
        source_language=dialog.source_language,
        target_language=dialog.target_language,
    )
    return _dialog_turn_audio_payloads(
        normalized_turns,
        phrase_audio_by_key=phrase_audio_by_key,
        turn_audio_by_index=_turn_audio_by_index(db_turns_by_index),
    )


def normalize_dialog_speaker(value, index: int) -> str:
    raw = str(value or "").strip().lower()
    if raw in {"a", "speaker_a", "person_a", "1", "first"}:
        return "a"
    if raw in {"b", "speaker_b", "person_b", "2", "second"}:
        return "b"
    return "a" if index % 2 == 0 else "b"


def _normalized_dialog_turns(dialog, db_turns_by_index: dict[int, DialogTurn]) -> tuple[list[dict], set[tuple[str, str]]]:
    raw_turns = dialog.turns if isinstance(dialog.turns, list) else []
    normalized_turns: list[dict] = []
    key_pairs: set[tuple[str, str]] = set()
    if raw_turns:
        for index, turn in enumerate(raw_turns):
            if not isinstance(turn, dict):
                continue
            _append_normalized_dialog_turn(
                normalized_turns,
                key_pairs,
                turn_index=index,
                source_text=turn.get("source_text", ""),
                target_text=turn.get("target_text", ""),
                speaker=turn.get("speaker", ""),
            )
        return normalized_turns, key_pairs

    for turn in db_turns_by_index.values():
        _append_normalized_dialog_turn(
            normalized_turns,
            key_pairs,
            turn_index=turn.turn_index,
            source_text=turn.source_text,
            target_text=turn.target_text,
        )
    return normalized_turns, key_pairs


def _append_normalized_dialog_turn(
    normalized_turns: list[dict],
    key_pairs: set[tuple[str, str]],
    *,
    turn_index: int,
    source_text: str,
    target_text: str,
    speaker: str = "",
) -> None:
    normalized_source = str(source_text or "").strip()
    normalized_target = str(target_text or "").strip()
    normalized_turns.append(
        {
            "turn_index": turn_index,
            "source_text": normalized_source,
            "target_text": normalized_target,
            "speaker": normalize_dialog_speaker(speaker, len(normalized_turns)),
        }
    )
    if normalized_source and normalized_target:
        key_pairs.add((normalized_source.lower(), normalized_target.lower()))


def _turn_audio_by_index(db_turns_by_index: dict[int, DialogTurn]) -> dict[int, str]:
    return {
        turn.turn_index: str(turn.audio_url or "")
        for turn in db_turns_by_index.values()
        if str(turn.audio_url or "").strip()
    }


def _phrase_audio_by_key(
    key_pairs: set[tuple[str, str]],
    *,
    user,
    source_language: str,
    target_language: str,
) -> dict[tuple[str, str], str]:
    if not key_pairs:
        return {}
    query = Q()
    for source_text, target_text in key_pairs:
        query |= Q(spanish_text__iexact=source_text, german_text__iexact=target_text)
    phrase_items = apply_user_scope(Item.objects, user).filter(
        item_type=Item.ItemType.PHRASE,
        source_language=source_language,
        target_language=target_language,
    ).filter(query).values("spanish_text", "german_text", "audio_url")
    return {
        (str(item["spanish_text"]).strip().lower(), str(item["german_text"]).strip().lower()): str(item["audio_url"] or "")
        for item in phrase_items
    }


def _dialog_turn_audio_payloads(
    normalized_turns: list[dict],
    *,
    phrase_audio_by_key: dict[tuple[str, str], str],
    turn_audio_by_index: dict[int, str],
) -> list[dict]:
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


def _resolve_dialog_turn(*, user, dialog_id_raw, turn_index_raw) -> tuple[SavedDialog, DialogTurn, int] | None:
    try:
        dialog_id = int(dialog_id_raw)
        turn_index = int(turn_index_raw)
    except (TypeError, ValueError):
        return None

    dialog = apply_user_scope(SavedDialog.objects, user).filter(id=dialog_id).first()
    if not dialog:
        return None
    turn = DialogTurn.objects.filter(dialog_id=dialog_id, turn_index=turn_index).first()
    if not turn:
        return None
    return dialog, turn, turn_index
