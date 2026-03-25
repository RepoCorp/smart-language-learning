import pytest
from datetime import timedelta

from django.utils import timezone
from rest_framework.test import APIClient

from learning.models import DialogTurn, Item, ItemDialogOccurrence, SavedDialog


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
def test_session_duration_minutes_prioritizes_due_before_new():
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
    response = client.get("/api/session", {"duration_minutes": 2})

    assert response.status_code == 200
    items = response.json()["items"]
    assert items
    assert items[0]["id"] == due.id
    assert items[0]["mode"] == "review"
    assert any(item["id"] == new_item.id and item["mode"] == "new" for item in items)


@pytest.mark.django_db
def test_session_duration_minutes_matches_expected_time_target():
    now = timezone.now()

    due_a = Item.objects.create(
        item_type=Item.ItemType.WORD,
        spanish_text="hola",
        german_text="hallo",
        last_reviewed_at_es_to_de=now,
        due_at_es_to_de=now,
    )
    due_b = Item.objects.create(
        item_type=Item.ItemType.WORD,
        spanish_text="gracias",
        german_text="danke",
        last_reviewed_at_es_to_de=now,
        due_at_es_to_de=now,
    )
    Item.objects.create(
        item_type=Item.ItemType.WORD,
        spanish_text="casa",
        german_text="Haus",
    )

    client = APIClient()
    response = client.get("/api/session", {"duration_minutes": 1})

    assert response.status_code == 200
    ids = [item["id"] for item in response.json()["items"]]
    # Review words are estimated at 25s each, so 1 minute should select at least two.
    assert {due_a.id, due_b.id}.issubset(set(ids[:2]))


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
def test_word_review_de_to_es_contains_multiple_choice_options():
    now = timezone.now()
    word = Item.objects.create(
        item_type=Item.ItemType.WORD,
        spanish_text="casa",
        german_text="Haus",
        last_reviewed_at_de_to_es=now,
        due_at_de_to_es=now,
    )
    Item.objects.create(item_type=Item.ItemType.WORD, spanish_text="perro", german_text="Hund")
    Item.objects.create(item_type=Item.ItemType.WORD, spanish_text="gato", german_text="Katze")
    Item.objects.create(item_type=Item.ItemType.WORD, spanish_text="gracias", german_text="Danke")

    client = APIClient()
    response = client.get("/api/session", {"size": 1})

    assert response.status_code == 200
    item = response.json()["items"][0]
    assert item["id"] == word.id
    assert item["direction"] == Item.ReviewDirection.GERMAN_TO_SPANISH
    assert word.spanish_text in item["options"]
    assert len(item["options"]) >= 2


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
    assert set(ids) == {sooner.id, later.id}


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


@pytest.mark.django_db
def test_session_filters_items_by_language_pair():
    now = timezone.now()
    es_de_due = Item.objects.create(
        item_type=Item.ItemType.WORD,
        spanish_text="hola",
        german_text="hallo",
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
        "/api/session",
        {"size": 5, "source_language": "spanish", "target_language": "german"},
    )
    assert response.status_code == 200
    ids = [item["id"] for item in response.json()["items"]]
    assert es_de_due.id in ids
    assert len(ids) == 1


@pytest.mark.django_db
def test_session_excludes_items_marked_as_learned():
    now = timezone.now()
    Item.objects.create(
        item_type=Item.ItemType.WORD,
        spanish_text="hola",
        german_text="hallo",
        is_learned=True,
        source_language="spanish",
        target_language="german",
        last_reviewed_at_es_to_de=now,
        due_at_es_to_de=now,
    )
    available = Item.objects.create(
        item_type=Item.ItemType.WORD,
        spanish_text="casa",
        german_text="Haus",
        is_learned=False,
        source_language="spanish",
        target_language="german",
        last_reviewed_at_es_to_de=now,
        due_at_es_to_de=now,
    )

    client = APIClient()
    response = client.get(
        "/api/session",
        {"size": 5, "source_language": "spanish", "target_language": "german"},
    )
    assert response.status_code == 200
    ids = [item["id"] for item in response.json()["items"]]
    assert available.id in ids
    assert len(ids) == 1


@pytest.mark.django_db
def test_session_includes_related_dialogs_for_item():
    item = Item.objects.create(
        item_type=Item.ItemType.WORD,
        spanish_text="taxi",
        german_text="das Taxi",
        source_language="spanish",
        target_language="german",
    )
    dialog = SavedDialog.objects.create(
        topic="transport",
        context="at the airport",
        source_language="spanish",
        target_language="german",
        turns=[
            {"source_text": "Necesito un taxi.", "target_text": "Ich brauche ein Taxi."},
            {"source_text": "Esta afuera.", "target_text": "Es steht draussen."},
        ],
        audio_url="http://localhost:8000/media/audio/dialog-mock.wav",
    )
    turn = DialogTurn.objects.create(
        dialog=dialog,
        turn_index=0,
        source_text="Necesito un taxi.",
        target_text="Ich brauche ein Taxi.",
    )
    ItemDialogOccurrence.objects.create(
        item=item,
        dialog=dialog,
        turn=turn,
        turn_index=0,
        side=ItemDialogOccurrence.Side.SOURCE,
        match_score=0.75,
    )

    client = APIClient()
    response = client.get(
        "/api/session",
        {"size": 1, "source_language": "spanish", "target_language": "german"},
    )
    assert response.status_code == 200
    payload_item = response.json()["items"][0]
    assert payload_item["id"] == item.id
    assert len(payload_item["related_dialogs"]) == 1
    assert payload_item["related_dialogs"][0]["dialog_id"] == dialog.id
    assert payload_item["related_dialogs"][0]["audio_url"] == "http://localhost:8000/media/audio/dialog-mock.wav"
    assert len(payload_item["related_dialogs"][0]["turns"]) == 2
    assert payload_item["related_dialogs"][0]["matched_turns"][0]["turn_index"] == 0
