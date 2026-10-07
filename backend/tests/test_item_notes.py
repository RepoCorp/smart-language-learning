from unittest.mock import Mock

import pytest
from rest_framework.test import APIClient

from learning.models import DialogTurn, Item, ItemDialogOccurrence, SavedDialog
from learning.views.content import management_items_quick_add as quick_add
from learning.views.content import management_items_regenerate as regenerate
from learning.views.content import persistence


USEFUL_NOTE = "Se combina con otro verbo en infinitivo."
PAIR = ("poder", "können", "helper")
QUERY = "?source_language=spanish&target_language=german"


@pytest.fixture
def quick_add_model(monkeypatch):
    model = Mock()
    monkeypatch.setattr(quick_add, "_resolve_dialog_click_word_pair", model)
    monkeypatch.setattr(quick_add, "_normalize_word_metadata", Mock(return_value=PAIR))
    monkeypatch.setattr(persistence, "create_openai_audio_file", Mock(return_value="https://example.com/word.mp3"))
    return model


def add_helper(*, notes="", check_only=False):
    return APIClient().post(
        f"/api/content/words/add{QUERY}",
        {"source_text": "poder", "target_text": "können", "notes": notes, "check_only": check_only},
        format="json",
    )


@pytest.mark.django_db
@pytest.mark.parametrize("check_only", [False, True])
@pytest.mark.parametrize("model_note,user_note,expected", [
    ("", "", ""),
    (f"  {USEFUL_NOTE}  ", "", USEFUL_NOTE),
    ("", "Mi nota personal.", "Mi nota personal."),
    (USEFUL_NOTE, "Mi nota personal.", USEFUL_NOTE),
])
def test_quick_add_helper_notes_are_optional_without_boilerplate(
    quick_add_model, check_only, model_note, user_note, expected,
):
    quick_add_model.return_value = (*PAIR, model_note)

    response = add_helper(notes=user_note, check_only=check_only)

    assert response.status_code == (200 if check_only else 201)
    assert response.json()["notes"] == expected
    if check_only:
        assert not Item.objects.exists()
    else:
        assert Item.objects.get(id=response.json()["id"]).notes == expected


@pytest.mark.django_db
@pytest.mark.parametrize("check_only", [False, True])
def test_quick_add_preserves_an_existing_helpers_saved_note(quick_add_model, check_only):
    item = Item.objects.create(
        item_type=Item.ItemType.WORD, spanish_text="poder", german_text="können", word_type="helper",
        source_language="spanish", target_language="german", notes="My saved note.",
    )
    quick_add_model.return_value = (*PAIR, "")

    response = add_helper(check_only=check_only)

    assert response.status_code == 200
    assert response.json()["id"] == item.id
    assert response.json()["notes"] == "My saved note."
    item.refresh_from_db()
    assert item.notes == "My saved note."
    assert Item.objects.count() == 1


@pytest.mark.django_db
@pytest.mark.parametrize("model_note", ["", USEFUL_NOTE])
def test_regenerate_helper_saves_only_the_optional_model_note(monkeypatch, model_note):
    item = Item.objects.create(
        item_type=Item.ItemType.WORD, spanish_text="poder", german_text="können", word_type="helper",
        source_language="spanish", target_language="german", notes="Previous note.",
    )
    dialog = SavedDialog.objects.create(topic="plans", source_language="spanish", target_language="german")
    turn = DialogTurn.objects.create(
        dialog=dialog, turn_index=0, source_text="Puedo ir hoy.", target_text="Ich kann heute gehen.",
    )
    ItemDialogOccurrence.objects.create(item=item, dialog=dialog, turn=turn, turn_index=0)
    monkeypatch.setattr(regenerate, "resolve_dialog_click_word_pair", Mock(return_value=(*PAIR, model_note)))
    monkeypatch.setattr(regenerate, "_normalize_word_metadata", Mock(return_value=PAIR))
    monkeypatch.setattr(regenerate, "create_openai_audio_file", Mock(return_value="https://example.com/word.mp3"))

    response = APIClient().post(f"/api/content/items/{item.id}/regenerate{QUERY}")

    assert response.status_code == 200
    item.refresh_from_db()
    assert item.notes == model_note
    assert item.word_type == "helper"
    assert (item.spanish_text, item.german_text) == PAIR[:2]
