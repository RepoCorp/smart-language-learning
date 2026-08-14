import pytest
from rest_framework.test import APIClient

from learning.models import Item, ItemGrammarFeature


def test_conversation_error_analysis_uses_json_mode_and_the_grammar_catalog(monkeypatch, settings):
    from learning.views.content import conversation_error_analysis

    settings.OPENAI_QUESTION_MODEL = "gpt-question-test"
    captured = {}

    def fake_call_openai_json_logged(**kwargs):
        captured.update(kwargs)
        return {"errors": [{
            "explanation": "**Posición del verbo: enunciado**: el verbo va en segunda posición.",
            "grammar_feature_key": "verb_position_main_clause",
            "word_item_target": None,
        }]}

    monkeypatch.setattr(conversation_error_analysis, "call_openai_json_logged", fake_call_openai_json_logged)

    result = conversation_error_analysis.analyze_conversation_turn_error(
        original_text="Heute ich komme.",
        corrected_text="Heute komme ich.",
        source_language="spanish",
        target_language="german",
    )

    assert result["error_text"].startswith("- **Posición del verbo: enunciado**")
    assert result["grammar_feature_keys"] == ["verb_position_main_clause"]
    assert captured["json_mode"] is True
    assert "Title: Posición del verbo: enunciado" in captured["user_input"]
    assert "ID: verb_position_main_clause" in captured["user_input"]
    assert "Heute ich komme." in captured["user_input"]


def test_conversation_error_analysis_prompt_hides_the_incorrect_form():
    from learning.prompts import TOPIC_CONVERSATION_ERROR_ANALYSIS_PROMPT

    assert "Never quote, repeat, or display the learner's original incorrect wording." in TOPIC_CONVERSATION_ERROR_ANALYSIS_PROMPT
    assert "Any German text you show must be correct." in TOPIC_CONVERSATION_ERROR_ANALYSIS_PROMPT
    assert "Never display an incorrect form, including inside a comparison or quotation." in TOPIC_CONVERSATION_ERROR_ANALYSIS_PROMPT


def test_conversation_error_analysis_rejects_an_invalid_structured_feature_key(monkeypatch, settings):
    from learning.views.content import conversation_error_analysis

    settings.OPENAI_QUESTION_MODEL = "gpt-question-test"
    monkeypatch.setattr(
        conversation_error_analysis,
        "call_openai_json_logged",
        lambda **kwargs: {"errors": [{
            "explanation": "Usa el verbo en segunda posición.",
            "grammar_feature_key": "not_a_feature",
            "word_item_target": None,
        }]},
    )

    with pytest.raises(RuntimeError, match="Question model request failed"):
        conversation_error_analysis.analyze_conversation_turn_error(
            original_text="Heute ich komme.",
            corrected_text="Heute komme ich.",
            source_language="spanish",
            target_language="german",
        )


@pytest.mark.django_db
def test_conversation_error_analysis_endpoint_returns_the_model_explanation(monkeypatch):
    from learning.views.content import management_topic_conversation_aux as aux_views

    monkeypatch.setattr(
        aux_views,
        "analyze_conversation_turn_error",
        lambda **kwargs: {
            "error_text": "- **Dative preposition**: *mit* takes the dative.",
            "grammar_feature_keys": ["preposition_dative"],
            "word_item_targets": ["der Hund"],
        },
    )

    response = APIClient().post(
        "/api/content/conversation/error-analysis?source_language=english&target_language=german",
        {"original_text": "Ich gehe mit den Hund.", "corrected_text": "Ich gehe mit dem Hund."},
        format="json",
    )

    assert response.status_code == 200
    assert response.json() == {
        "error_text": "- **Dative preposition**: *mit* takes the dative.",
        "grammar_feature_keys": ["preposition_dative"],
        "word_item_targets": ["der Hund"],
    }


@pytest.mark.django_db
def test_conversation_error_analysis_endpoint_requires_both_texts():
    response = APIClient().post(
        "/api/content/conversation/error-analysis",
        {"original_text": "Ich komme."},
        format="json",
    )

    assert response.status_code == 400


@pytest.mark.django_db
def test_add_conversation_error_exercises_marks_the_shortest_phrase_and_matching_word_difficult():
    from learning.views.content.conversation_error_exercises import add_conversation_error_exercises

    shortest_phrase = Item.objects.create(
        item_type=Item.ItemType.PHRASE,
        spanish_text="Voy hoy.",
        german_text="Ich gehe heute.",
        source_language="spanish",
        target_language="german",
    )
    longer_phrase = Item.objects.create(
        item_type=Item.ItemType.PHRASE,
        spanish_text="Voy hoy al trabajo.",
        german_text="Ich gehe heute zur Arbeit.",
        source_language="spanish",
        target_language="german",
    )
    ItemGrammarFeature.objects.create(item=shortest_phrase, feature_key="verb_position_main_clause")
    ItemGrammarFeature.objects.create(item=longer_phrase, feature_key="verb_position_main_clause")
    word = Item.objects.create(
        item_type=Item.ItemType.WORD,
        spanish_text="perro",
        german_text="der Hund",
        source_language="spanish",
        target_language="german",
    )

    added_item_ids = add_conversation_error_exercises(
        user=None,
        source_language="spanish",
        target_language="german",
        grammar_feature_keys=["verb_position_main_clause"],
        word_item_targets=["Hund"],
    )

    shortest_phrase.refresh_from_db()
    longer_phrase.refresh_from_db()
    word.refresh_from_db()
    assert added_item_ids == [shortest_phrase.id, word.id]
    assert shortest_phrase.is_difficult is True
    assert shortest_phrase.difficult_marked_at is not None
    assert word.is_difficult is True
    assert longer_phrase.is_difficult is False
