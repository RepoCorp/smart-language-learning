from ..auth import apply_user_scope
from ..models import Item


def new_item_candidates(*, user, source_language, target_language, excluded_item_ids, limit):
    new_items = list(
        apply_user_scope(Item.objects, user).filter(
            item_type__in=Item.ItemType.values,
            is_learned=False,
            source_language=source_language,
            target_language=target_language,
            last_reviewed_at_es_to_de__isnull=True,
            last_reviewed_at_de_to_es__isnull=True,
        ).exclude(id__in=excluded_item_ids).order_by("created_at", "id")[:limit]
    )
    return new_items
