import pytest
from rest_framework.test import APIClient

from learning.models import SavedDialog
from learning.views.content import api, persistence


@pytest.mark.django_db
def test_beginner_dialog_keeps_level_when_saved_loaded_and_filtered(monkeypatch):
    monkeypatch.setattr(api, "select_dialog_speaker_voice_ids", lambda *args, **kwargs: None)
    monkeypatch.setattr(persistence, "create_audio_file", lambda *args, **kwargs: "/test.mp3")
    client = APIClient()
    response = client.post("/api/content/confirm", {
        "topic": "shopping", "proficiency_level": "A0", "selected_turn_indexes": [],
        "dialog_turns": [{"speaker": "a", "source_text": "Un pan, por favor.", "target_text": "Ein Brot, bitte."}],
    }, format="json")
    assert response.status_code == 200, response.data
    dialog_id = response.json()["saved_dialog_id"]
    assert SavedDialog.objects.get(pk=dialog_id).proficiency_level == "A0"
    SavedDialog.objects.create(topic="shopping", proficiency_level="A1")
    listing = client.get("/api/content/dialogs?source_language=spanish&target_language=german&proficiency_level=A0")
    assert listing.status_code == 200
    assert [row["dialog_id"] for row in listing.json()["dialogs"]] == [dialog_id]
    detail = client.get(f"/api/content/dialogs/{dialog_id}?source_language=spanish&target_language=german")
    assert detail.status_code == 200
    assert detail.json()["proficiency_level"] == "A0"
