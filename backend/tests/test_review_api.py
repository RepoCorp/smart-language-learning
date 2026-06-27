import pytest
from datetime import timedelta
from django.utils import timezone
from rest_framework.test import APIClient

from learning.models import Item


@pytest.mark.django_db
def test_submit_review_updates_item_schedule_on_correct_answer():
    item = Item.objects.create(
        item_type=Item.ItemType.WORD,
        spanish_text="hola",
        german_text="hallo",
        repetition_count_es_to_de=0,
    )

    client = APIClient()
    response = client.post(
        "/api/review",
        {"item_id": item.id, "correct": True, "direction": Item.ReviewDirection.SPANISH_TO_GERMAN},
        format="json",
    )

    assert response.status_code == 200

    item.refresh_from_db()
    assert item.repetition_count_es_to_de == 1
    assert item.interval_days_es_to_de == 1
    assert item.due_at_es_to_de is not None
    assert item.due_at_es_to_de > timezone.now()
    assert item.repetition_count_de_to_es == 0


@pytest.mark.django_db
def test_submit_review_resets_progress_on_incorrect_answer():
    item = Item.objects.create(
        item_type=Item.ItemType.WORD,
        spanish_text="gracias",
        german_text="danke",
        repetition_count_de_to_es=3,
        interval_days_de_to_es=7,
        last_reviewed_at_de_to_es=timezone.now(),
        due_at_de_to_es=timezone.now(),
    )

    client = APIClient()
    response = client.post(
        "/api/review",
        {"item_id": item.id, "correct": False, "direction": Item.ReviewDirection.GERMAN_TO_SPANISH},
        format="json",
    )

    assert response.status_code == 200

    item.refresh_from_db()
    assert item.repetition_count_de_to_es == 1
    assert item.interval_days_de_to_es >= 2
    assert item.repetition_count_es_to_de == 0
    assert item.is_difficult is True
    assert item.difficult_marked_at is not None


@pytest.mark.django_db
def test_complete_difficult_item_clears_flag():
    item = Item.objects.create(
        item_type=Item.ItemType.WORD,
        spanish_text="gracias",
        german_text="danke",
        is_difficult=True,
        difficult_marked_at=timezone.now(),
    )

    client = APIClient()
    response = client.post("/api/difficult-items/complete", {"item_id": item.id}, format="json")

    assert response.status_code == 200
    item.refresh_from_db()
    assert item.is_difficult is False
    assert item.difficult_marked_at is None


@pytest.mark.django_db
def test_submit_review_requires_direction():
    item = Item.objects.create(
        item_type=Item.ItemType.WORD,
        spanish_text="casa",
        german_text="Haus",
    )

    client = APIClient()
    response = client.post("/api/review", {"item_id": item.id, "correct": True}, format="json")

    assert response.status_code == 400


@pytest.mark.django_db
def test_submit_review_updates_phrase_direction_independently():
    item = Item.objects.create(
        item_type=Item.ItemType.PHRASE,
        spanish_text="No entiendo",
        german_text="Ich verstehe nicht",
        repetition_count_es_to_de=2,
        interval_days_es_to_de=3,
        last_reviewed_at_es_to_de=timezone.now(),
        due_at_es_to_de=timezone.now(),
        repetition_count_de_to_es=0,
        interval_days_de_to_es=1,
    )

    client = APIClient()
    response = client.post(
        "/api/review",
        {"item_id": item.id, "correct": True, "direction": Item.ReviewDirection.GERMAN_TO_SPANISH},
        format="json",
    )

    assert response.status_code == 200
    item.refresh_from_db()
    assert item.repetition_count_de_to_es == 1
    assert item.repetition_count_es_to_de == 2


@pytest.mark.django_db
def test_correct_answer_increases_interval_more_after_multiple_successes():
    now = timezone.now()
    item = Item.objects.create(
        item_type=Item.ItemType.WORD,
        spanish_text="libro",
        german_text="das Buch",
        repetition_count_es_to_de=3,
        interval_days_es_to_de=7,
        due_at_es_to_de=now,
    )
    client = APIClient()
    response = client.post(
        "/api/review",
        {"item_id": item.id, "correct": True, "direction": Item.ReviewDirection.SPANISH_TO_GERMAN},
        format="json",
    )
    assert response.status_code == 200
    item.refresh_from_db()
    assert item.repetition_count_es_to_de == 4
    assert item.interval_days_es_to_de > 7


@pytest.mark.django_db
def test_late_correct_review_gets_bonus_interval():
    now = timezone.now()
    item = Item.objects.create(
        item_type=Item.ItemType.WORD,
        spanish_text="agua",
        german_text="das Wasser",
        repetition_count_es_to_de=4,
        interval_days_es_to_de=10,
        due_at_es_to_de=now - timedelta(days=3),
    )
    client = APIClient()
    response = client.post(
        "/api/review",
        {"item_id": item.id, "correct": True, "direction": Item.ReviewDirection.SPANISH_TO_GERMAN},
        format="json",
    )
    assert response.status_code == 200
    item.refresh_from_db()
    assert item.interval_days_es_to_de >= 20


@pytest.mark.django_db
def test_restore_session_item_state_restores_directional_progress_and_difficult_flag():
    original_last_reviewed = timezone.now() - timedelta(days=5)
    original_due_at = timezone.now() + timedelta(days=2)
    original_difficult_marked_at = timezone.now() - timedelta(days=1)
    item = Item.objects.create(
        item_type=Item.ItemType.WORD,
        spanish_text="mesa",
        german_text="Tisch",
        repetition_count_es_to_de=2,
        interval_days_es_to_de=6,
        last_reviewed_at_es_to_de=original_last_reviewed,
        due_at_es_to_de=original_due_at,
        repetition_count_de_to_es=1,
        interval_days_de_to_es=3,
        is_difficult=True,
        difficult_marked_at=original_difficult_marked_at,
    )

    client = APIClient()
    review_response = client.post(
        "/api/review",
        {"item_id": item.id, "correct": False, "direction": Item.ReviewDirection.SPANISH_TO_GERMAN},
        format="json",
    )
    assert review_response.status_code == 200

    restore_response = client.post(
        "/api/session/restore-item-state",
        {
            "item_id": item.id,
            "state": {
                "repetition_count_es_to_de": 2,
                "interval_days_es_to_de": 6,
                "last_reviewed_at_es_to_de": original_last_reviewed.isoformat(),
                "due_at_es_to_de": original_due_at.isoformat(),
                "repetition_count_de_to_es": 1,
                "interval_days_de_to_es": 3,
                "last_reviewed_at_de_to_es": None,
                "due_at_de_to_es": None,
                "is_learned": False,
                "is_difficult": True,
                "difficult_marked_at": original_difficult_marked_at.isoformat(),
            },
        },
        format="json",
    )

    assert restore_response.status_code == 200

    item.refresh_from_db()
    assert item.repetition_count_es_to_de == 2
    assert item.interval_days_es_to_de == 6
    assert item.last_reviewed_at_es_to_de == original_last_reviewed
    assert item.due_at_es_to_de == original_due_at
    assert item.repetition_count_de_to_es == 1
    assert item.interval_days_de_to_es == 3
    assert item.last_reviewed_at_de_to_es is None
    assert item.due_at_de_to_es is None
    assert item.is_learned is False
    assert item.is_difficult is True
    assert item.difficult_marked_at == original_difficult_marked_at
