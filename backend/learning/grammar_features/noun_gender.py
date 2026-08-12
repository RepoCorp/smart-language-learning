from __future__ import annotations

from ..models import Item, ItemGrammarFeature


GERMAN_NOUN_GENDER_FEATURES = {
    "masculine": "german.noun.gender.masculine",
    "feminine": "german.noun.gender.feminine",
    "neuter": "german.noun.gender.neuter",
}
GERMAN_NOUN_GENDER_FEATURE_KEYS = frozenset(GERMAN_NOUN_GENDER_FEATURES.values())
GERMAN_NOUN_GENDER_BY_ARTICLE = {"der": "masculine", "die": "feminine", "das": "neuter"}


def german_noun_gender_feature(target_text: str) -> str:
    article = (target_text or "").strip().split(" ", 1)[0].lower()
    gender = GERMAN_NOUN_GENDER_BY_ARTICLE.get(article, "")
    return GERMAN_NOUN_GENDER_FEATURES.get(gender, "")


def sync_item_grammar_features(item: Item) -> None:
    desired_features: set[str] = set()
    if (
        item.item_type == Item.ItemType.WORD
        and item.target_language == "german"
        and (item.word_type or "").strip().lower() == "noun"
    ):
        feature_key = german_noun_gender_feature(item.german_text)
        if feature_key:
            desired_features.add(feature_key)

    item.grammar_features.filter(feature_key__in=GERMAN_NOUN_GENDER_FEATURE_KEYS).exclude(
        feature_key__in=desired_features,
    ).delete()
    existing_features = set(
        item.grammar_features.filter(feature_key__in=desired_features).values_list("feature_key", flat=True),
    )
    ItemGrammarFeature.objects.bulk_create(
        [ItemGrammarFeature(item=item, feature_key=feature_key) for feature_key in desired_features - existing_features],
        ignore_conflicts=True,
    )
