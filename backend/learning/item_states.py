from __future__ import annotations


def filter_new_items(queryset):
    return queryset.filter(
        is_learned=False,
        last_reviewed_at_es_to_de__isnull=True,
        last_reviewed_at_de_to_es__isnull=True,
    )


def is_new_item(item) -> bool:
    return (
        not bool(getattr(item, "is_learned", False))
        and getattr(item, "last_reviewed_at_es_to_de", None) is None
        and getattr(item, "last_reviewed_at_de_to_es", None) is None
    )
