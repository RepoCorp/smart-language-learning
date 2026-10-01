from django.core import signing

from ..models import Item
from . import CATALOGS

SALT = "construction-pattern-preview-v1"


def is_construction_pattern(item):
    return item.item_type == Item.ItemType.PATTERN and item.pattern_key in CATALOGS.get(item.target_language, {})


def savable_preview(preview, *, user, source_language, target_language):
    saved = Item.objects.filter(
        user=user, item_type=Item.ItemType.PATTERN, pattern_key=preview["key"],
        source_language=source_language, target_language=target_language,
    ).first()
    token = signing.dumps({
        "user_id": user.pk if user else None,
        "source_language": source_language, "target_language": target_language,
        "preview": preview,
    }, salt=SALT, compress=True)
    return {**preview, "save_token": token, "saved_id": saved.pk if saved else None}


def save_preview(token, *, user):
    data = signing.loads(token, salt=SALT, max_age=24 * 60 * 60)
    if data["user_id"] != user.pk:
        raise ValueError("Preview belongs to another user")
    preview = data["preview"]
    source, target = data["source_language"], data["target_language"]
    if preview["key"] not in CATALOGS.get(target, {}):
        raise ValueError("Unsupported construction pattern")
    # A separable verb's lexical translation describes the word, not the pattern.
    meaning = preview["meaning"] if preview["replaces_word"] else ""
    if len(meaning) > 255 or len(preview["form"]) > 255:
        raise ValueError("Construction label is too long")
    return Item.objects.get_or_create(
        user=user, item_type=Item.ItemType.PATTERN, pattern_key=preview["key"],
        source_language=source, target_language=target,
        defaults={
            "german_text": preview["form"], "spanish_text": meaning,
            "notes": preview["explanation"], "example_sentence": preview["example"],
            "exercise_phrases": {"generation_mode": "construction_pattern", "construction": preview},
        },
    )


def item_payload(item, direction=None, version=None):
    return {
        "pattern_key": item.pattern_key, "pattern_examples": [],
        "review_version": version if version is not None else getattr(item, f"review_count_{direction or 'es_to_de'}"),
        "notes": item.notes, "example_sentence": item.example_sentence,
        "exercise_phrases": item.exercise_phrases,
    }
