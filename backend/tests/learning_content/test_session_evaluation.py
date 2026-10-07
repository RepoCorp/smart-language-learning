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
        "base": "möglich", "base_translation": "posible", "meaning": "posibilidad",
        "answer": "die Möglichkeit", "highlight": [11, 15],
    }}
    assert "learning_evaluation" not in load(client, item, direction="de_to_es")
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
def test_all_examples_cycle_after_successes_and_failures(enrolled):
    client, item = enrolled
    for version, example in enumerate(KEIT.examples):
        payload = load(client, item)
        assert payload["review_version"] == version
        assert payload["learning_evaluation"]["content"]["answer"] == example.result
        assert client.post("/api/review", {
            "item_id": item.id, "direction": "es_to_de", "correct": version % 2 == 0, "review_version": version,
        }, format="json").status_code == 200
    assert load(client, item)["learning_evaluation"]["content"]["answer"] == KEIT.examples[0].result


def test_dispatch_is_registered_and_missing_content_is_not_replaced():
    from dataclasses import replace
    from types import SimpleNamespace
    from learning.learning_content.patterns.affix.evaluations import prepare_production
    from learning.learning_content.session import evaluation_payload

    item = SimpleNamespace(pattern_key=KEIT.key, target_language="german", source_language="english")
    assert evaluation_payload(item, "es_to_de", 1)["learning_evaluation"]["content"]["meaning"] == "cleanliness"
    item.source_language = "missing"
    assert evaluation_payload(item, "es_to_de", 0)["learning_evaluation"]["content"] is None
    item.pattern_key = "unregistered"
    assert evaluation_payload(item, "es_to_de", 0) == {}
    assert prepare_production(replace(KEIT, examples=()), "spanish", 0) is None
