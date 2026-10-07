import re
from unittest.mock import Mock

import pytest

from learning.views.content import dialog_click_resolution, generation


def assert_optional_reusable_notes(prompt):
    assert re.search(r"default notes? to an empty string", prompt, re.IGNORECASE)
    assert "important, non-obvious meaning or usage information" in prompt
    assert "remains useful outside" in prompt
    assert "source language" in prompt
    assert "Do not repeat the translation" in prompt
    assert re.search(r'return notes? as ""', prompt)


def test_conversation_generation_model_receives_optional_notes_and_preserves_empty_results(monkeypatch):
    model = Mock(side_effect=[
        {"scenarios": [
            "Comprar pan.", "Pedir un café.", "Preguntar un precio.",
            "Reservar una mesa.", "Comprar un billete.",
        ]},
        {"conversation": [
            {"speaker": "a", "source_text": "Un café, por favor.", "target_text": "Einen Kaffee, bitte.", "notes": ""},
            {"speaker": "b", "source_text": "Aquí tiene.", "target_text": "Bitte schön.", "notes": ""},
            {"speaker": "a", "source_text": "Gracias.", "target_text": "Danke.", "notes": ""},
        ]},
    ])
    monkeypatch.setattr(generation, "call_openai_json", model)
    monkeypatch.setattr(generation, "choice", lambda values: values[0])

    result = generation.generate_conversation_with_chatgpt(
        "coffee", dialog_length="short_three", source_language="spanish", target_language="german",
    )

    assert model.call_count == 2
    assert_optional_reusable_notes(model.call_args.args[0])
    assert [phrase["notes"] for phrase in result] == ["", "", ""]


def test_keyword_model_receives_optional_notes_and_preserves_empty_results(monkeypatch):
    model = Mock(return_value={"keywords": [{
        "source_text": "el perro", "target_text": "der Hund", "word_type": "noun",
        "notes": "", "plural_target": "die Hunde",
    }]})
    monkeypatch.setattr(generation, "call_openai_json", model)

    result = generation.generate_keywords_for_phrase_with_chatgpt(
        "El perro duerme.", "Der Hund schläft.", "spanish", "german",
    )

    model.assert_called_once()
    prompt = model.call_args.args[0]
    assert_optional_reusable_notes(prompt)
    assert "canonical form does not by itself justify a note" in prompt
    assert result[0]["notes"] == ""
    assert result[0]["german_text"] == "der Hund"


@pytest.mark.parametrize("include_constructions", [False, True])
def test_word_resolution_model_receives_optional_notes_and_preserves_empty_results(monkeypatch, include_constructions):
    model = Mock(return_value={
        "source_text": "amigo", "target_text": "Freund", "word_type": "noun", "note": "",
        "construction_pattern_key": None, "construction_evidence": [],
    })
    monkeypatch.setattr(dialog_click_resolution, "call_openai_json", model)

    result = dialog_click_resolution.resolve_dialog_click_word_pair(
        user=None, source_text="amigo", target_text="Freund",
        source_language="spanish", target_language="german",
        dialog_id_raw=None, turn_index_raw=None,
        source_line="Mi amigo está aquí.", target_line="Mein Freund ist hier.",
        clicked_target_token="Freund", include_constructions=include_constructions,
    )

    model.assert_called_once()
    prompt = model.call_args.args[0]
    assert_optional_reusable_notes(prompt)
    assert "including helpers and expressions" in prompt
    assert "For a construction that replaces the word" in prompt
    assert "note must explain its use in THIS sentence" in prompt
    assert "required construction explanations above remain separate" in prompt
    assert result == ("amigo", "Freund", "noun", "")


@pytest.mark.parametrize(("word_type", "target_text", "source_text"), [
    ("helper", "können", "poder"),
    ("expression", "von etwas halten", "opinar sobre algo"),
])
def test_special_refinement_model_receives_optional_notes_policy(monkeypatch, word_type, target_text, source_text):
    model = Mock(return_value={"source_text": source_text, "target_text": target_text, "note": ""})
    monkeypatch.setattr(dialog_click_resolution, "call_openai_json", model)

    dialog_click_resolution.refine_special_click_resolution(
        clicked_word=target_text, source_context="Una frase de ejemplo.",
        target_context="Ein Beispielsatz mit mehreren Wörtern.",
        source_language="spanish", target_language="german",
        source_text=source_text, target_text=target_text, word_type=word_type, note="",
    )

    model.assert_called_once()
    prompt = model.call_args.args[0]
    assert f"Refine a clicked target-language {word_type} study item" in prompt
    assert "{word_type}" not in prompt
    assert_optional_reusable_notes(prompt)
    assert "even if the current note is nonempty" in prompt
