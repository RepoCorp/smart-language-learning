import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from learning.models import Item, UserAuthToken
from learning.learning_content.patterns.affix.languages.german.keit import KEIT


PAIR = {"source_language": "spanish", "target_language": "german"}


@pytest.fixture
def enrolled():
    user = get_user_model().objects.create_user(username="evaluation-learner")
    client = APIClient()
    token = UserAuthToken.objects.create(user=user)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token.key}")
    response = client.post("/api/word-formation", {**PAIR, "pattern_key": KEIT.key}, format="json")
    assert response.status_code == 201
    return client, Item.objects.get(pk=response.json()["id"])


def load(client, item, **overrides):
    response = client.get(f"/api/session/items/{item.id}", {
        **PAIR, "direction": "es_to_de", "mode": "review", **overrides,
    })
    assert response.status_code == 200
    return response.json()


@pytest.mark.django_db
@pytest.mark.parametrize("correct", [True, False])
def test_scores_rotate_only_production_and_preserve_pinned_payload(enrolled, correct):
    client, item = enrolled
    assert client.post("/api/seen", {"item_id": item.id}, format="json").status_code == 200
    item.refresh_from_db()
    recognition_before = (item.due_at_de_to_es, item.review_count_de_to_es, item.repetition_count_de_to_es)
    first = load(client, item, review_version=0)
    evaluation = first["learning_evaluation"]
    assert evaluation == {"id": "affix_production", "content": {
        "base": "möglich", "base_translation": "posible", "meaning": "la posibilidad",
        "answer": "die Möglichkeit", "highlight": [11, 15],
    }}
    assert load(client, item, direction="de_to_es")["learning_evaluation"]["id"] == "affix_recognition"
    assert "learning_evaluation" not in load(client, item, mode="new", direction="")
    data = {"item_id": item.id, "direction": "es_to_de", "correct": correct, "review_version": 0}
    assert client.post("/api/review", data, format="json").status_code == 200
    assert client.post("/api/review", data, format="json").status_code == 200
    item.refresh_from_db()
    assert item.review_count_es_to_de == 1
    assert (item.due_at_de_to_es, item.review_count_de_to_es, item.repetition_count_de_to_es) == recognition_before
    assert not item.is_difficult
    assert load(client, item, review_version=0)["learning_evaluation"] == evaluation
    assert load(client, item)["learning_evaluation"]["content"]["answer"] == "die Sauberkeit"
    assert client.post("/api/session/restore-item-state", {
        "item_id": item.id, "state": first["session_restore_state"],
    }, format="json").status_code == 200
    assert load(client, item)["learning_evaluation"] == evaluation


@pytest.mark.django_db
@pytest.mark.parametrize("direction", ["es_to_de", "de_to_es"])
def test_all_examples_cycle_after_successes_and_failures(enrolled, direction):
    client, item = enrolled
    for version, example in enumerate(KEIT.examples):
        payload = load(client, item, direction=direction)
        assert payload["review_version"] == version
        expected = example.result if direction == "es_to_de" else example.translations["spanish"]["result"]
        assert payload["learning_evaluation"]["content"]["answer"] == expected
        assert client.post("/api/review", {
            "item_id": item.id, "direction": direction, "correct": version % 2 == 0, "review_version": version,
        }, format="json").status_code == 200
    expected = KEIT.examples[0].result if direction == "es_to_de" else KEIT.examples[0].translations["spanish"]["result"]
    assert load(client, item, direction=direction)["learning_evaluation"]["content"]["answer"] == expected


@pytest.mark.django_db
@pytest.mark.parametrize("correct", [True, False])
def test_recognition_scores_preserve_production_and_pinned_attempt(enrolled, correct):
    client, item = enrolled
    assert client.post("/api/seen", {"item_id": item.id}, format="json").status_code == 200
    item.refresh_from_db()
    production_before = (item.due_at_es_to_de, item.review_count_es_to_de, item.repetition_count_es_to_de)
    first = load(client, item, direction="de_to_es", review_version=0)
    assert first["learning_evaluation"] == {"id": "affix_recognition", "content": {
        "base": "möglich", "base_translation": "posible", "word": "die Möglichkeit", "answer": "la posibilidad",
    }}
    data = {"item_id": item.id, "direction": "de_to_es", "correct": correct, "review_version": 0}
    for _ in range(2):
        assert client.post("/api/review", data, format="json").status_code == 200
    item.refresh_from_db()
    assert item.review_count_de_to_es == 1
    assert (item.due_at_es_to_de, item.review_count_es_to_de, item.repetition_count_es_to_de) == production_before
    assert not item.is_difficult
    assert load(client, item, direction="de_to_es", review_version=0)["learning_evaluation"] == first["learning_evaluation"]
    assert load(client, item, direction="de_to_es")["learning_evaluation"]["content"]["answer"] == "la limpieza"
    assert client.post("/api/session/restore-item-state", {
        "item_id": item.id, "state": first["session_restore_state"],
    }, format="json").status_code == 200
    assert load(client, item, direction="de_to_es")["learning_evaluation"] == first["learning_evaluation"]


@pytest.mark.parametrize("language, meaning", [("english", "the possibility"), ("spanish", "la posibilidad")])
def test_recognition_preparation_uses_selected_translation_without_fallback(language, meaning):
    from dataclasses import replace
    from learning.learning_content.patterns.affix.evaluations import prepare_recognition

    assert prepare_recognition(KEIT, language, 0)["answer"] == meaning
    assert prepare_recognition(KEIT, "missing", 0) is None
    assert prepare_recognition(replace(KEIT, examples=()), language, 0) is None


def test_dispatch_is_registered_and_missing_content_is_not_replaced():
    from dataclasses import replace
    from types import SimpleNamespace
    from learning.learning_content.patterns.affix.evaluations import prepare_production
    from learning.learning_content.session import evaluation_payload

    item = SimpleNamespace(pattern_key=KEIT.key, target_language="german", source_language="english")
    assert evaluation_payload(item, "es_to_de", 1)["learning_evaluation"]["content"]["meaning"] == "the cleanliness"
    item.source_language = "missing"
    assert evaluation_payload(item, "es_to_de", 0)["learning_evaluation"]["content"] is None
    item.pattern_key = "unregistered"
    assert evaluation_payload(item, "es_to_de", 0) == {}
    assert prepare_production(replace(KEIT, examples=()), "spanish", 0) is None


@pytest.mark.parametrize("language, expected", [
    ("spanish", ["la posibilidad", "la limpieza", "la amabilidad", "la tristeza", "la cortesía", "la soledad"]),
    ("english", ["the possibility", "the cleanliness", "the friendliness", "the sadness", "the politeness", "the loneliness"]),
])
def test_production_meanings_include_the_noun_article(language, expected):
    from learning.learning_content.patterns.affix.evaluations import prepare_production

    meanings = [prepare_production(KEIT, language, index)["meaning"] for index in range(len(KEIT.examples))]
    assert meanings == expected
