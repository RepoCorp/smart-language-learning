from datetime import date, datetime, timezone as dt_timezone

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient

from learning.models import DailyAIUsage, DailyLearningProgress, UserAuthToken, UserTimezonePreference


@pytest.fixture
def admin_client(db, monkeypatch):
    # Still Sunday in the admin's timezone, although UTC has reached Monday.
    monkeypatch.setattr(timezone, "now", lambda: datetime(2026, 9, 28, 1, tzinfo=dt_timezone.utc))
    admin = get_user_model().objects.create_user(username="admin", is_superuser=True)
    UserTimezonePreference.objects.create(user=admin, timezone="America/Bogota")
    token = UserAuthToken.objects.create(user=admin)
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token.key}")
    return client


def test_weekly_study_minutes_use_existing_daily_totals_without_multiplying_ai_usage(admin_client):
    learner = get_user_model().objects.create_user(username="learner")
    other = get_user_model().objects.create_user(username="other")
    for day, seconds in ((20, 9000), (21, 90), (24, 90), (27, 59), (28, 9000)):
        DailyLearningProgress.objects.create(
            user=learner, date=date(2026, 9, day), active_seconds=seconds,
            active_seconds_by_language={"spanish:german": seconds // 2, "spanish:english": seconds - seconds // 2},
        )
    DailyLearningProgress.objects.create(user=other, date=date(2026, 9, 25), active_seconds=600)
    for feature in ("one", "two"):
        DailyAIUsage.objects.create(
            user=learner, date=date(2026, 9, 25), provider="openai", model="test",
            category=DailyAIUsage.Category.TEXT, feature=feature, quota_credits=5,
        )
    DailyAIUsage.objects.create(
        user=learner, date=date(2026, 9, 25), provider="openai", model="test",
        category=DailyAIUsage.Category.AUDIO, feature="realtime-session", usage_units=120,
    )

    response = admin_client.get("/api/auth/ai-usage")

    assert response.status_code == 200
    assert response.json()["week_start"] == "2026-09-21"
    users = {row["username"]: row for row in response.json()["users"]}
    assert users["learner"]["week_study_minutes"] == 3  # Sum first, then whole minutes.
    assert users["other"]["week_study_minutes"] == 10
    assert users["admin"]["week_study_minutes"] == 0
    assert users["learner"]["week_generation_credits"] == 10
    assert users["learner"]["week_realtime_minutes"] == 2


@pytest.mark.django_db
@pytest.mark.parametrize("authenticated", [False, True])
def test_weekly_study_usage_remains_admin_only(authenticated):
    client = APIClient()
    if authenticated:
        learner = get_user_model().objects.create_user(username="learner")
        token = UserAuthToken.objects.create(user=learner)
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {token.key}")
    assert client.get("/api/auth/ai-usage").status_code == 403
