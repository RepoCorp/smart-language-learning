from unittest.mock import Mock

import pytest
from rest_framework.test import APIClient

from learning.models import DialogTurn, Item, ItemDialogOccurrence, SavedDialog
from learning.views.content import management_items_detail, management_items_regenerate, persistence
from learning.views.content.types import ContentCandidate


EXPRESSION = "sich vorstellen, dass\u2026"
CONTEXT = "Ich kann mir vorstellen, dass das funktioniert."
OLD_AUDIO = "https://example.com/old.mp3"
NEW_AUDIO = "https://example.com/new.mp3"


@pytest.fixture
def word(db):
    return Item.objects.create(
        item_type=Item.ItemType.WORD, word_type="expression",
        german_text=EXPRESSION, spanish_text="imaginarse que",
        source_language="spanish", target_language="german",
        example_sentence=CONTEXT, audio_url=OLD_AUDIO,
    )


def audio_url(item):
    return f"/api/content/items/{item.id}?source_language=spanish&target_language=german"


@pytest.mark.parametrize("text,word_type", [(EXPRESSION, "expression"), ("vorstellen", "verb"), ("der Hund", "noun")])
def test_regenerate_word_audio_speaks_only_saved_text(word, monkeypatch, text, word_type):
    word.german_text = text
    word.word_type = word_type
    word.save()
    generate = Mock(return_value=NEW_AUDIO)
    monkeypatch.setattr(management_items_detail, "create_openai_audio_file", generate)

    response = APIClient().post(audio_url(word))

    assert response.status_code == 200
    assert response.json() == {"audio_url": NEW_AUDIO}
    generate.assert_called_once_with(text, "word", target_language="german")
    word.refresh_from_db()
    assert word.audio_url == NEW_AUDIO
    assert word.example_sentence == CONTEXT
    assert word.german_text == text


def test_regenerate_phrase_audio_does_not_append_context(word, monkeypatch):
    word.item_type = Item.ItemType.PHRASE
    word.save()
    generate = Mock(return_value=NEW_AUDIO)
    monkeypatch.setattr(management_items_detail, "create_openai_audio_file", generate)

    assert APIClient().post(audio_url(word)).status_code == 200
    generate.assert_called_once_with(EXPRESSION, "phrase", target_language="german")


def test_failed_audio_regeneration_preserves_existing_clip(word, monkeypatch):
    monkeypatch.setattr(management_items_detail, "create_openai_audio_file", Mock(return_value=""))

    assert APIClient().post(audio_url(word)).status_code == 503
    word.refresh_from_db()
    assert word.audio_url == OLD_AUDIO
    assert word.example_sentence == CONTEXT


@pytest.mark.django_db
@pytest.mark.parametrize("context", [CONTEXT, ""])
def test_new_word_audio_keeps_context_separate(monkeypatch, context):
    generate = Mock(return_value=NEW_AUDIO)
    monkeypatch.setattr(persistence, "create_openai_audio_file", generate)

    item = persistence.create_word_if_missing(
        user=None, topic="ideas", source_language="spanish", target_language="german",
        candidate=ContentCandidate(
            spanish_text="imaginarse que", german_text=EXPRESSION, exists=False,
            word_type="expression", source_phrase_german=context,
        ),
    )

    generate.assert_called_once_with(EXPRESSION, "word", target_language="german")
    assert item.audio_url == NEW_AUDIO
    assert item.example_sentence == context


def test_full_word_regeneration_keeps_context_out_of_audio(word, monkeypatch):
    dialog = SavedDialog.objects.create(topic="ideas", source_language="spanish", target_language="german")
    turn = DialogTurn.objects.create(
        dialog=dialog, turn_index=0, source_text="Me imagino que funciona.", target_text=CONTEXT,
        audio_url=OLD_AUDIO,
    )
    ItemDialogOccurrence.objects.create(item=word, dialog=dialog, turn=turn, turn_index=0)
    monkeypatch.setattr(management_items_regenerate, "resolve_dialog_click_word_pair", Mock(
        return_value=(word.spanish_text, EXPRESSION, "expression", ""),
    ))
    monkeypatch.setattr(management_items_regenerate, "_normalize_word_metadata", Mock(
        return_value=(word.spanish_text, EXPRESSION, "expression"),
    ))
    generate = Mock(return_value=NEW_AUDIO)
    monkeypatch.setattr(management_items_regenerate, "create_openai_audio_file", generate)

    response = APIClient().post(
        f"/api/content/items/{word.id}/regenerate?source_language=spanish&target_language=german",
    )

    assert response.status_code == 200
    generate.assert_called_once_with(EXPRESSION, "word", target_language="german")
    word.refresh_from_db()
    turn.refresh_from_db()
    assert word.audio_url == NEW_AUDIO
    assert word.example_sentence == CONTEXT
    assert turn.audio_url == OLD_AUDIO
    assert ItemDialogOccurrence.objects.filter(item=word, turn=turn).exists()
