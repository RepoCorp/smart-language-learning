from dataclasses import FrozenInstanceError

import pytest

from learning.learning_content import LearningDefinition
from learning.learning_content.phrases import PhraseDefinition
from learning.learning_content.phrases.languages.german.repeat_request import REPEAT_REQUEST


def test_curated_phrase_preserves_complete_text_and_both_translations():
    assert isinstance(REPEAT_REQUEST, LearningDefinition)
    assert isinstance(REPEAT_REQUEST, PhraseDefinition)
    assert REPEAT_REQUEST.text == "Könnten Sie das bitte wiederholen?"
    assert REPEAT_REQUEST.translations == {
        "english": "Could you please repeat that?",
        "spanish": "¿Podría repetir eso, por favor?",
    }
    assert set(REPEAT_REQUEST.display) == {"en", "es"}
    assert all(display["title"] == REPEAT_REQUEST.text for display in REPEAT_REQUEST.display.values())


def test_phrase_translation_is_not_substituted_when_missing():
    with pytest.raises(KeyError):
        _ = REPEAT_REQUEST.translations["french"]


def test_phrase_definition_fields_cannot_be_reassigned():
    with pytest.raises(FrozenInstanceError):
        REPEAT_REQUEST.text = "changed"
