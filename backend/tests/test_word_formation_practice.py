from datetime import datetime, timedelta, timezone as dt_timezone
from zoneinfo import ZoneInfo

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient

from learning.models import Item, UserAuthToken


@pytest.fixture
def client_user():
    user = get_user_model().objects.create_user(username="patterns")
    client = APIClient()
    token = UserAuthToken.objects.create(user=user)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token.key}")
    return client, user


PAIR = {"source_language": "spanish", "target_language": "english"}


def enroll(client, key="english_suffix_less", **pair):
    return client.post("/api/word-formation", {**PAIR, **pair, "pattern_key": key}, format="json")


@pytest.mark.django_db
def test_enrollment_is_idempotent_scoped_and_requires_authentication(client_user):
    client, user = client_user
    first = enroll(client)
    assert first.status_code == 201
    assert enroll(client).json()["id"] == first.json()["id"]
    listing = client.get("/api/word-formation", PAIR).json()
    assert listing == {"supported": True, "saved": ["english_suffix_less"]}
    assert Item.objects.filter(item_type="pattern").count() == 1
    assert APIClient().get("/api/word-formation", PAIR).status_code == 401
    other = get_user_model().objects.create_user(username="other")
    token = UserAuthToken.objects.create(user=other)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token.key}")
    assert client.get("/api/word-formation", PAIR).json()["saved"] == []
    assert client.post("/api/review", {"item_id": first.json()["id"], "correct": True, "direction": "es_to_de", "review_version": 0}, format="json").status_code == 404


@pytest.mark.django_db
@pytest.mark.parametrize("key,pair", [
    ("made_up", {}),
    ("german_prefix_un", {}),
    ("english_suffix_less", {"source_language": "dutch"}),
    ("english_suffix_less", {"source_language": "english"}),
])
def test_invalid_or_unsupported_enrollment_rejected(client_user, key, pair):
    assert enroll(client_user[0], key, **pair).status_code == 400


@pytest.mark.django_db
def test_saved_plan_preserves_the_example_after_review(client_user):
    client, _ = client_user
    item_id = enroll(client).json()["id"]
    query = {**PAIR, "mode": "review", "direction": "es_to_de", "review_version": 0}
    before = client.get(f"/api/session/items/{item_id}", query).json()
    client.post("/api/review", {"item_id": item_id, "correct": True, "direction": "es_to_de", "review_version": 0}, format="json")
    restored = client.get(f"/api/session/items/{item_id}", query).json()
    assert restored["pattern_exercise"] == before["pattern_exercise"]
    assert restored["review_version"] == 0


@pytest.mark.django_db
def test_due_day_uses_local_timezone_and_words_are_unchanged(client_user, monkeypatch):
    from learning.models import UserTimezonePreference

    client, user = client_user
    UserTimezonePreference.objects.create(user=user, timezone="America/Bogota")
    now = datetime(2026, 9, 27, 2, tzinfo=dt_timezone.utc)
    monkeypatch.setattr("learning.srs.timezone.now", lambda: now)
    with timezone.override(ZoneInfo("America/Bogota")):
        saved = enroll(client).json()
        word = Item.objects.create(user=user, item_type="word", german_text="the dog", spanish_text="perro", **PAIR)
        before = (word.due_at_es_to_de, word.due_at_de_to_es)
        entries = client.get("/api/session", {**PAIR, "size": 2}).json()["items"]
        assert {entry["item_type"] for entry in entries} == {"word", "pattern"}
        client.post("/api/review", {"item_id": saved["id"], "correct": True, "direction": "es_to_de", "review_version": 0}, format="json")
        progress = Item.objects.get(pk=saved["id"])
        assert progress.due_at_es_to_de == datetime(2026, 9, 27, 5, tzinfo=dt_timezone.utc)
        word.refresh_from_db()
        assert (word.due_at_es_to_de, word.due_at_de_to_es) == before


def test_catalog_has_curated_rotating_pairs_for_every_pattern():
    from learning.word_formation import CATALOGS, exercise_for

    assert len(CATALOGS["german"]) == 10
    assert len(CATALOGS["english"]) == 14
    for language, patterns in CATALOGS.items():
        for key, examples in patterns.items():
            assert key.startswith(language + "_")
            assert len(examples) >= 6
            assert len({example.base.casefold() for example in examples}) == len(examples)
            assert len({example.answer.casefold() for example in examples}) == len(examples)
            for source in ("english", "spanish"):
                for index in range(len(examples)):
                    exercise = exercise_for(language, key, source, index)
                    assert all(exercise[field] for field in ("base", "base_translation", "meaning", "answer", "question"))
                    start, end = exercise["highlight"]
                    assert 0 <= start < end <= len(exercise["answer"])
                    assert exercise["answer"][start:end] == examples[index].affix
                    assert start == 0 if examples[index].prefix else end == len(exercise["answer"])
                    assert exercise["base"] != exercise["answer"]


def test_catalog_cycles_through_every_example_before_repeating():
    from learning.word_formation import CATALOGS, exercise_for

    for language, patterns in CATALOGS.items():
        for key, examples in patterns.items():
            for source in ("english", "spanish"):
                first_cycle = [exercise_for(language, key, source, index) for index in range(len(examples))]
                assert len({exercise["answer"] for exercise in first_cycle}) == len(examples)
                assert first_cycle == [exercise_for(language, key, source, index + len(examples))
                                       for index in range(len(examples))]


@pytest.mark.django_db
def test_patterns_preserve_difficult_order_and_session_limits(client_user):
    client, user = client_user
    now = timezone.now()
    difficult = Item.objects.create(user=user, item_type="word", spanish_text="casa", german_text="house",
                                    is_difficult=True, difficult_marked_at=now - timedelta(days=1), **PAIR)
    for key in ("english_suffix_less", "english_prefix_un", "english_prefix_re"):
        assert enroll(client, key).status_code == 201
    entries = client.get("/api/session", {**PAIR, "duration_minutes": 5}).json()["items"]
    assert [(entry["id"], entry.get("repeatPracticeStep")) for entry in entries[:2]] == [
        (difficult.id, "word_intro"), (difficult.id, "word_parts"),
    ]
    assert entries[2]["item_type"] == "pattern"
    assert len(client.get("/api/session", {**PAIR, "size": 2}).json()["items"]) == 2
    difficult.delete()
    assert len(client.get("/api/session", {**PAIR, "duration_minutes": 1}).json()["items"]) == 2


@pytest.mark.django_db
def test_success_extends_interval_and_future_version_is_rejected(client_user):
    client, _ = client_user
    saved = enroll(client).json()
    data = {"item_id": saved["id"], "correct": True, "direction": "es_to_de"}
    assert client.post("/api/review", {**data, "review_version": 1}, format="json").status_code == 400
    client.post("/api/review", {**data, "review_version": 0}, format="json")
    client.post("/api/review", {**data, "review_version": 1}, format="json")
    progress = Item.objects.get(pk=saved["id"])
    assert progress.interval_days_es_to_de > 1
    assert progress.review_count_es_to_de == 2
