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
    assert "phrases" in payload
    assert payload["phrases"][0]["spanish_text"] == "Hoy estudio python para ciencia de datos."
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


@pytest.mark.django_db
def test_content_topics_endpoint_returns_recent_topics(monkeypatch):
    from learning.views import content as content_views

    monkeypatch.setattr(
        content_views,
        "generate_content_with_chatgpt",
        lambda topic: (
            f"Hoy estudio {topic}.",
            f"Heute lerne ich {topic}.",
            "",
            [],
        ),
    )
    monkeypatch.setattr(content_views, "generate_conversation_with_chatgpt", lambda topic: None)

    client = APIClient()
    preview_one = client.post("/api/content/preview", {"topic": "travel"}, format="json")
    preview_two = client.post("/api/content/preview", {"topic": "cooking"}, format="json")
    assert preview_one.status_code == 200
    assert preview_two.status_code == 200

    response = client.get("/api/content/topics")
    assert response.status_code == 200
    topics = response.json()["topics"]
    assert "travel" in topics
    assert "cooking" in topics


@pytest.mark.django_db
def test_content_topic_contexts_endpoint_returns_contexts_for_topic(monkeypatch):
    from learning.views import content as content_views

    monkeypatch.setattr(content_views, "generate_conversation_with_chatgpt", lambda topic, context="": None)
    monkeypatch.setattr(
        content_views,
        "generate_content_with_chatgpt",
        lambda topic, context="": (
            f"Hoy estudio {topic}.",
            f"Heute lerne ich {topic}.",
            "",
            [],
        ),
    )

    client = APIClient()
    response_one = client.post(
        "/api/content/preview",
        {"topic": "travel", "context": "at the airport"},
        format="json",
    )
    response_two = client.post(
        "/api/content/preview",
        {"topic": "travel", "context": "buying train tickets"},
        format="json",
    )
    assert response_one.status_code == 200
    assert response_two.status_code == 200

    contexts_response = client.get("/api/content/topic-contexts", {"topic": "travel"})
    assert contexts_response.status_code == 200
    contexts = contexts_response.json()["contexts"]
    assert "at the airport" in contexts
    assert "buying train tickets" in contexts


@pytest.mark.django_db
def test_content_confirm_creates_only_selected_phrases(monkeypatch):
    from learning.views import content as content_views

    monkeypatch.setattr(
        content_views,
        "generate_conversation_with_chatgpt",
        lambda topic, context="": [
            {"spanish_text": "Hola.", "german_text": "Hallo.", "notes": ""},
            {"spanish_text": "Como estas?", "german_text": "Wie geht's?", "notes": ""},
        ],
    )
    monkeypatch.setattr(content_views, "generate_keywords_for_phrase_with_chatgpt", lambda s, g: [])
    monkeypatch.setattr(
        content_views,
        "create_audio_file",
        lambda text, prefix: f"http://localhost:8000/media/audio/{prefix}-mock.mp3",
    )

    client = APIClient()
    response = client.post(
        "/api/content/confirm",
        {
            "topic": "greetings",
            "selected_phrases": ["hola.|||hallo."],
            "selected_words": [],
        },
        format="json",
    )
    assert response.status_code == 200

    assert Item.objects.filter(item_type=Item.ItemType.PHRASE, spanish_text="Hola.", german_text="Hallo.").exists()
    assert (
        Item.objects.filter(item_type=Item.ItemType.PHRASE, spanish_text="Como estas?", german_text="Wie geht's?").exists()
        is False
    )


@pytest.mark.django_db
def test_content_preview_skips_keywords_not_present_in_phrase(monkeypatch):
    from learning.views import content as content_views

    monkeypatch.setattr(
        content_views,
        "generate_conversation_with_chatgpt",
        lambda topic, context="": [
            {
                "spanish_text": "Hola, cuanto es en total?",
                "german_text": "Hallo, wie viel macht das insgesamt?",
                "notes": "",
            }
        ],
    )
    monkeypatch.setattr(
        content_views,
        "generate_keywords_for_phrase_with_chatgpt",
        lambda spanish_phrase, german_phrase: [
            {
                "spanish_text": "total",
                "german_text": "der Gesamtbetrag",
                "notes": "",
                "plural_german": "",
            }
        ],
    )

    client = APIClient()
    response = client.post("/api/content/preview", {"topic": "shopping"}, format="json")

    assert response.status_code == 200
    words = response.json()["words"]
    german_words = [word["german_text"] for word in words]
    assert "der Gesamtbetrag" not in german_words
