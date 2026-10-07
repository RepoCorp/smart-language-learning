from dataclasses import asdict
import json

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from learning.learning_content.catalog import DEFINITIONS
from learning.learning_content.patterns.affix.languages.german.keit import KEIT
from learning.models import Item, UserAuthToken


def client_for(*, admin=False):
    user = get_user_model().objects.create_user(username="tester", is_superuser=admin)
    token = UserAuthToken.objects.create(user=user)
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token.key}")
    return client


def test_catalog_has_unique_stable_keys():
    assert len({definition.key for definition in DEFINITIONS}) == len(DEFINITIONS)
    assert KEIT in DEFINITIONS


@pytest.mark.django_db
@pytest.mark.parametrize("authenticated", [False, True])
def test_catalog_requires_admin(authenticated):
    client = client_for() if authenticated else APIClient()
    assert client.get("/api/admin/learning-content").status_code == 403


@pytest.mark.django_db
def test_admin_reads_actual_definitions_without_creating_items():
    client = client_for(admin=True)
    before = Item.objects.count()
    response = client.get("/api/admin/learning-content")
    assert response.status_code == 200
    assert response["Cache-Control"] == "no-store"
    assert response.json() == json.loads(json.dumps({
        "definitions": [asdict(definition) for definition in DEFINITIONS],
    }))
    assert Item.objects.count() == before


@pytest.mark.django_db
@pytest.mark.parametrize("method", ["post", "put", "patch", "delete"])
def test_catalog_is_read_only(method):
    client = client_for(admin=True)
    assert getattr(client, method)("/api/admin/learning-content", {}, format="json").status_code == 405
