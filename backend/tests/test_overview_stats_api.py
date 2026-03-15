import pytest
from datetime import timedelta
from django.utils import timezone
from rest_framework.test import APIClient

from learning.models import Item


@pytest.mark.django_db
def test_overview_stats_returns_expected_counts():
    now = timezone.now()

    Item.objects.create(
        item_type=Item.ItemType.WORD,
        spanish_text="hola",
        german_text="Hallo",
        last_reviewed_at_es_to_de=now,
        due_at_es_to_de=now,
    )
    Item.objects.create(
        item_type=Item.ItemType.PHRASE,
        spanish_text="No entiendo",
        german_text="Ich verstehe nicht",
        last_reviewed_at_de_to_es=now,
        due_at_de_to_es=now + timedelta(days=1),
    )
    Item.objects.create(
        item_type=Item.ItemType.WORD,
        spanish_text="nuevo",
        german_text="neu",
    )

    client = APIClient()
    response = client.get("/api/overview-stats")

    assert response.status_code == 200
    payload = response.json()
    assert payload["ready_to_review"] == 1
    assert payload["future_reviews"] == 1
    assert payload["not_started"] == 1


@pytest.mark.django_db
def test_overview_stats_filters_by_language_pair():
    now = timezone.now()

    Item.objects.create(
        item_type=Item.ItemType.WORD,
        spanish_text="hola",
        german_text="Hallo",
        source_language="spanish",
        target_language="german",
        last_reviewed_at_es_to_de=now,
        due_at_es_to_de=now,
    )
    Item.objects.create(
        item_type=Item.ItemType.WORD,
        spanish_text="hello",
        german_text="bonjour",
        source_language="english",
        target_language="french",
        last_reviewed_at_es_to_de=now,
        due_at_es_to_de=now,
    )

    client = APIClient()
    response = client.get(
        "/api/overview-stats",
        {"source_language": "spanish", "target_language": "german"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["ready_to_review"] == 1
    assert payload["future_reviews"] == 0
    assert payload["not_started"] == 0
