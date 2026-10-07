from dataclasses import FrozenInstanceError, replace

import pytest

from learning.learning_content import LearningDefinition
from learning.learning_content.words import WordDefinition
from learning.learning_content.words.languages.german.moeglichkeit import MOEGLICHKEIT


def test_curated_noun_preserves_article_gender_and_both_translations():
    assert isinstance(MOEGLICHKEIT, LearningDefinition)
    assert isinstance(MOEGLICHKEIT, WordDefinition)
    assert MOEGLICHKEIT.text == "die Möglichkeit"
    assert MOEGLICHKEIT.word_type == "noun"
    assert MOEGLICHKEIT.gender == "feminine"
    assert MOEGLICHKEIT.translations == {
        "english": "the possibility", "spanish": "la posibilidad",
    }
    assert set(MOEGLICHKEIT.display) == {"en", "es"}
    assert all(display["title"] == MOEGLICHKEIT.text for display in MOEGLICHKEIT.display.values())


def test_word_gender_can_be_explicitly_absent():
    word = replace(MOEGLICHKEIT, text="möglich", word_type="adjective", gender=None)
    assert word.gender is None


def test_word_translation_is_not_substituted_when_missing():
    with pytest.raises(KeyError):
        _ = MOEGLICHKEIT.translations["french"]


def test_word_definition_fields_cannot_be_reassigned():
    with pytest.raises(FrozenInstanceError):
        MOEGLICHKEIT.text = "changed"
