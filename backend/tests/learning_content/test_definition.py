from dataclasses import FrozenInstanceError, fields

import pytest

from learning.learning_content import LearningDefinition


def definition(**overrides):
    return LearningDefinition(**{
        "key": "example_pattern",
        "language": "german",
        "display": {
            "en": {"title": "Example pattern", "explanation": "An explanation."},
            "es": {"title": "Patrón de ejemplo", "explanation": "Una explicación."},
        },
        "item_view": "example_view",
        "strategies": ("view_examples",),
        "exercises": ("guided_practice",),
        "evaluations": {
            "source_to_target": "production_check",
            "target_to_source": "recognition_check",
        },
        **overrides,
    })


def test_keeps_display_view_and_learning_activities_separate():
    item = definition()
    assert item.display["es"]["title"] == "Patrón de ejemplo"
    assert item.language == "german"
    assert item.item_view == "example_view"
    assert item.strategies == ("view_examples",)
    assert item.exercises == ("guided_practice",)
    assert item.evaluations["source_to_target"] == "production_check"
    assert item.evaluations["target_to_source"] == "recognition_check"


def test_capabilities_can_be_explicitly_unavailable():
    item = definition(language="other", strategies=(), exercises=(), evaluations={})
    assert item.language == "other"
    assert item.strategies == item.exercises == ()
    assert item.evaluations == {}
    with pytest.raises(KeyError):
        _ = item.evaluations["source_to_target"]


def test_missing_translation_does_not_silently_select_another_language():
    with pytest.raises(KeyError):
        _ = definition().display["fr"]


def test_definition_fields_cannot_be_reassigned():
    with pytest.raises(FrozenInstanceError):
        definition().key = "changed"


def test_base_has_only_shared_configuration_not_user_state_or_family_rules():
    assert {field.name for field in fields(LearningDefinition)} == {
        "key", "language", "display", "item_view", "strategies", "exercises", "evaluations",
    }


def test_constructor_requires_explicit_capabilities():
    with pytest.raises(TypeError):
        LearningDefinition(key="incomplete", language="other")
