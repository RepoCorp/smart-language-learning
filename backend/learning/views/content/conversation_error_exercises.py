from __future__ import annotations

import re

from django.db import transaction
from django.db.models.functions import Length
from django.utils import timezone

from ...auth import apply_user_scope
from ...grammar_features import phrase_grammar_features_for_language
from ...models import Item

_WORD_PREFIX_RE = re.compile(
    r"^(?:der|die|das|den|dem|des|ein|eine|einen|einem|einer|eines)\s+",
    re.IGNORECASE,
)


@transaction.atomic
def add_conversation_error_exercises(
    *,
    user,
    source_language: str,
    target_language: str,
    grammar_feature_keys: list[str],
    word_item_targets: list[str],
) -> list[int]:
    item_ids: set[int] = set()
    feature_keys_by_item: dict[int, set[str]] = {}
    phrases = apply_user_scope(Item.objects, user).filter(
        item_type=Item.ItemType.PHRASE,
        source_language=source_language,
        target_language=target_language,
    )
    for feature_key in set(grammar_feature_keys).intersection(phrase_grammar_features_for_language(target_language)):
        example = (
            phrases.filter(grammar_features__feature_key=feature_key)
            .annotate(target_length=Length("german_text"))
            .order_by("target_length", "id")
            .first()
        )
        if example:
            item_ids.add(example.id)
            feature_keys_by_item.setdefault(example.id, set()).add(feature_key)

    words = apply_user_scope(Item.objects, user).filter(
        item_type=Item.ItemType.WORD,
        source_language=source_language,
        target_language=target_language,
    )
    normalized_targets = {
        normalized
        for value in word_item_targets
        if (normalized := _normalized_word_target(value))
    }
    for item in words:
        if _normalized_word_target(item.german_text) in normalized_targets:
            item_ids.add(item.id)

    scheduled_items = list(Item.objects.select_for_update().filter(id__in=item_ids))
    _mark_as_next_day_practice(scheduled_items, feature_keys_by_item)
    return sorted(item.id for item in scheduled_items)


def _normalized_word_target(text: str) -> str:
    normalized = " ".join(re.sub(r"[^\w\s-]", "", str(text).lower()).split())
    return _WORD_PREFIX_RE.sub("", normalized).strip()


def _mark_as_next_day_practice(items: list[Item], feature_keys_by_item: dict[int, set[str]]) -> None:
    if not items:
        return
    now = timezone.now()
    for item in items:
        existing_keys = item.difficult_grammar_feature_keys if item.is_difficult else []
        item.difficult_grammar_feature_keys = sorted(
            set(existing_keys) | feature_keys_by_item.get(item.id, set())
        )
        item.is_difficult = True
        item.difficult_marked_at = now
        item.updated_at = now
    Item.objects.bulk_update(
        items,
        [
            "is_difficult",
            "difficult_marked_at",
            "difficult_grammar_feature_keys",
            "updated_at",
        ],
    )
