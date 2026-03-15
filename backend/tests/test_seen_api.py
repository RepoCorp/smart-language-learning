import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from learning.models import Item


@pytest.mark.django_db
def test_mark_seen_sets_schedule_without_incrementing_repetition():
    item = Item.objects.create(
        item_type=Item.ItemType.WORD,
        spanish_text="casa",
        german_text="Haus",
        repetition_count_es_to_de=0,
        repetition_count_de_to_es=0,
    )

    client = APIClient()
    response = client.post("/api/seen", {"item_id": item.id}, format="json")

    assert response.status_code == 200

    item.refresh_from_db()
    assert item.repetition_count_es_to_de == 0
    assert item.interval_days_es_to_de == 1
    assert item.last_reviewed_at_es_to_de is not None
    assert item.due_at_es_to_de is not None
    assert item.due_at_es_to_de > timezone.now()

    assert item.repetition_count_de_to_es == 0
    assert item.interval_days_de_to_es == 1
    assert item.last_reviewed_at_de_to_es is not None
    assert item.due_at_de_to_es is not None
    assert item.due_at_de_to_es > timezone.now()


@pytest.mark.django_db
def test_mark_seen_sets_schedule_for_phrases_too():
    item = Item.objects.create(
        item_type=Item.ItemType.PHRASE,
        spanish_text="No entiendo",
        german_text="Ich verstehe nicht",
    )

    client = APIClient()
    response = client.post("/api/seen", {"item_id": item.id}, format="json")

    assert response.status_code == 200

    item.refresh_from_db()
    assert item.last_reviewed_at_es_to_de is not None
    assert item.last_reviewed_at_de_to_es is not None
