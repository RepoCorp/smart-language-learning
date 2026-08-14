import pytest
from rest_framework.test import APIClient


def test_conversation_error_analysis_uses_json_mode_and_the_grammar_catalog(monkeypatch, settings):
    from learning.views.content import conversation_error_analysis

    settings.OPENAI_QUESTION_MODEL = "gpt-question-test"
    captured = {}

    def fake_call_openai_json_logged(**kwargs):
        captured.update(kwargs)
        return {"error_text": "- **Posición del verbo: enunciado**: el verbo debe ir en segunda posición."}

    monkeypatch.setattr(conversation_error_analysis, "call_openai_json_logged", fake_call_openai_json_logged)

    result = conversation_error_analysis.analyze_conversation_turn_error(
        original_text="Heute ich komme.",
        corrected_text="Heute komme ich.",
        source_language="spanish",
        target_language="german",
    )

    assert result.startswith("- **Posición del verbo: enunciado**")
    assert captured["json_mode"] is True
    assert "Title: Posición del verbo: enunciado" in captured["user_input"]
    assert "verb_position_main_clause" not in captured["user_input"]
    assert "Heute ich komme." in captured["user_input"]


def test_conversation_error_analysis_prompt_hides_the_incorrect_form():
    from learning.prompts import TOPIC_CONVERSATION_ERROR_ANALYSIS_PROMPT

    assert "Never quote, repeat, or display the learner's original incorrect wording." in TOPIC_CONVERSATION_ERROR_ANALYSIS_PROMPT
    assert "Any German text you show must be correct." in TOPIC_CONVERSATION_ERROR_ANALYSIS_PROMPT
    assert "Never display an incorrect form, including inside a comparison or quotation." in TOPIC_CONVERSATION_ERROR_ANALYSIS_PROMPT


@pytest.mark.django_db
def test_conversation_error_analysis_endpoint_returns_the_model_explanation(monkeypatch):
    from learning.views.content import management_topic_conversation_aux as aux_views

    monkeypatch.setattr(
        aux_views,
        "analyze_conversation_turn_error",
        lambda **kwargs: "- case: *mit* needs dative here.",
    )

    response = APIClient().post(
        "/api/content/conversation/error-analysis?source_language=english&target_language=german",
        {"original_text": "Ich gehe mit den Hund.", "corrected_text": "Ich gehe mit dem Hund."},
        format="json",
    )

    assert response.status_code == 200
    assert response.json() == {"error_text": "- case: *mit* needs dative here."}


@pytest.mark.django_db
def test_conversation_error_analysis_endpoint_requires_both_texts():
    response = APIClient().post(
        "/api/content/conversation/error-analysis",
        {"original_text": "Ich komme."},
        format="json",
    )

    assert response.status_code == 400
