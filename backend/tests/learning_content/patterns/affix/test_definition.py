from dataclasses import FrozenInstanceError, fields

import pytest

from learning.learning_content import LearningDefinition
from learning.learning_content.patterns.affix import AffixExample, AffixPatternDefinition


def definition(**overrides):
    return AffixPatternDefinition(**{
        "key": "english_suffix_ness",
        "language": "english",
        "display": {
            "en": {"title": "-ness", "explanation": "Names a quality or state."},
        },
        "item_view": "affix_pattern",
        "strategies": (),
        "exercises": (),
        "evaluations": {},
        "affix": "-ness",
        "position": "suffix",
        "word_types": ("noun",),
        "examples": (
            AffixExample(
                base="happy",
                result="happiness",
                translations={"spanish": {"base": "feliz", "result": "felicidad"}},
            ),
            AffixExample(
                base="kind",
                result="kindness",
                translations={"spanish": {"base": "amable", "result": "amabilidad"}},
            ),
        ),
        **overrides,
    })


def test_extends_shared_definition_without_defining_evaluation_behavior():
    item = definition()
    assert isinstance(item, LearningDefinition)
    assert item.key == "english_suffix_ness"
    assert item.item_view == "affix_pattern"
    assert item.evaluations == {}
    assert {field.name for field in fields(AffixPatternDefinition)} - {
        field.name for field in fields(LearningDefinition)
    } == {"affix", "position", "word_types", "examples"}


@pytest.mark.parametrize(("affix", "position"), [("un-", "prefix"), ("-ness", "suffix")])
def test_preserves_affix_notation_and_explicit_position(affix, position):
    item = definition(affix=affix, position=position, word_types=("noun", "adjective"))
    assert item.affix == affix
    assert item.position == position
    assert item.word_types == ("noun", "adjective")


def test_preserves_curated_spelling_changes_and_example_order():
    item = definition()
    assert [(example.base, example.result) for example in item.examples] == [
        ("happy", "happiness"), ("kind", "kindness"),
    ]
    assert item.examples[0].translations["spanish"] == {
        "base": "feliz", "result": "felicidad",
    }


def test_missing_example_translation_does_not_fall_back_to_interface_language():
    item = definition()
    assert "en" in item.display
    with pytest.raises(KeyError):
        _ = item.examples[0].translations["english"]


def test_definition_and_example_fields_cannot_be_reassigned():
    item = definition()
    with pytest.raises(FrozenInstanceError):
        item.affix = "-other"
    with pytest.raises(FrozenInstanceError):
        item.examples[0].result = "happyness"
