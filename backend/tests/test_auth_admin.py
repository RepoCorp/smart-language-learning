import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient

from learning.models import DailyAIUsage, UserAuthToken


@pytest.mark.django_db
def test_registered_users_are_ordered_by_total_ai_request_count():
    user_model = get_user_model()
    admin = user_model.objects.create_user(username="admin", email="admin@example.com", is_superuser=True)
    most_active = user_model.objects.create_user(username="most-active", email="most@example.com")
    less_active = user_model.objects.create_user(username="less-active", email="less@example.com")
    unused = user_model.objects.create_user(username="unused", email="unused@example.com")

    for user, request_count in ((most_active, 6), (less_active, 2)):
        DailyAIUsage.objects.create(
            user=user,
            date=timezone.localdate(),
            provider="openai",
            feature="test",
            model="test-model",
            category=DailyAIUsage.Category.TEXT,
            request_count=request_count,
        )

    token = UserAuthToken.objects.create(user=admin)
    response = APIClient().get("/api/auth/ai-usage", HTTP_AUTHORIZATION=f"Bearer {token.key}")

    assert response.status_code == 200
    assert [user["id"] for user in response.json()["users"]] == [
        most_active.id,
        less_active.id,
        admin.id,
        unused.id,
    ]
