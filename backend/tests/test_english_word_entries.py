from unittest.mock import Mock

import pytest

from learning.prompts import WORD_METADATA_RULE_PROMPTS
from learning.views.content import word_metadata
from learning.views.content.generation_words import generate_keywords_for_phrase_with_chatgpt


@pytest.mark.parametrize(
    "word_type,selected,canonical,source,rule",
    [
        ("noun", "dogs", "the dog", "el perro", '\"the\" followed by the singular noun'),
        ("verb", "works", "to work", "trabajar", '"to" followed by the infinitive'),
        ("verb", "looked after", "to look after", "cuidar", 'Include "to" exactly once'),
    ],
)
def test_english_word_entry_rules_reach_normalization_model(
    monkeypatch, word_type, selected, canonical, source, rule
):
    model = Mock(side_effect=[
        {"source_text": source, "target_text": selected, "word_type": word_type},
        {"source_text": source, "target_text": canonical},
    ])
    monkeypatch.setattr(word_metadata, "call_openai_json", model)

    result = word_metadata.basic_word_metadata(
        source_text=source, target_text=selected, source_language="spanish",
        target_language="english", target_line="The dog works here.",
    )

    assert result == (source, canonical, word_type)
    prompt, user_input = model.call_args.args
    assert rule in prompt
    assert "not its example sentence" in prompt
    assert "Target-language line context: The dog works here." in user_input
    assert "Return singular with article in both" not in prompt
    assert model.call_count == 2


@pytest.mark.parametrize("language", ["german", "spanish"])
@pytest.mark.parametrize("word_type", ["noun", "verb"])
def test_other_target_languages_keep_existing_rules(language, word_type):
    prompt = word_metadata._normalization_prompt_for_word_type(
        word_type, source_name="English", target_name=language, target_language=language,
    )
    expected = WORD_METADATA_RULE_PROMPTS[word_type].replace("{source_name}", "English").replace("{target_name}", language)
    assert expected in prompt
    assert "For English target_text" not in prompt


@pytest.mark.parametrize("word_type", ["adjective", "adverb", "expression", "helper", "other"])
def test_other_english_word_types_keep_existing_rules(word_type):
    prompt = word_metadata._normalization_prompt_for_word_type(
        word_type, source_name="Spanish", target_name="English", target_language="english",
    )
    assert WORD_METADATA_RULE_PROMPTS[word_type] in prompt


def test_keyword_extraction_uses_english_entry_rules_without_changing_sentence():
    model = Mock(return_value={"keywords": [
        {"source_text": "el perro", "target_text": "the dog", "word_type": "noun", "plural_target": "the dogs"},
        {"source_text": "trabajar", "target_text": "to work", "word_type": "verb"},
    ]})
    result = generate_keywords_for_phrase_with_chatgpt(
        "El perro trabaja.", "The dog works.", "spanish", "english", call_openai_json_fn=model,
    )
    _, user_input = model.call_args.args
    assert '"the" followed by the singular noun' in user_input
    assert '"to" followed by the infinitive' in user_input
    assert '"the" followed by the plural noun' in user_input
    assert "The dog works." in user_input
    assert [entry["german_text"] for entry in result] == ["the dog", "to work"]
    assert result[0]["plural_german"] == "the dogs"


def test_keyword_extraction_keeps_german_article_requirement():
    model = Mock(return_value={"keywords": []})
    generate_keywords_for_phrase_with_chatgpt(
        "El perro trabaja.", "Der Hund arbeitet.", call_openai_json_fn=model,
    )
    assert "include article and singular form" in model.call_args.args[1]
    assert "English target-language study-entry rules" not in model.call_args.args[1]
