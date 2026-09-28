from datetime import timedelta

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient

from learning.models import Item, UserAuthToken

PAIR = {"source_language": "spanish", "target_language": "english"}


@pytest.fixture
def learner():
    user = get_user_model().objects.create_user(username="pattern-learner")
    client = APIClient()
    token = UserAuthToken.objects.create(user=user)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token.key}")
    return client, user


def enroll(client, key="english_suffix_less"):
    return client.post("/api/word-formation", {**PAIR, "pattern_key": key}, format="json")


def payload(client, item, direction="es_to_de", mode="review"):
    response = client.get(f"/api/session/items/{item.id}", {**PAIR, "direction": direction, "mode": mode})
    assert response.status_code == 200
    return response.json()


def review(client, item, direction, correct=True, version=0):
    return client.post("/api/review", {"item_id": item.id, "correct": correct,
                                      "direction": direction, "review_version": version}, format="json")


@pytest.mark.django_db
def test_enrolls_one_real_item_and_uses_the_common_new_item_flow(learner):
    client, user = learner
    first = enroll(client)
    assert first.status_code == 201
    item = Item.objects.get(pk=first.json()["id"], user=user)
    assert item.item_type == "pattern"
    assert item.pattern_key == "english_suffix_less"
    assert enroll(client).json()["id"] == item.id
    assert Item.objects.count() == 1
    plan = client.get("/api/session", PAIR).json()["items"]
    assert plan[0]["item_type"] == "pattern" and plan[0]["mode"] == "new"
    assert "exercise" not in plan[0]
    assert len(payload(client, item, mode="new")["pattern_examples"]) == 6
    assert client.post("/api/seen", {"item_id": item.id}, format="json").status_code == 200
    item.refresh_from_db()
    assert item.due_at_es_to_de != item.due_at_de_to_es
    assert item.review_count_es_to_de == item.review_count_de_to_es == 0
    from learning.models import DailyLearningProgress
    assert any(str(item.id) in key for key in DailyLearningProgress.objects.get(user=user).completed_entry_keys)


@pytest.mark.django_db
def test_both_directions_have_distinct_prompts_and_independent_progress(learner):
    client, user = learner
    item = Item.objects.get(pk=enroll(client).json()["id"])
    client.post("/api/seen", {"item_id": item.id}, format="json")
    item.refresh_from_db()
    reverse_before = (item.due_at_de_to_es, item.repetition_count_de_to_es)
    production = payload(client, item)
    recognition = payload(client, item, "de_to_es")
    assert production["pattern_exercise"]["question"] == "¿Cómo dirías «sin esperanza»?"
    assert recognition["pattern_exercise"]["question"] == "¿Qué significa «hopeless»?"
    assert production["pattern_exercise"]["base_translation"] == recognition["pattern_exercise"]["base_translation"] == "esperanza"
    assert review(client, item, "es_to_de").status_code == 200
    item.refresh_from_db()
    assert (item.due_at_de_to_es, item.repetition_count_de_to_es) == reverse_before
    assert item.review_count_es_to_de == 1 and item.review_count_de_to_es == 0
    assert payload(client, item)["pattern_exercise"]["base"] == "home"
    assert payload(client, item, "de_to_es")["pattern_exercise"]["base"] == "hope"
    forward_before = item.due_at_es_to_de
    assert review(client, item, "de_to_es", correct=False).status_code == 200
    item.refresh_from_db()
    assert item.due_at_es_to_de == forward_before
    assert item.review_count_de_to_es == 1
    assert not item.is_difficult  # No word typing/phrase blocks for a pattern.


@pytest.mark.django_db
def test_shared_review_is_idempotent_and_reset_restores_example_position(learner):
    client, _ = learner
    item = Item.objects.get(pk=enroll(client).json()["id"])
    before = payload(client, item)
    assert review(client, item, "es_to_de").status_code == 200
    assert review(client, item, "es_to_de", correct=False).status_code == 200
    item.refresh_from_db()
    assert item.review_count_es_to_de == item.repetition_count_es_to_de == 1
    response = client.post("/api/session/restore-item-state", {
        "item_id": item.id, "state": before["session_restore_state"],
    }, format="json")
    assert response.status_code == 200
    assert payload(client, item)["pattern_exercise"] == before["pattern_exercise"]


@pytest.mark.django_db
def test_pattern_participates_in_normal_pool_stats_and_management(learner):
    client, _ = learner
    item = Item.objects.get(pk=enroll(client).json()["id"])
    assert client.get("/api/content/items", {**PAIR, "section": "patterns"}).json()["items"][0]["id"] == item.id
    stats = client.get("/api/overview-stats", PAIR).json()
    assert stats["saved_pattern_items"] == stats["saved_items"] == stats["not_started"] == 1
    now = timezone.now()
    Item.objects.filter(pk=item.id).update(last_reviewed_at_es_to_de=now, due_at_es_to_de=now,
                                         last_reviewed_at_de_to_es=now, due_at_de_to_es=now + timedelta(days=4))
    stats = client.get("/api/overview-stats", PAIR).json()
    assert stats["ready_to_review"] == stats["future_reviews"] == 1
    entry = client.get("/api/session", {**PAIR, "size": 1}).json()["items"][0]
    assert entry["id"] == item.id and entry["direction"] == "es_to_de"
    assert client.delete(f"/api/content/items/{item.id}?source_language=spanish&target_language=english").status_code == 204
    assert client.get("/api/word-formation", PAIR).json()["saved"] == []


@pytest.mark.django_db
def test_patterns_cannot_generate_audio_or_word_phrase_content(learner):
    client, _ = learner
    item = Item.objects.get(pk=enroll(client).json()["id"])
    query = "?source_language=spanish&target_language=english"
    assert client.post(f"/api/content/items/{item.id}{query}", {}, format="json").status_code == 400
    assert client.post(f"/api/content/items/{item.id}/regenerate{query}", {}, format="json").status_code == 404


@pytest.mark.django_db
def test_pattern_item_and_review_are_user_scoped(learner):
    client, _ = learner
    item = Item.objects.get(pk=enroll(client).json()["id"])
    other = get_user_model().objects.create_user(username="other-pattern-learner")
    token = UserAuthToken.objects.create(user=other)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token.key}")
    assert client.get("/api/word-formation", PAIR).json()["saved"] == []
    assert review(client, item, "es_to_de").status_code == 404
    assert client.get(f"/api/session/items/{item.id}", {**PAIR, "mode": "review", "direction": "es_to_de"}).status_code == 404
