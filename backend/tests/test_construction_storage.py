from datetime import timedelta
from unittest.mock import Mock

import pytest
from django.contrib.auth import get_user_model
from django.core import signing
from django.utils import timezone
from rest_framework.test import APIClient

from learning.construction_patterns import CATALOGS
from learning.construction_patterns.storage import savable_preview
from learning.models import Item, UserAuthToken
from learning.srs import build_session_restore_state
from learning.views.content import dialog_click_resolution

PAIR = {"source_language": "spanish", "target_language": "german"}


@pytest.fixture
def learner():
    user = get_user_model().objects.create_user(username="construction-learner")
    client = APIClient()
    token = UserAuthToken.objects.create(user=user)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token.key}")
    return client, user


def preview(user, key="separable_verb"):
    return savable_preview({
        "key": key, "form": CATALOGS["german"][key]["form"], "meaning": "levantarse",
        "explanation": "Las partes separadas forman un verbo.",
        "example": "Ich stehe auf.", "matched_parts": ["stehe", "auf"],
        "replaces_word": key != "separable_verb",
    }, user=user, **PAIR)


def save(client, data):
    return client.post("/api/construction-patterns", {"save_token": data["save_token"]}, format="json")


@pytest.mark.django_db
@pytest.mark.parametrize("key", list(CATALOGS["german"]))
def test_save_is_independent_idempotent_and_does_not_request_a_model(learner, monkeypatch, key):
    client, user = learner
    model = Mock(side_effect=AssertionError("Saving must not generate content"))
    monkeypatch.setattr(dialog_click_resolution, "call_openai_json", model)
    data = preview(user, key)
    first, second = save(client, data), save(client, data)
    assert first.status_code == 201 and second.status_code == 200
    assert first.json()["id"] == second.json()["id"]
    item = Item.objects.get()
    assert item.item_type == "pattern" and item.pattern_key == key
    assert item.example_sentence == data["example"] and item.notes == data["explanation"]
    assert item.spanish_text == (data["meaning"] if data["replaces_word"] else "")
    assert preview(user, key)["saved_id"] == item.pk
    assert item.last_reviewed_at_es_to_de is None
    model.assert_not_called()


@pytest.mark.django_db
def test_preview_endpoint_returns_a_savable_token(learner, monkeypatch):
    client, _ = learner
    model = Mock(return_value={
        "construction_pattern_key": "future_with_werden", "construction_evidence": ["wird", "kommen"],
        "source_text": "Hablar del futuro", "target_text": "werden", "word_type": "helper",
        "note": "Estas palabras hablan de una acción futura.",
    })
    monkeypatch.setattr(dialog_click_resolution, "call_openai_json", model)
    response = client.post("/api/content/words/add?source_language=spanish&target_language=german", {
        "source_text": "wird", "target_text": "wird", "clicked_target_token": "wird",
        "target_line": "Er wird kommen.", "check_only": True,
    }, format="json")
    assert response.status_code == 200
    assert save(client, response.json()["construction_pattern"]).status_code == 201
    model.assert_called_once()


@pytest.mark.django_db
def test_storage_is_scoped_and_rejects_invalid_tokens(learner):
    client, user = learner
    data = preview(user)
    assert save(APIClient(), data).status_code == 401
    other = get_user_model().objects.create_user(username="other-construction-learner")
    assert save(client, preview(other)).status_code == 400
    assert save(client, {"save_token": data["save_token"] + "tampered"}).status_code == 400
    assert client.post("/api/construction-patterns", {}, format="json").status_code == 400
    assert Item.objects.count() == 0


@pytest.mark.django_db
def test_expired_preview_is_rejected(learner, monkeypatch):
    client, user = learner
    data = preview(user)
    now = signing.time.time()
    monkeypatch.setattr(signing.time, "time", lambda: now + 86401)
    assert save(client, data).status_code == 400
    assert not Item.objects.exists()


@pytest.mark.django_db
def test_construction_enters_normal_session_and_stats(learner):
    client, user = learner
    item_id = save(client, preview(user)).json()["id"]
    assert client.get("/api/content/items", {**PAIR, "section": "patterns"}).json()["items"][0]["id"] == item_id
    detail = client.get(f"/api/content/items/{item_id}", PAIR)
    assert detail.status_code == 200
    assert detail.json()["exercise_phrases"]["generation_mode"] == "construction_pattern"
    plan = client.get("/api/session", PAIR).json()["items"]
    assert plan[0]["id"] == item_id and plan[0]["mode"] == "new"
    stats = client.get("/api/overview-stats", PAIR).json()
    assert stats["saved_items"] == stats["saved_pattern_items"] == 1
    assert stats["not_started"] == 1
    assert stats["ready_to_review"] == stats["future_reviews"] == 0
    response = client.get(f"/api/session/items/{item_id}", {**PAIR, "mode": "new"})
    assert response.status_code == 200
    assert response.json()["exercise_phrases"]["generation_mode"] == "construction_pattern"
    assert client.post("/api/seen", {"item_id": item_id}, format="json").status_code == 200
    item = Item.objects.get(pk=item_id)
    assert item.due_at_es_to_de != item.due_at_de_to_es
    now = timezone.now()
    Item.objects.filter(pk=item_id).update(last_reviewed_at_es_to_de=now, due_at_es_to_de=now,
        last_reviewed_at_de_to_es=now, due_at_de_to_es=now + timedelta(days=4))
    assert client.get("/api/session", PAIR).json()["items"][0]["id"] == item_id
    stats = client.get("/api/overview-stats", PAIR).json()
    assert stats["ready_to_review"] == stats["future_reviews"] == 1
    assert client.delete(f"/api/content/items/{item_id}?source_language=spanish&target_language=german").status_code == 204
    assert preview(user)["saved_id"] is None


@pytest.mark.django_db
@pytest.mark.parametrize("key", list(CATALOGS["german"]))
def test_construction_reviews_preserve_independent_directions_and_reset(learner, key):
    client, user = learner
    item_id = save(client, preview(user, key)).json()["id"]
    client.post("/api/seen", {"item_id": item_id}, format="json")
    item = Item.objects.get(pk=item_id)
    state = build_session_restore_state(item)
    for direction in ("es_to_de", "de_to_es"):
        response = client.get(f"/api/session/items/{item_id}", {**PAIR, "mode": "review", "direction": direction})
        assert response.status_code == 200
        data = response.json()
        assert data["review_version"] == 0
        assert data["notes"] and data["example_sentence"]
        assert data["exercise_phrases"]["generation_mode"] == "construction_pattern"
        other = "de_to_es" if direction == "es_to_de" else "es_to_de"
        before_other = (getattr(item, f"due_at_{other}"), getattr(item, f"review_count_{other}"))
        review = {"item_id": item_id, "correct": direction == "es_to_de", "direction": direction, "review_version": 0}
        assert client.post("/api/review", review, format="json").status_code == 200
        assert client.post("/api/review", review, format="json").status_code == 200
        item.refresh_from_db()
        assert getattr(item, f"review_count_{direction}") == 1
        assert (getattr(item, f"due_at_{other}"), getattr(item, f"review_count_{other}")) == before_other
        assert not item.is_difficult
    assert client.post("/api/session/restore-item-state", {"item_id": item_id, "state": state}, format="json").status_code == 200
    item.refresh_from_db()
    assert item.review_count_es_to_de == item.review_count_de_to_es == 0
