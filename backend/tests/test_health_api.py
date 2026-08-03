import pytest
from django.test import override_settings
from rest_framework.test import APIClient


@pytest.mark.django_db
def test_health_endpoint_returns_ok_status():
    client = APIClient()
    response = client.get("/api/health")

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert payload["service"] == "smart-language-learning-backend"
    assert "timestamp" in payload


@pytest.mark.django_db
@override_settings(ALLOWED_HOSTS=["api.welearnsmart.com"])
def test_health_endpoint_accepts_an_infrastructure_probe_host():
    client = APIClient()

    response = client.get("/api/health", HTTP_HOST="internal-health-probe")

    assert response.status_code == 200
    assert response.json()["status"] == "ok"
