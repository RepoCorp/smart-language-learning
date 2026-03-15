import pytest
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
