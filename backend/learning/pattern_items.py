"""Dispatch item details without sending constructions through affix exercises."""

from .construction_patterns.storage import is_construction_pattern, item_payload as construction_payload
from .word_formation import item_payload as affix_payload


def item_payload(item, direction=None, version=None):
    if is_construction_pattern(item):
        return construction_payload(item, direction, version)
    return affix_payload(item, direction, version)
