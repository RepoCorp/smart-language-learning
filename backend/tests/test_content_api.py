import pytest
from rest_framework.test import APIClient

from learning.models import ExcludedWordSuggestion, Item


@pytest.mark.django_db
def test_content_preview_returns_phrase_and_model_keywords(monkeypatch):
    from learning.views import content as content_views

    monkeypatch.setattr(
        content_views,
        "generate_content_with_chatgpt",
        lambda topic: (
            "Hoy estudio python para ciencia de datos.",
            "Heute lerne ich Python fuer Data Science.",
            [
                {"spanish_text": "python", "german_text": "das Python"},
                {"spanish_text": "ciencia", "german_text": "die Wissenschaft"},
                {"spanish_text": "datos", "german_text": "die Daten"},
            ],
        ),
    )

    Item.objects.create(item_type=Item.ItemType.WORD, spanish_text="python", german_text="das Python")

    client = APIClient()
    response = client.post("/api/content/preview", {"topic": "python para ciencia de datos"}, format="json")

    assert response.status_code == 200
    payload = response.json()
    assert "phrase" in payload
    assert payload["phrase"]["spanish_text"] == "Hoy estudio python para ciencia de datos."
    words = payload["words"]
    spanish_words = [word["spanish_text"].lower() for word in words]
    assert "python" in spanish_words
    assert "ciencia" in spanish_words
    assert "datos" in spanish_words
    python_word = next(word for word in words if word["spanish_text"].lower() == "python")
    assert python_word["exists"] is True


