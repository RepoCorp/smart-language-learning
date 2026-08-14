import pytest
from rest_framework.test import APIClient

from learning.models import Item, ItemQuestionExchange


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
