from datetime import timedelta

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient

from learning.models import DailyLearningProgress, Item, UserAuthToken


def authenticated_client():
    user = get_user_model().objects.create_user(username="progress-user")
    token = UserAuthToken.objects.create(user=user)
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token.key}")
    return client, user


@pytest.mark.django_db
def test_progress_qualifies_after_thirty_minutes_of_active_study():
    client, _ = authenticated_client()

    response = client.post("/api/progress/study-time", {"seconds": 300}, format="json")
    assert response.status_code == 200
    for _ in range(5):
        response = client.post("/api/progress/study-time", {"seconds": 300}, format="json")

    assert response.status_code == 200
    payload = response.json()
    assert payload["qualified_today"] is True
    assert payload["qualification"] == "time"
    assert payload["current_streak"] == 1


@pytest.mark.django_db
def test_progress_only_counts_reviews_for_the_active_language_pair():
    client, user = authenticated_client()
    now = timezone.now()
    Item.objects.create(
        user=user,
        item_type=Item.ItemType.WORD,
        spanish_text="hola",
        german_text="hallo",
        last_reviewed_at_es_to_de=now,
        due_at_es_to_de=now,
    )
    Item.objects.create(
        user=user,
        item_type=Item.ItemType.WORD,
        spanish_text="hello",
        german_text="hello",
        source_language="english",
        target_language="german",
        last_reviewed_at_es_to_de=now,
        due_at_es_to_de=now,
    )

    payload = client.get("/api/progress?source_language=spanish&target_language=german").json()

    assert payload["due_reviews_remaining"] == 1


@pytest.mark.django_db
def test_progress_qualifies_when_five_completed_items_empty_the_daily_review_pool():
    client, user = authenticated_client()
    now = timezone.now()
    items = [
        Item.objects.create(
            user=user,
            item_type=Item.ItemType.WORD,
            spanish_text=f"palabra-{index}",
            german_text=f"wort-{index}",
            last_reviewed_at_es_to_de=now,
            due_at_es_to_de=now,
        )
        for index in range(5)
    ]

    for item in items:
        response = client.post(
            "/api/review",
            {"item_id": item.id, "correct": True, "direction": Item.ReviewDirection.SPANISH_TO_GERMAN},
            format="json",
        )
        assert response.status_code == 200

    payload = client.get("/api/progress").json()
    assert payload["qualified_today"] is True
    assert payload["qualification"] == "pool"
    assert payload["completed_items_today"] == 5
    assert payload["due_reviews_remaining"] == 0


@pytest.mark.django_db
def test_progress_pause_can_restore_recent_missed_days():
    client, user = authenticated_client()
    today = timezone.localdate()
    DailyLearningProgress.objects.create(
        user=user,
        date=today - timedelta(days=2),
        active_seconds=30 * 60,
    )
    client.get("/api/progress")

    response = client.post(
        "/api/progress/pause",
        {"start_date": (today - timedelta(days=1)).isoformat(), "end_date": today.isoformat()},
        format="json",
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["pause_active"] is True
    assert payload["next_pause_available_on"] == (today + timedelta(days=90)).isoformat()
    assert payload["current_streak"] == 1
    assert any(day["status"] == "paused" for day in payload["history"])


@pytest.mark.django_db
def test_progress_resume_ends_an_active_pause_today():
    client, _ = authenticated_client()
    today = timezone.localdate()
    client.post(
        "/api/progress/pause",
        {"start_date": (today - timedelta(days=1)).isoformat(), "end_date": today.isoformat()},
        format="json",
    )

    response = client.post("/api/progress/resume", format="json")

    assert response.status_code == 200
    payload = response.json()
    assert payload["pause_active"] is False
    assert payload["history"][-2]["status"] == "paused"


@pytest.mark.django_db
def test_progress_earns_a_flex_day_after_seven_study_days_and_uses_it_for_a_missed_day():
    client, user = authenticated_client()
    today = timezone.localdate()
    for offset in range(8, 1, -1):
        DailyLearningProgress.objects.create(
            user=user,
            date=today - timedelta(days=offset),
            active_seconds=30 * 60,
        )

    payload = client.get("/api/progress").json()

    assert payload["current_streak"] == 8
    assert payload["flex_days"] == 0
    missed_day = DailyLearningProgress.objects.get(user=user, date=today - timedelta(days=1))
    assert missed_day.status == "flex"
