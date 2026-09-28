import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from learning.models import Item, ItemGrammarFeature, UserAuthToken
from learning.srs import build_session_restore_state
from learning.views.content.conversation_error_exercises import add_conversation_error_exercises


pytestmark = pytest.mark.django_db
FEATURE = "verb_position_main_clause"


def phrase(user, text="Ich gehe.", source="spanish", target="german", feature=FEATURE):
    item = Item.objects.create(
        user=user, item_type="phrase", german_text=text, spanish_text="Voy.",
        source_language=source, target_language=target,
    )
    ItemGrammarFeature.objects.create(item=item, feature_key=feature)
    return item


def add(user, keys=None, words=None, source="spanish", target="german"):
    return add_conversation_error_exercises(
        user=user, source_language=source, target_language=target,
        grammar_feature_keys=keys if keys is not None else [FEATURE],
        word_item_targets=words or [],
    )


def test_selects_shortest_owned_phrase_in_exact_language_pair_with_stable_ties():
    user = get_user_model().objects.create_user(username="practice-owner")
    other = get_user_model().objects.create_user(username="other-owner")
    excluded = [
        phrase(other, "X"), phrase(None, "X"),
        phrase(user, "X", source="english"), phrase(user, "X", target="english"),
        phrase(user, "Ich gehe heute zur Arbeit."),
    ]
    first = phrase(user, "Ich gehe.")
    second = phrase(user, "Ich sehe.")
    assert add(user) == [first.id]
    assert Item.objects.filter(is_difficult=True).count() == 1
    for item in [*excluded, second]:
        item.refresh_from_db()
        assert not item.is_difficult


@pytest.mark.parametrize("target,feature,text", [
    ("german", FEATURE, "Ich gehe."),
    ("english", "english_subject_verb_object", "I like coffee."),
    ("spanish", "spanish_subject_verb_agreement", "Yo trabajo aquí."),
])
def test_matches_features_from_each_supported_language_catalog(target, feature, text):
    source = "english" if target == "spanish" else "spanish"
    item = phrase(None, text, source=source, target=target, feature=feature)
    assert add(None, [feature], source=source, target=target) == [item.id]
    item.refresh_from_db()
    assert item.difficult_grammar_feature_keys == [feature]


def test_unknown_or_unmatched_rules_do_not_create_content_or_invent_a_match():
    item = phrase(None)
    before = build_session_restore_state(item)
    assert add(None, ["unknown", "imperative"], words=["not-saved"]) == []
    item.refresh_from_db()
    assert build_session_restore_state(item) == before
    assert Item.objects.count() == 1


def test_multiple_rules_for_one_phrase_add_it_once_and_do_not_change_srs():
    item = phrase(None, "Ich muss gehen.")
    ItemGrammarFeature.objects.create(item=item, feature_key="modal_verb_with_infinitive")
    before = build_session_restore_state(item)
    assert add(None, [FEATURE, FEATURE, "modal_verb_with_infinitive"]) == [item.id]
    item.refresh_from_db()
    assert item.difficult_grammar_feature_keys == sorted([FEATURE, "modal_verb_with_infinitive"])
    after = build_session_restore_state(item)
    for key, value in before.items():
        if not key.startswith("difficult_") and key != "is_difficult":
            assert after[key] == value


def test_word_matching_normalizes_determiners_case_and_punctuation_without_substring_matching():
    word = Item.objects.create(item_type="word", german_text="der Hund", spanish_text="perro")
    other = Item.objects.create(item_type="word", german_text="der Hundetrainer", spanish_text="adiestrador")
    assert add(None, [], ["  DEN Hund! ", "Hund", " "]) == [word.id]
    word.refresh_from_db()
    other.refresh_from_db()
    assert word.is_difficult
    assert word.difficult_grammar_feature_keys == []
    assert not other.is_difficult


@pytest.mark.parametrize("field,value", [
    ("grammar_feature_keys", FEATURE), ("grammar_feature_keys", None),
    ("word_item_targets", "Hund"), ("word_item_targets", {}),
])
def test_endpoint_rejects_non_list_selections_without_scheduling_anything(field, value):
    item = phrase(None)
    response = APIClient().post("/api/content/conversation/error-exercises", {
        "grammar_feature_keys": [FEATURE], "word_item_targets": [], field: value,
    }, format="json")
    assert response.status_code == 400
    item.refresh_from_db()
    assert not item.is_difficult


def test_endpoint_uses_authenticated_user_and_returns_selected_ids():
    user = get_user_model().objects.create_user(username="endpoint-learner")
    owned = phrase(user)
    unowned = phrase(None, "X")
    token = UserAuthToken.objects.create(user=user)
    response = APIClient().post("/api/content/conversation/error-exercises", {
        "grammar_feature_keys": [FEATURE], "word_item_targets": [],
    }, format="json", HTTP_AUTHORIZATION=f"Bearer {token.key}")
    assert response.status_code == 200
    assert response.json() == {"added_item_ids": [owned.id]}
    unowned.refresh_from_db()
    assert not unowned.is_difficult
