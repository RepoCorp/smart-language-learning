import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from learning.models import Item, UserAuthToken
from learning.srs import build_session_restore_state


pytestmark = pytest.mark.django_db


@pytest.fixture
def learner():
    user = get_user_model().objects.create_user(username="session-boundary-learner")
    token = UserAuthToken.objects.create(user=user)
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token.key}")
    item = Item.objects.create(
        user=user, item_type="word", german_text="arbeiten", spanish_text="trabajar",
        source_language="spanish", target_language="german",
        review_count_es_to_de=2,
    )
    return client, item


def payload(client, item, **query):
    return client.get(f"/api/session/items/{item.id}", {
        "mode": "review", "direction": "es_to_de", **query,
    })


@pytest.mark.parametrize("query,detail", [
    ({"mode": ""}, "Invalid session mode"),
    ({"mode": "test"}, "Invalid session mode"),
    ({"direction": "invalid"}, "Invalid review direction"),
    ({"direction": ""}, "A review direction is required"),
    ({"repeat_practice_step": "unknown"}, "Invalid practice step"),
    ({"review_version": "NaN"}, "Invalid review version"),
    ({"review_version": "1.5"}, "Invalid review version"),
    ({"review_version": "-1"}, "Invalid review version"),
    ({"review_version": "3"}, "Invalid review version"),
    ({"mode": "new", "review_version": "0"}, "Invalid review version"),
])
def test_rejects_invalid_session_payload_parameters_without_mutating_progress(learner, query, detail):
    client, item = learner
    before = build_session_restore_state(item)
    response = payload(client, item, **query)
    assert response.status_code == 400
    assert response.json() == {"detail": detail}
    item.refresh_from_db()
    assert build_session_restore_state(item) == before


@pytest.mark.parametrize("version", [0, 1, 2])
def test_accepts_current_and_historical_review_versions(learner, version):
    client, item = learner
    assert payload(client, item, review_version=version).status_code == 200
    item.refresh_from_db()
    assert item.review_count_es_to_de == 2


def test_review_version_is_checked_against_the_requested_direction(learner):
    client, item = learner
    assert payload(client, item, direction="de_to_es", review_version=1).status_code == 400


def test_new_items_have_no_review_direction_even_if_one_was_supplied(learner):
    client, item = learner
    response = payload(client, item, mode="new", direction="de_to_es")
    assert response.status_code == 200
    assert response.json()["mode"] == "new"
    assert response.json()["direction"] is None


@pytest.mark.parametrize("unavailable", ["other-user", "unowned", "source", "target", "learned", "deleted"])
def test_hides_items_outside_the_current_users_active_learning_pool(learner, unavailable):
    client, item = learner
    if unavailable == "other-user":
        item.user = get_user_model().objects.create_user(username="someone-else")
    elif unavailable == "unowned":
        item.user = None
    elif unavailable == "source":
        item.source_language = "english"
    elif unavailable == "target":
        item.target_language = "english"
    elif unavailable == "learned":
        item.is_learned = True
    if unavailable == "deleted":
        item_id = item.id
        item.delete()
        item.id = item_id
    else:
        item.save()
    response = payload(client, item)
    assert response.status_code == 404
    assert response.json() == {"detail": "Item not found"}


def test_no_token_cannot_access_an_owned_item(learner):
    _, item = learner
    assert payload(APIClient(), item).status_code == 404


@pytest.mark.parametrize("endpoint", ["difficult-items/complete", "session/restore-item-state"])
def test_cannot_complete_or_reset_someone_elses_practice(learner, endpoint):
    client, own_item = learner
    other = get_user_model().objects.create_user(username="other-practice-owner")
    item = Item.objects.create(
        user=other, item_type="phrase", german_text="Ich gehe.", spanish_text="Voy.",
        is_difficult=True, difficult_grammar_feature_keys=["verb_position_main_clause"],
    )
    before = build_session_restore_state(item)
    response = client.post(f"/api/{endpoint}", {
        "item_id": item.id, "state": build_session_restore_state(own_item),
    }, format="json")
    assert response.status_code == 404
    item.refresh_from_db()
    assert build_session_restore_state(item) == before


@pytest.mark.parametrize("step", ["word_intro", "word_cloze", "word_parts", "phrase_builder", "phrase_progressive_blocks"])
def test_preserves_supported_practice_steps(learner, step):
    client, item = learner
    if step.startswith("phrase_"):
        item.item_type = "phrase"
        item.save(update_fields=["item_type"])
    response = payload(client, item, repeat_practice_step=step, repeated_after_failure="true")
    assert response.status_code == 200
    assert response.json()["repeatPracticeStep"] == step
    assert response.json()["repeatedAfterFailure"] is True
