import pytest
from rest_framework.test import APIClient

from learning.grammar_features import ENGLISH_PHRASE_GRAMMAR_FEATURES
from learning.models import Item


@pytest.mark.django_db
def test_english_phrase_grammar_features_use_the_english_catalog(monkeypatch):
    from learning.views.content import management_items_phrase_grammar as phrase_grammar_views

    phrase = Item.objects.create(
        item_type=Item.ItemType.PHRASE,
        spanish_text="Ella toma cafe.",
        german_text="She drinks coffee.",
        source_language="spanish",
        target_language="english",
    )
    captured_prompts: list[str] = []

    def fake_call_openai_json_logged(**kwargs):
        captured_prompts.append(kwargs["system_prompt"])
        return list(ENGLISH_PHRASE_GRAMMAR_FEATURES)

    monkeypatch.setattr(phrase_grammar_views, "_call_openai_json_logged", fake_call_openai_json_logged)

    response = APIClient().post(
        f"/api/content/items/{phrase.id}/strategies/grammar-features?source_language=spanish&target_language=english",
        format="json",
    )

    assert response.status_code == 200
    assert response.json() == {"feature_keys": list(ENGLISH_PHRASE_GRAMMAR_FEATURES), "analyzed": True}
    assert "English sentences" in captured_prompts[0]
    assert "english_subject_verb_object" in captured_prompts[0]
    assert "verb_position_main_clause" not in captured_prompts[0]
