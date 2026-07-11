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
def test_session_randomizes_full_due_pool_before_applying_size_limit(monkeypatch):
    from learning.views import session as session_views

    now = timezone.now()
    early = Item.objects.create(
        item_type=Item.ItemType.WORD,
        spanish_text="uno",
        german_text="eins",
        last_reviewed_at_es_to_de=now,
        due_at_es_to_de=now - timedelta(hours=3),
    )
    middle = Item.objects.create(
        item_type=Item.ItemType.WORD,
        spanish_text="dos",
        german_text="zwei",
        last_reviewed_at_es_to_de=now,
        due_at_es_to_de=now - timedelta(hours=2),
    )
    late = Item.objects.create(
        item_type=Item.ItemType.WORD,
        spanish_text="tres",
        german_text="drei",
        last_reviewed_at_es_to_de=now,
        due_at_es_to_de=now - timedelta(hours=1),
    )

    monkeypatch.setattr(session_views.random, "shuffle", lambda seq: seq.reverse())

    client = APIClient()
    response = client.get("/api/session", {"size": 2})
    assert response.status_code == 200
    ids = [item["id"] for item in response.json()["items"]]
    assert ids == [late.id, middle.id]
    assert early.id not in ids


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
    # Review words are intentionally cheaper than new words, so due reviews stay ahead of new items.
    assert {due_a.id, due_b.id}.issubset(set(ids[:2]))


@pytest.mark.django_db
def test_regular_session_includes_ready_difficult_item_exercises():
    now = timezone.now()
    yesterday = now - timedelta(days=1)
    word = Item.objects.create(
        item_type=Item.ItemType.WORD,
        spanish_text="casa",
        german_text="Haus",
        is_difficult=True,
        difficult_marked_at=yesterday,
    )
    second_word = Item.objects.create(
        item_type=Item.ItemType.WORD,
        spanish_text="mesa",
        german_text="Tisch",
        is_difficult=True,
        difficult_marked_at=yesterday,
    )
    phrase = Item.objects.create(
        item_type=Item.ItemType.PHRASE,
        spanish_text="No entiendo",
        german_text="Ich verstehe nicht",
        is_difficult=True,
        difficult_marked_at=yesterday,
    )
    Item.objects.create(
        item_type=Item.ItemType.WORD,
        spanish_text="nuevo",
        german_text="neu",
    )

    client = APIClient()
    response = client.get("/api/session", {"duration_minutes": 5})

    assert response.status_code == 200
    items = response.json()["items"]
    first_word_batch = [item["id"] for item in items[:2]]
    second_word_batch = [item["id"] for item in items[2:4]]
    assert set(first_word_batch) == {second_word.id, word.id}
    assert second_word_batch == first_word_batch
    assert [item["id"] for item in items[4:6]] == [phrase.id, phrase.id]
    assert items[0]["repeatPracticeStep"] == "word_intro"
    assert items[1]["repeatPracticeStep"] == "word_intro"
    assert items[2]["repeatPracticeStep"] == "word_cloze"
    assert items[3]["repeatPracticeStep"] == "word_cloze"
    assert items[4]["direction"] == Item.ReviewDirection.SPANISH_TO_GERMAN
    assert items[4]["repeatedAfterFailure"] is True
    assert "repeatPracticeStep" not in items[4] or items[4]["repeatPracticeStep"] is None
    assert items[5]["repeatPracticeStep"] == "phrase_builder"


@pytest.mark.django_db
def test_regular_session_delays_same_day_difficult_items_until_tomorrow():
    now = timezone.now()
    difficult_today = Item.objects.create(
        item_type=Item.ItemType.WORD,
        spanish_text="casa",
        german_text="Haus",
        is_difficult=True,
        difficult_marked_at=now,
        last_reviewed_at_es_to_de=now,
        due_at_es_to_de=now,
    )
    new_item = Item.objects.create(
        item_type=Item.ItemType.WORD,
        spanish_text="mesa",
        german_text="Tisch",
    )

    client = APIClient()
    response = client.get("/api/session", {"duration_minutes": 2})

    assert response.status_code == 200
    items = response.json()["items"]
    assert difficult_today.id not in [item["id"] for item in items]
    assert all(not item["repeatedAfterFailure"] for item in items)
    assert any(item["id"] == new_item.id for item in items)


@pytest.mark.django_db
def test_session_estimates_review_items_lower_than_new_items():
    from learning.views.session import SessionEntry, estimated_seconds_for_entry

    word = Item.objects.create(
        item_type=Item.ItemType.WORD,
        spanish_text="mesa",
        german_text="Tisch",
    )
    phrase = Item.objects.create(
        item_type=Item.ItemType.PHRASE,
        spanish_text="Necesito ayuda.",
        german_text="Ich brauche Hilfe.",
    )

    assert estimated_seconds_for_entry(SessionEntry(item=word, mode="review", direction=Item.ReviewDirection.SPANISH_TO_GERMAN)) == 15
    assert estimated_seconds_for_entry(SessionEntry(item=phrase, mode="review", direction=Item.ReviewDirection.SPANISH_TO_GERMAN)) == 25
    assert estimated_seconds_for_entry(SessionEntry(item=word, mode="new", direction=None)) == 70
    assert estimated_seconds_for_entry(SessionEntry(item=phrase, mode="new", direction=None)) == 80


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
    option_item = next(option for option in item["option_items"] if option["text"] == phrase.german_text)
    assert option_item["id"] == phrase.id


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
    option_item = next(option for option in item["option_items"] if option["text"] == word.spanish_text)
    assert option_item["id"] == word.id
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
        audio_url="http://localhost:8000/media/audio/turn-mock.mp3",
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
    assert payload_item["related_dialogs"][0]["turns"][0]["phrase_audio_url"] == "http://localhost:8000/media/audio/turn-mock.mp3"
    assert payload_item["related_dialogs"][0]["matched_turns"][0]["turn_index"] == 0


