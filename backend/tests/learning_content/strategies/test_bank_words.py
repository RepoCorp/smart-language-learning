from dataclasses import replace

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from learning.learning_content.patterns.affix.bank_words import matching_words
from learning.learning_content.patterns.affix.languages.german.keit import KEIT
from learning.models import Item, UserAuthToken


URL = "/api/learning-content/german_suffix_keit/strategies/affix_bank_words/words"
pytestmark = pytest.mark.django_db


@pytest.fixture
def learner():
    user = get_user_model().objects.create_user(username="learner")
    token = UserAuthToken.objects.create(user=user)
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token.key}")
    return user, client


def word(user, text="die Möglichkeit", **kwargs):
    defaults = dict(user=user, item_type="word", word_type="noun", german_text=text,
                    spanish_text="la posibilidad", source_language="spanish", target_language="german")
    return Item.objects.create(**(defaults | kwargs))


def test_only_own_words_in_selected_pair_without_progress_changes(learner):
    user, client = learner
    saved = word(user, is_learned=True, review_count_es_to_de=4)
    unstarted = word(user, "die Sauberkeit")
    for overrides in [dict(user=None), dict(user=get_user_model().objects.create_user(username="other")),
                      dict(source_language="english"), dict(target_language="english"),
                      dict(item_type="phrase"), dict(item_type="pattern"), dict(word_type="adjective")]:
        other_user = overrides.pop("user", user)
        word(other_user, "die Freundlichkeit", **overrides)
    before = list(Item.objects.values())
    response = client.get(URL, {"source_language": "spanish"})
    assert response.status_code == 200
    assert response["Cache-Control"] == "no-store"
    assert response.json() == {"words": [
        {"id": unstarted.id, "text": unstarted.german_text, "translation": unstarted.spanish_text},
        {"id": saved.id, "text": saved.german_text, "translation": saved.spanish_text},
    ], "next_offset": None}
    assert list(Item.objects.values()) == before


@pytest.mark.parametrize("text,expected", [
    ("Möglichkeit", True), ("DIE MÖGLICHKEIT", True), (" die Möglichkeit ", True),
    ("die Möglichkeiten", False), ("die Keit", False), ("keit", False),
    ("die Heiterkeit", True), ("die Möglichkeit heute", False), ("glücklich", False),
])
def test_suffix_matching_is_anchored_case_insensitive_and_preserves_text(learner, text, expected):
    user, client = learner
    item = word(user, text)
    rows = client.get(URL, {"source_language": "spanish"}).json()["words"]
    assert rows == ([{"id": item.id, "text": text, "translation": "la posibilidad"}] if expected else [])


def test_prefix_matcher_is_defined_by_pattern_not_language(learner):
    user, _ = learner
    definition = replace(KEIT, affix="un-", position="prefix", word_types=("adjective",))
    matching = word(user, "unglücklich", word_type="adjective")
    word(user, "gesund", word_type="adjective")
    word(user, "un", word_type="adjective")
    assert list(matching_words(Item.objects.all(), definition)) == [matching]


def test_pagination_after_matching_is_stable_and_shortest_first(learner):
    user, client = learner
    for n in range(25):
        word(user, f"{'a' * (27 - n)}keit")
    word(user, "a")
    expected = sorted(Item.objects.exclude(german_text="a"), key=lambda item: (len(item.german_text), item.id))
    first = client.get(URL, {"source_language": "spanish"}).json()
    second = client.get(URL, {"source_language": "spanish", "offset": first["next_offset"]}).json()
    assert [row["id"] for row in first["words"] + second["words"]] == [item.id for item in expected]
    assert len(first["words"]) == 20
    assert second["next_offset"] is None


def test_empty_bank_is_not_replaced_by_curated_examples(learner):
    assert learner[1].get(URL, {"source_language": "spanish"}).json() == {"words": [], "next_offset": None}


def test_authentication_is_required():
    assert APIClient().get(URL, {"source_language": "spanish"}).status_code == 401


@pytest.mark.parametrize("params", [{}, {"source_language": "unknown"}, {"source_language": "german"},
                                   {"source_language": "spanish", "offset": "bad"},
                                   {"source_language": "spanish", "offset": -1}])
def test_invalid_requests(learner, params):
    assert learner[1].get(URL, params).status_code == 400


@pytest.mark.parametrize("url", [URL.replace("german_suffix_keit", "unknown"),
                                URL.replace("affix_bank_words", "affix_examples")])
def test_unregistered_strategy_is_not_substituted(learner, url):
    assert learner[1].get(url, {"source_language": "spanish"}).status_code == 404


@pytest.mark.parametrize("method", ["post", "put", "patch", "delete"])
def test_read_only(learner, method):
    assert getattr(learner[1], method)(URL).status_code == 405
