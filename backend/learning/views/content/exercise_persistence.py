from __future__ import annotations

from collections.abc import Callable

from django.db import transaction

from ...models import Item


def merge_item_exercise_phrases(item: Item, merge: Callable[[dict], dict]) -> dict:
    """Merge exercise data into the latest payload without losing another strategy's result."""
    with transaction.atomic():
        locked_item = Item.objects.select_for_update().get(pk=item.pk)
        merged_payload = merge(dict(locked_item.exercise_phrases or {}))
        locked_item.exercise_phrases = merged_payload
        locked_item.save(update_fields=["exercise_phrases", "updated_at"])
    return merged_payload


def replace_forms_exercise_payload(*, existing_payload: dict, forms_payload: dict) -> dict:
    """Replace Forms data while retaining the independently generated strategy data."""
    payload = dict(existing_payload or {})
    for key in ("phrases", "sections", "generation_mode"):
        payload.pop(key, None)
    payload.update(forms_payload)
    return payload