@pytest.mark.django_db
def test_content_confirm_creates_only_missing_items(monkeypatch):
    from learning.views import content as content_views

    monkeypatch.setattr(
        content_views,
        "generate_content_with_chatgpt",
        lambda topic: (
            "Hoy estudio python avanzado.",
            "Heute lerne ich fortgeschrittenes Python.",
            [
                {"spanish_text": "python", "german_text": "das Python"},
                {"spanish_text": "avanzado", "german_text": "der Fortschritt"},
            ],
        ),
    )
    monkeypatch.setattr(
        content_views,
        "create_audio_file",
        lambda text, prefix: f"http://localhost:8000/media/audio/{prefix}-mock.mp3",
    )

    Item.objects.create(item_type=Item.ItemType.WORD, spanish_text="python", german_text="das Python")

    client = APIClient()
    response = client.post(
        "/api/content/confirm",
        {"topic": "python avanzado", "selected_words": ["avanzado"]},
        format="json",
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["created_phrase"] is True
    assert "python" not in [word.lower() for word in payload["created_words"]]
    assert Item.objects.filter(item_type=Item.ItemType.PHRASE, spanish_text="Hoy estudio python avanzado.").exists()
    assert Item.objects.filter(
        item_type=Item.ItemType.WORD,
        spanish_text="avanzado",
        german_text="der Fortschritt",
    ).exists()
    assert (
        Item.objects.filter(
            item_type=Item.ItemType.PHRASE,
            spanish_text="Hoy estudio python avanzado.",
            audio_url="http://localhost:8000/media/audio/phrase-mock.mp3",
        ).exists()
        is True
    )
    assert (
        Item.objects.filter(
            item_type=Item.ItemType.WORD,
            spanish_text="avanzado",
            german_text="der Fortschritt",
            audio_url="http://localhost:8000/media/audio/word-mock.mp3",
        ).exists()
        is True
    )


@pytest.mark.django_db
def test_content_confirm_only_creates_selected_words(monkeypatch):
    from learning.views import content as content_views

    monkeypatch.setattr(
        content_views,
        "generate_content_with_chatgpt",
        lambda topic: (
            "Hoy estudio robotica aplicada avanzada.",
            "Heute lerne ich angewandte fortgeschrittene Robotik.",
            [
                {"spanish_text": "robotica", "german_text": "die Robotik"},
                {"spanish_text": "aplicada", "german_text": "die Anwendung"},
                {"spanish_text": "avanzada", "german_text": "der Fortschritt"},
            ],
        ),
    )
    monkeypatch.setattr(
        content_views,
        "create_audio_file",
        lambda text, prefix: f"http://localhost:8000/media/audio/{prefix}-mock.mp3",
    )

    client = APIClient()
    response = client.post(
        "/api/content/confirm",
        {"topic": "robotica aplicada avanzada", "selected_words": ["robotica", "avanzada"]},
        format="json",
    )

    assert response.status_code == 200
    payload = response.json()
    created_words = [word.lower() for word in payload["created_words"]]
    assert "robotica" in created_words
    assert "avanzada" in created_words
    assert "aplicada" not in created_words
    assert Item.objects.filter(item_type=Item.ItemType.WORD, spanish_text="aplicada").exists() is False


@pytest.mark.django_db
def test_unchecked_words_are_excluded_from_future_suggestions(monkeypatch):
    from learning.views import content as content_views

    monkeypatch.setattr(
        content_views,
        "generate_content_with_chatgpt",
        lambda topic: (
            "Hoy estudio robotica aplicada avanzada.",
            "Heute lerne ich angewandte fortgeschrittene Robotik.",
            [
                {"spanish_text": "robotica", "german_text": "die Robotik"},
                {"spanish_text": "aplicada", "german_text": "die Anwendung"},
                {"spanish_text": "avanzada", "german_text": "der Fortschritt"},
            ],
        ),
    )

    client = APIClient()
    response = client.post(
        "/api/content/confirm",
        {"topic": "robotica aplicada avanzada", "selected_words": ["robotica", "avanzada"]},
        format="json",
    )
    assert response.status_code == 200

    assert ExcludedWordSuggestion.objects.filter(
        spanish_text="aplicada",
        german_text="die anwendung",
    ).exists()

    preview_response = client.post(
        "/api/content/preview",
        {"topic": "robotica aplicada avanzada"},
        format="json",
    )
    assert preview_response.status_code == 200
    words = preview_response.json()["words"]
    preview_words = [word["spanish_text"].lower() for word in words]
    assert "aplicada" not in preview_words


@pytest.mark.django_db
def test_exclusion_requires_spanish_and_german_match(monkeypatch):
    from learning.views import content as content_views

    ExcludedWordSuggestion.objects.create(spanish_text="banco", german_text="das bankinstitut")

    monkeypatch.setattr(
        content_views,
        "generate_content_with_chatgpt",
        lambda topic: (
            "Hoy estudio en el banco del parque.",
            "Heute lerne ich auf der Parkbank.",
            [
                {"spanish_text": "banco", "german_text": "die Parkbank"},
                {"spanish_text": "parque", "german_text": "der Park"},
            ],
        ),
    )

    client = APIClient()
    response = client.post("/api/content/preview", {"topic": "parque"}, format="json")

    assert response.status_code == 200
    words = response.json()["words"]
    suggested_pairs = {(w["spanish_text"].lower(), w["german_text"].lower()) for w in words}
    assert ("banco", "die parkbank") in suggested_pairs


@pytest.mark.django_db
def test_content_preview_skips_keywords_without_german_article(monkeypatch):
    from learning.views import content as content_views

    monkeypatch.setattr(
        content_views,
        "generate_content_with_chatgpt",
        lambda topic: (
            "Hoy estudio ciencia y parque.",
            "Heute lerne ich Wissenschaft und Park.",
            [
                {"spanish_text": "ciencia", "german_text": "Wissenschaft"},
                {"spanish_text": "parque", "german_text": "der Park"},
            ],
        ),
    )

    client = APIClient()
    response = client.post("/api/content/preview", {"topic": "ciencia"}, format="json")

    assert response.status_code == 200
    words = response.json()["words"]
    spanish_words = [word["spanish_text"].lower() for word in words]
    assert "ciencia" not in spanish_words
    assert "parque" in spanish_words


@pytest.mark.django_db
def test_word_audio_includes_word_and_phrase(monkeypatch):
    from learning.views import content as content_views

    captured_audio_inputs: list[tuple[str, str]] = []

    monkeypatch.setattr(
        content_views,
        "generate_content_with_chatgpt",
        lambda topic: (
            "Hoy estudio parques urbanos.",
            "Heute lerne ich stadtische Parks.",
            [
                {"spanish_text": "parque", "german_text": "der Park"},
            ],
        ),
    )

    def fake_create_audio_file(text: str, prefix: str) -> str:
        captured_audio_inputs.append((prefix, text))
        return f"http://localhost:8000/media/audio/{prefix}-mock.mp3"

    monkeypatch.setattr(content_views, "create_audio_file", fake_create_audio_file)

    client = APIClient()
    response = client.post(
        "/api/content/confirm",
        {"topic": "parques urbanos", "selected_words": ["parque"]},
        format="json",
    )

    assert response.status_code == 200
    assert ("phrase", "Heute lerne ich stadtische Parks.") in captured_audio_inputs
    assert ("word", "der Park. Heute lerne ich stadtische Parks.") in captured_audio_inputs
    created_word = Item.objects.get(item_type=Item.ItemType.WORD, spanish_text="parque", german_text="der Park")
    assert created_word.notes == ""
    assert created_word.example_sentence == "Heute lerne ich stadtische Parks."


@pytest.mark.django_db
def test_content_confirm_saves_model_notes_when_present(monkeypatch):
    from learning.views import content as content_views

    monkeypatch.setattr(
        content_views,
        "generate_content_with_chatgpt",
        lambda topic: (
            "Hoy visito el parque.",
            "Heute besuche ich den Park.",
            "Useful phrase note from model.",
            [
                {
                    "spanish_text": "parque",
                    "german_text": "der Park",
                    "notes": "Masculine noun, plural: die Parks.",
                    "plural_german": "die Parks",
                },
            ],
        ),
    )
    monkeypatch.setattr(
        content_views,
        "create_audio_file",
        lambda text, prefix: f"http://localhost:8000/media/audio/{prefix}-mock.mp3",
    )

    client = APIClient()
    response = client.post(
        "/api/content/confirm",
        {"topic": "parque", "selected_words": ["parque"]},
        format="json",
    )

    assert response.status_code == 200
    phrase = Item.objects.get(item_type=Item.ItemType.PHRASE, spanish_text="Hoy visito el parque.")
    word = Item.objects.get(item_type=Item.ItemType.WORD, spanish_text="parque", german_text="der Park")
    assert phrase.notes == "Useful phrase note from model."
    assert word.notes == "Masculine noun, plural: die Parks."


@pytest.mark.django_db
def test_content_confirm_adds_plural_to_word_notes(monkeypatch):
    from learning.views import content as content_views

    monkeypatch.setattr(
        content_views,
        "generate_content_with_chatgpt",
        lambda topic: (
            "Hoy visito el jardin.",
            "Heute besuche ich den Garten.",
            "",
            [
                {
                    "spanish_text": "jardin",
                    "german_text": "der Garten",
                    "notes": "Common noun.",
                    "plural_german": "die Garten",
                },
            ],
        ),
    )
    monkeypatch.setattr(
        content_views,
        "create_audio_file",
        lambda text, prefix: f"http://localhost:8000/media/audio/{prefix}-mock.mp3",
    )

    client = APIClient()
    response = client.post(
        "/api/content/confirm",
        {"topic": "jardin", "selected_words": ["jardin"]},
        format="json",
    )

    assert response.status_code == 200
    word = Item.objects.get(item_type=Item.ItemType.WORD, spanish_text="jardin", german_text="der Garten")
    assert word.notes == "Common noun. Plural: die Garten"