@pytest.mark.django_db
def test_phrase_target_to_source_uses_neighboring_dialog_line_as_answer():
    now = timezone.now()
    phrase = Item.objects.create(
        item_type=Item.ItemType.PHRASE,
        spanish_text="No entiendo",
        german_text="Ich verstehe nicht",
        source_language="spanish",
        target_language="german",
        last_reviewed_at_de_to_es=now,
        due_at_de_to_es=now,
    )
    origin_dialog = SavedDialog.objects.create(
        topic="confusion",
        context="asking for help",
        source_language="spanish",
        target_language="german",
        turns=[
            {"source_text": "No entiendo", "target_text": "Ich verstehe nicht"},
            {"source_text": "Estoy perdido", "target_text": "Ich bin verloren"},
        ],
    )
    origin_turn = DialogTurn.objects.create(
        dialog=origin_dialog,
        turn_index=0,
        source_text="No entiendo",
        target_text="Ich verstehe nicht",
    )
    ItemDialogOccurrence.objects.create(
        item=phrase,
        dialog=origin_dialog,
        turn=origin_turn,
        turn_index=0,
        side=ItemDialogOccurrence.Side.TARGET,
        match_score=1,
    )
    other_dialog = SavedDialog.objects.create(
        topic="cafe",
        context="ordering",
        source_language="spanish",
        target_language="german",
        turns=[
            {"source_text": "Quiero cafe", "target_text": "Ich moechte Kaffee", "speaker": "a"},
            {"source_text": "Con leche?", "target_text": "Mit Milch?", "speaker": "b"},
            {"source_text": "Si, por favor", "target_text": "Ja, bitte", "speaker": "a"},
            {"source_text": "Algo mas?", "target_text": "Sonst noch etwas?", "speaker": "b"},
        ],
    )
    DialogTurn.objects.create(
        dialog=other_dialog,
        turn_index=0,
        source_text="Quiero cafe",
        target_text="Ich moechte Kaffee",
    )
    DialogTurn.objects.create(
        dialog=other_dialog,
        turn_index=1,
        source_text="Con leche?",
        target_text="Mit Milch?",
    )
    DialogTurn.objects.create(
        dialog=other_dialog,
        turn_index=2,
        source_text="Si, por favor",
        target_text="Ja, bitte",
    )
    DialogTurn.objects.create(
        dialog=other_dialog,
        turn_index=3,
        source_text="Algo mas?",
        target_text="Sonst noch etwas?",
    )

    client = APIClient()
    response = client.get(
        "/api/session",
        {"size": 1, "source_language": "spanish", "target_language": "german"},
    )

    assert response.status_code == 200
    payload_item = response.json()["items"][0]
    assert payload_item["id"] == phrase.id
    assert payload_item["direction"] == Item.ReviewDirection.GERMAN_TO_SPANISH
    assert payload_item["dialog_phrase_answer"] == "Estoy perdido"
    assert payload_item["dialog_phrase_odd_index"] in {0, 1, 2, 3}
    assert len(payload_item["dialog_phrase_options"]) == 4
    assert len(payload_item["dialog_phrase_turns"]) == 4
    assert payload_item["dialog_phrase_turns"][payload_item["dialog_phrase_odd_index"]]["target_text"] == "Estoy perdido"
    assert payload_item["dialog_phrase_options"][payload_item["dialog_phrase_odd_index"]] == "Estoy perdido"
    assert "No entiendo" not in payload_item["dialog_phrase_options"]
    remaining_dialog_lines = {"Ich moechte Kaffee", "Mit Milch?", "Ja, bitte", "Sonst noch etwas?"}
    displayed_lines = set(payload_item["dialog_phrase_options"])
    assert "Estoy perdido" in displayed_lines
    assert len(displayed_lines & remaining_dialog_lines) == 3


@pytest.mark.django_db
def test_phrase_target_to_source_session_uses_dialog_turn_audio_as_prompt_audio():
    now = timezone.now()
    phrase = Item.objects.create(
        item_type=Item.ItemType.PHRASE,
        spanish_text="No entiendo",
        german_text="Ich verstehe nicht",
        source_language="spanish",
        target_language="german",
        audio_url="http://localhost:8000/media/audio/openai-phrase.mp3",
        last_reviewed_at_de_to_es=now,
        due_at_de_to_es=now,
    )
    dialog = SavedDialog.objects.create(
        topic="confusion",
        context="asking for help",
        source_language="spanish",
        target_language="german",
        turns=[{"source_text": "No entiendo", "target_text": "Ich verstehe nicht"}],
    )
    turn = DialogTurn.objects.create(
        dialog=dialog,
        turn_index=0,
        source_text="No entiendo",
        target_text="Ich verstehe nicht",
        audio_url="http://localhost:8000/media/audio/elevenlabs-turn.mp3",
    )
    ItemDialogOccurrence.objects.create(
        item=phrase,
        dialog=dialog,
        turn=turn,
        turn_index=0,
        side=ItemDialogOccurrence.Side.TARGET,
        match_score=1,
    )

    client = APIClient()
    response = client.get(
        "/api/session",
        {"size": 1, "source_language": "spanish", "target_language": "german"},
    )

    assert response.status_code == 200
    payload_item = response.json()["items"][0]
    assert payload_item["id"] == phrase.id
    assert payload_item["audio_url"] == "http://localhost:8000/media/audio/openai-phrase.mp3"
    assert payload_item["prompt_audio_url"] == "http://localhost:8000/media/audio/elevenlabs-turn.mp3"
