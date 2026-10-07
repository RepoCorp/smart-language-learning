from unittest.mock import Mock

import pytest

from learning.views.content import dialog_click_resolution as resolution


def resolve(**overrides):
    return resolution.resolve_dialog_click_word_pair(**{
        "user": None, "source_text": "kommt", "target_text": "kommt",
        "source_language": "spanish", "target_language": "german",
        "dialog_id_raw": None, "turn_index_raw": None,
        "target_line": "Er kommt heute.", "clicked_target_token": "kommt",
        **overrides,
    })


@pytest.mark.parametrize("target,word_type", [("kommen", "verb"), ("Hund", "noun"), ("aufstehen", "verb")])
def test_normal_resolution_preserves_word_and_context(monkeypatch, target, word_type):
    model = Mock(return_value={"source_text": "significado", "target_text": target, "word_type": word_type})
    monkeypatch.setattr(resolution, "call_openai_json", model)
    assert resolve() == ("significado", target, word_type, "")
    model.assert_called_once()
    assert "Clicked target word: kommt" in model.call_args.args[1]
    assert "Er kommt heute." in model.call_args.args[1]


@pytest.mark.parametrize("payload", [None, {}, {"source_text": "venir", "target_text": "kommen"}])
def test_invalid_resolution_fails_explicitly(monkeypatch, payload):
    monkeypatch.setattr(resolution, "call_openai_json", Mock(return_value=payload))
    with pytest.raises(RuntimeError):
        resolve()


def test_no_context_does_not_call_model(monkeypatch):
    model = Mock()
    monkeypatch.setattr(resolution, "call_openai_json", model)
    with pytest.raises(RuntimeError):
        resolve(target_line="")
    model.assert_not_called()


@pytest.mark.parametrize("word_type,target", [("helper", "können"), ("expression", "sich erinnern")])
@pytest.mark.parametrize("refinement,expected_note", [
    ({"note": ""}, ""),
    ({"note": "  \n  "}, ""),
    ({}, "Previous note."),
    ({"note": "  Useful general usage note.  "}, "Useful general usage note."),
])
def test_special_refinement_distinguishes_empty_notes_from_omitted_notes(
    monkeypatch, word_type, target, refinement, expected_note,
):
    model = Mock(side_effect=[
        {"source_text": "significado", "target_text": target, "word_type": word_type, "note": "Previous note."},
        refinement,
    ])
    monkeypatch.setattr(resolution, "call_openai_json", model)

    assert resolve() == ("significado", target, word_type, expected_note)
    assert model.call_count == 2
