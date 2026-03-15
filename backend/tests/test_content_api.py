import pytest
from rest_framework.test import APIClient

from learning.models import Item


@pytest.mark.django_db
def test_content_preview_returns_phrase_and_filtered_words():
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
    assert "para" not in spanish_words
    assert "de" not in spanish_words
    python_word = next(word for word in words if word["spanish_text"].lower() == "python")
    assert python_word["exists"] is True


@pytest.mark.django_db
def test_content_confirm_creates_only_missing_items():
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
def test_content_confirm_only_creates_selected_words():
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
