import pytest
from rest_framework.test import APIClient

from learning.models import Item, ItemQuestionExchange


def test_grammar_question_guidance_uses_plain_language_without_extra_examples():
    from learning.views.content.item_questions import _question_model_user_input
    from learning.grammar_features import phrase_grammar_features_for_language

    item = Item(german_text="Ich muss arbeiten.", spanish_text="Tengo que trabajar.")
    user_input = _question_model_user_input(
        item=item,
        question_text="Explain this pattern",
        source_name="Spanish",
        target_name="German",
        target_language="german",
        history_text="",
        grammar_feature_key="modal_verb_with_infinitive",
    )

    assert "Grammar feature ID: modal_verb_with_infinitive" in user_input
    definition = phrase_grammar_features_for_language("german")["modal_verb_with_infinitive"]
    assert f"Grammar feature definition: {definition}" in user_input
    assert "Use natural, everyday language" in user_input
    assert "Do not assume the learner knows grammar terminology" in user_input
    assert "two or three clear sentences" in user_input
    assert "Do not provide any additional examples" in user_input
    assert "Do not list exceptions" in user_input
    assert "Start with the simplest general rule" not in user_input


def test_regular_item_question_does_not_receive_rule_specific_guidance():
    from learning.views.content.item_questions import _question_model_user_input

    user_input = _question_model_user_input(
        item=Item(german_text="der Hund", spanish_text="el perro"),
        question_text="What does this mean?",
        source_name="Spanish",
        target_name="German",
        target_language="german",
        history_text="",
    )

    assert "Private grammar-answer guidance" not in user_input


@pytest.mark.django_db
def test_grammar_question_uses_json_mode_and_is_saved_as_grammar_explanation(monkeypatch, settings):
    from learning.views.content import item_questions as item_question_views

    item = Item.objects.create(
        item_type=Item.ItemType.PHRASE,
        spanish_text="Salgo enseguida.",
        german_text="Ich fahre gleich ab.",
        source_language="spanish",
        target_language="german",
    )
    settings.OPENAI_QUESTION_MODEL = "gpt-question-test"
    captured = {}

    def fake_call_openai_json(*args, **kwargs):
        captured.update(kwargs)
        captured["user_input"] = args[1]
        return {"related": True, "result_code": "RELATED_OK", "answer": "Es un verbo separable."}

    monkeypatch.setattr(item_question_views, "call_openai_json", fake_call_openai_json)

    response = APIClient().post(
        f"/api/content/items/{item.id}/question?source_language=spanish&target_language=german",
        {
            "question_text": "¿Cómo se aplica este verbo separable?",
            "grammar_feature_key": "separable_verb_main_clause",
        },
        format="json",
    )

    assert response.status_code == 201
    assert captured["json_mode"] is True
    assert "Grammar feature ID: separable_verb_main_clause" in captured["user_input"]
    assert ItemQuestionExchange.objects.get(item=item).question_type == ItemQuestionExchange.QuestionType.GRAMMAR_EXPLANATION
