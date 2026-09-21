from unittest.mock import Mock

import pytest
from rest_framework.test import APIClient

from learning.models import DialogTurn, SavedDialog
from learning.views.content import management_dialogs_listing


@pytest.fixture
def dialog_turn(db):
    dialog = SavedDialog.objects.create(
        topic="shopping", source_language="spanish", target_language="german",
    )
    return DialogTurn.objects.create(
        dialog=dialog, turn_index=0, source_text="Hola", target_text="Hallo",
        audio_url="https://example.com/natural.mp3",
    )


@pytest.mark.django_db
def test_clear_audio_is_saved_and_reused_without_changing_natural_audio(dialog_turn, monkeypatch):
    generate = Mock(return_value="https://example.com/clear.mp3")
    monkeypatch.setattr(management_dialogs_listing, "create_openai_audio_file", generate)
    client = APIClient()
    url = f"/api/content/dialogs/{dialog_turn.dialog_id}/turns/0/clear-audio?source_language=spanish&target_language=german"

    for _ in range(2):
        response = client.post(url)
        assert response.status_code == 200
        assert response.json()["audio_url"] == "https://example.com/clear.mp3"

    generate.assert_called_once_with("Hallo", "phrase", target_language="german")
    dialog_turn.refresh_from_db()
    assert dialog_turn.clear_audio_url == "https://example.com/clear.mp3"
    assert dialog_turn.audio_url == "https://example.com/natural.mp3"


@pytest.mark.django_db
def test_failed_clear_audio_generation_is_not_saved(dialog_turn, monkeypatch):
    monkeypatch.setattr(management_dialogs_listing, "create_openai_audio_file", Mock(return_value=""))
    response = APIClient().post(
        f"/api/content/dialogs/{dialog_turn.dialog_id}/turns/0/clear-audio?source_language=spanish&target_language=german",
    )
    assert response.status_code == 503
    dialog_turn.refresh_from_db()
    assert dialog_turn.clear_audio_url == ""
    assert dialog_turn.audio_url == "https://example.com/natural.mp3"
