from __future__ import annotations

from ...models import Item


def compare_words_payload(item: Item) -> list[dict]:
    if item.item_type != Item.ItemType.WORD:
        return []
    return list(
        item.confusing_with.filter(item_type=Item.ItemType.WORD)
        .order_by("german_text", "spanish_text", "id")
        .values(
            "id",
            "item_type",
            "spanish_text",
            "german_text",
            "word_type",
            "plural_german",
            "audio_url",
            "exercise_phrases",
            "created_at",
        )
    )
