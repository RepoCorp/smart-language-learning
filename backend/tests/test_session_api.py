import pytest
from datetime import timedelta

from django.utils import timezone
from rest_framework.test import APIClient

from learning.models import Item


@pytest.mark.django_db
def test_session_prioritizes_due_reviews_then_new_items():
    now = timezone.now()

    due = Item.objects.create(
        item_type=Item.ItemType.WORD,
        spanish_text="hola",
        german_text="hallo",
        last_reviewed_at_es_to_de=now,
        due_at_es_to_de=now,
    )
    new_item = Item.objects.create(
        item_type=Item.ItemType.WORD,
        spanish_text="casa",
        german_text="Haus",
    )

    client = APIClient()
    response = client.get("/api/session", {"size": 2})

    assert response.status_code == 200
    items = response.json()["items"]
    assert items[0]["id"] == due.id
    assert items[0]["mode"] == "review"
    assert items[0]["direction"] == Item.ReviewDirection.SPANISH_TO_GERMAN
    assert items[1]["id"] == new_item.id
    assert items[1]["mode"] == "new"


@pytest.mark.django_db
def test_phrase_review_contains_correct_option():
    now = timezone.now()
    phrase = Item.objects.create(
        item_type=Item.ItemType.PHRASE,
        spanish_text="No entiendo",
        german_text="Ich verstehe nicht",
        last_reviewed_at_es_to_de=now,
        due_at_es_to_de=now,
    )
    Item.objects.create(item_type=Item.ItemType.PHRASE, spanish_text="Hola", german_text="Hallo")
    Item.objects.create(item_type=Item.ItemType.PHRASE, spanish_text="Gracias", german_text="Danke")
    Item.objects.create(item_type=Item.ItemType.PHRASE, spanish_text="Adios", german_text="Tschuess")

    client = APIClient()
    response = client.get("/api/session", {"size": 1})

    assert response.status_code == 200
    item = response.json()["items"][0]
    options = item["options"]
    assert item["direction"] == Item.ReviewDirection.SPANISH_TO_GERMAN
    assert phrase.german_text in options


@pytest.mark.django_db
def test_session_falls_back_to_next_upcoming_review_when_no_due_or_new():
    now = timezone.now()

    later = Item.objects.create(
        item_type=Item.ItemType.WORD,
        spanish_text="perro",
        german_text="Hund",
        last_reviewed_at_es_to_de=now - timedelta(days=1),
        due_at_es_to_de=now + timedelta(hours=4),
    )
    sooner = Item.objects.create(
        item_type=Item.ItemType.WORD,
        spanish_text="gato",
        german_text="Katze",
        last_reviewed_at_es_to_de=now - timedelta(days=1),
        due_at_es_to_de=now + timedelta(hours=1),
    )

    client = APIClient()
    response = client.get("/api/session", {"size": 1})

    assert response.status_code == 200
    items = response.json()["items"]
    assert len(items) == 1
    assert items[0]["id"] == sooner.id
    assert items[0]["mode"] == "review"
    assert items[0]["direction"] == Item.ReviewDirection.SPANISH_TO_GERMAN

    response_two = client.get("/api/session", {"size": 2})
    assert response_two.status_code == 200
    ids = [item["id"] for item in response_two.json()["items"]]
    assert ids == [sooner.id, later.id]


@pytest.mark.django_db
def test_word_directions_have_independent_session_status():
    now = timezone.now()
    word = Item.objects.create(
        item_type=Item.ItemType.WORD,
        spanish_text="hola",
        german_text="hallo",
        last_reviewed_at_es_to_de=now,
        due_at_es_to_de=now - timedelta(minutes=1),
        last_reviewed_at_de_to_es=now,
        due_at_de_to_es=now + timedelta(days=1),
    )

    client = APIClient()
    due_response = client.get("/api/session", {"size": 1})
    assert due_response.status_code == 200
    due_item = due_response.json()["items"][0]
    assert due_item["id"] == word.id
    assert due_item["direction"] == Item.ReviewDirection.SPANISH_TO_GERMAN

    upcoming_response = client.get("/api/session", {"size": 2})
    assert upcoming_response.status_code == 200
    directions = [item["direction"] for item in upcoming_response.json()["items"] if item["id"] == word.id]
    assert Item.ReviewDirection.SPANISH_TO_GERMAN in directions
    assert Item.ReviewDirection.GERMAN_TO_SPANISH in directions


@pytest.mark.django_db
def test_phrase_directions_have_independent_session_status():
    now = timezone.now()
    phrase = Item.objects.create(
        item_type=Item.ItemType.PHRASE,
        spanish_text="No entiendo",
        german_text="Ich verstehe nicht",
        last_reviewed_at_es_to_de=now,
        due_at_es_to_de=now - timedelta(minutes=1),
        last_reviewed_at_de_to_es=now,
        due_at_de_to_es=now + timedelta(days=1),
    )

    client = APIClient()
    due_response = client.get("/api/session", {"size": 1})
    assert due_response.status_code == 200
    due_item = due_response.json()["items"][0]
    assert due_item["id"] == phrase.id
    assert due_item["direction"] == Item.ReviewDirection.SPANISH_TO_GERMAN
    assert phrase.german_text in due_item["options"]

    upcoming_response = client.get("/api/session", {"size": 2})
    assert upcoming_response.status_code == 200
    directions = [item["direction"] for item in upcoming_response.json()["items"] if item["id"] == phrase.id]
    assert Item.ReviewDirection.SPANISH_TO_GERMAN in directions
    assert Item.ReviewDirection.GERMAN_TO_SPANISH in directions
