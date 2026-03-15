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
                {"spanish_text": "python", "german_text": "Python"},
                {"spanish_text": "ciencia", "german_text": "Wissenschaft"},
                {"spanish_text": "datos", "german_text": "Daten"},
            ],
        ),
    )

    Item.objects.create(item_type=Item.ItemType.WORD, spanish_text="python", german_text="Python")

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
                {"spanish_text": "python", "german_text": "Python"},
                {"spanish_text": "avanzado", "german_text": "fortgeschritten"},
            ],
        ),
    )

    Item.objects.create(item_type=Item.ItemType.WORD, spanish_text="python", german_text="Python")

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
    assert Item.objects.filter(item_type=Item.ItemType.WORD, spanish_text="avanzado").exists()


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
                {"spanish_text": "robotica", "german_text": "Robotik"},
                {"spanish_text": "aplicada", "german_text": "angewandt"},
                {"spanish_text": "avanzada", "german_text": "fortgeschritten"},
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
                {"spanish_text": "robotica", "german_text": "Robotik"},
                {"spanish_text": "aplicada", "german_text": "angewandt"},
                {"spanish_text": "avanzada", "german_text": "fortgeschritten"},
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
        german_text="angewandt",
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

    ExcludedWordSuggestion.objects.create(spanish_text="banco", german_text="Bankinstitut")

    monkeypatch.setattr(
        content_views,
        "generate_content_with_chatgpt",
        lambda topic: (
            "Hoy estudio en el banco del parque.",
            "Heute lerne ich auf der Parkbank.",
            [
                {"spanish_text": "banco", "german_text": "Parkbank"},
                {"spanish_text": "parque", "german_text": "Park"},
            ],
        ),
    )

    client = APIClient()
    response = client.post("/api/content/preview", {"topic": "parque"}, format="json")

    assert response.status_code == 200
    words = response.json()["words"]
    suggested_pairs = {(w["spanish_text"].lower(), w["german_text"].lower()) for w in words}
    assert ("banco", "parkbank") in suggested_pairs
