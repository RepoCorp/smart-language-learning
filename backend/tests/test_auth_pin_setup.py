import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from learning.models import UserAuthToken
from learning.views.auth_pin_setup import create_pin_setup_token


@pytest.mark.django_db
def test_pin_setup_link_sets_a_pin_once_and_signs_the_user_in():
    user = get_user_model().objects.create_user(username="new-learner", email="new@example.com")
    raw_token = create_pin_setup_token(user=user)

    response = APIClient().post("/api/auth/pin-setup", {"token": raw_token, "pin": "new-pin"}, format="json")

    assert response.status_code == 200
    assert response.json()["user"]["username"] == "new-learner"
    assert response.json()["show_getting_started"] is True
    assert UserAuthToken.objects.filter(user=user).exists()

    reused = APIClient().post("/api/auth/pin-setup", {"token": raw_token, "pin": "another-pin"}, format="json")
    assert reused.status_code == 400


@pytest.mark.django_db
def test_getting_started_is_only_shown_until_the_user_dismisses_it():
    user = get_user_model().objects.create_user(username="learner", email="learner@example.com", password="test-pin")
    client = APIClient()

    first_login = client.post("/api/auth/login", {"identifier": "learner", "pin": "test-pin"}, format="json")
    assert first_login.status_code == 200
    assert first_login.json()["show_getting_started"] is True

    auth_token = first_login.json()["token"]
    completed = client.post("/api/auth/getting-started/complete", HTTP_AUTHORIZATION=f"Bearer {auth_token}")
    assert completed.status_code == 200

    next_login = client.post("/api/auth/login", {"identifier": "learner", "pin": "test-pin"}, format="json")
    assert next_login.status_code == 200
    assert next_login.json()["show_getting_started"] is False
