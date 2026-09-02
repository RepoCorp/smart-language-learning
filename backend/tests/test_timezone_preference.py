import json

import pytest
from django.contrib.auth import get_user_model
from django.http import JsonResponse
from django.utils import timezone
from rest_framework.test import APIClient, APIRequestFactory

from learning.models import UserAuthToken, UserTimezonePreference
from learning.timezone_middleware import UserTimezoneMiddleware


def authenticated_client():
    user = get_user_model().objects.create_user(username="timezone-user")
    token = UserAuthToken.objects.create(user=user)
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token.key}")
    return client, user, token


@pytest.mark.django_db
def test_timezone_preference_defaults_to_existing_server_timezone():
    client, _, _ = authenticated_client()

    response = client.get("/api/config/timezone")

    assert response.status_code == 200
    assert response.json() == {"timezone": "", "effective_timezone": "UTC"}


@pytest.mark.django_db
def test_timezone_preference_validates_and_saves_iana_timezone():
    client, user, _ = authenticated_client()

    invalid = client.post("/api/config/timezone", {"timezone": "Bogota"}, format="json")
    saved = client.post("/api/config/timezone", {"timezone": "America/Bogota"}, format="json")

    assert invalid.status_code == 400
    assert saved.status_code == 200
    assert saved.json() == {"timezone": "America/Bogota", "effective_timezone": "America/Bogota"}
    assert UserTimezonePreference.objects.get(user=user).timezone == "America/Bogota"


@pytest.mark.django_db
def test_timezone_middleware_activates_the_authenticated_users_timezone():
    _, user, token = authenticated_client()
    UserTimezonePreference.objects.create(user=user, timezone="America/Bogota")
    request = APIRequestFactory().get("/api/progress", HTTP_AUTHORIZATION=f"Bearer {token.key}")

    middleware = UserTimezoneMiddleware(
        lambda _: JsonResponse({"timezone": timezone.get_current_timezone_name()}),
    )
    response = middleware(request)

    assert json.loads(response.content) == {"timezone": "America/Bogota"}
