import pytest
from datetime import timedelta
from django.utils import timezone
from rest_framework.test import APIClient

from learning.models import DialogTurn, Item, ItemDialogOccurrence, SavedDialog
from learning.review_schedule import local_day_bounds
from learning.srs import mark_item_seen


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
    _, tomorrow = local_day_bounds(timezone.now())
    assert item.due_at_es_to_de == tomorrow
    assert item.due_at_de_to_es == tomorrow + timedelta(days=1)


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


@pytest.mark.django_db
def test_mark_seen_separates_a_word_and_its_saved_source_phrase_reviews():
    word = Item.objects.create(item_type=Item.ItemType.WORD, spanish_text="casa", german_text="Haus")
    phrase = Item.objects.create(item_type=Item.ItemType.PHRASE, spanish_text="La casa está aquí.", german_text="Das Haus ist hier.")
    dialog = SavedDialog.objects.create(topic="Homes")
    turn = DialogTurn.objects.create(dialog=dialog, turn_index=0, source_text=phrase.spanish_text, target_text=phrase.german_text)
    for item in (word, phrase):
        ItemDialogOccurrence.objects.create(
            item=item,
            dialog=dialog,
            turn=turn,
            turn_index=0,
            side=ItemDialogOccurrence.Side.TARGET,
        )

    mark_item_seen(word)
    mark_item_seen(phrase)
    word.refresh_from_db()
    phrase.refresh_from_db()

    due_dates = {
        timezone.localdate(word.due_at_es_to_de),
        timezone.localdate(word.due_at_de_to_es),
        timezone.localdate(phrase.due_at_es_to_de),
        timezone.localdate(phrase.due_at_de_to_es),
    }
    assert len(due_dates) == 4
