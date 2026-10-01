from unittest.mock import Mock

import pytest
from rest_framework.test import APIClient

from learning.construction_patterns import CATALOGS
from learning.models import Item
from learning.views.content import dialog_click_resolution, management_items_quick_add as quick_add


CASES = [
    ("future_with_werden", "Er wird kommen.", "wird", ["wird", "kommen"]),
    ("conditional_with_wuerde", "Er würde kommen.", "würde", ["würde", "kommen"]),
    ("passive_with_werden", "Es wird gemacht.", "wird", ["wird", "gemacht"]),
    ("perfect_with_haben", "Ich habe gegessen.", "habe", ["habe", "gegessen"]),
    ("perfect_with_sein", "Ich bin gegangen.", "bin", ["bin", "gegangen"]),
]


def payload(key, evidence):
    return {
        "construction_pattern_key": key, "construction_evidence": evidence,
        "source_text": "Hablar de una acción", "target_text": "unused", "word_type": "helper",
        "note": "Aquí estas palabras muestran cuándo ocurre la acción.",
    }


def request(context, token, check_only=True, language="german"):
    return APIClient().post(
        f"/api/content/words/add?source_language=spanish&target_language={language}",
        {"source_text": token, "target_text": token, "target_line": context,
         "clicked_target_token": token, "check_only": check_only}, format="json",
    )


@pytest.fixture
def model(monkeypatch):
    mock = Mock()
    monkeypatch.setattr(dialog_click_resolution, "call_openai_json", mock)
    # Any accidental downstream metadata/audio generation fails the test.
    for name in ("_normalize_word_metadata", "create_word_if_missing", "ensure_audio_for_dialog_turn"):
        monkeypatch.setattr(quick_add, name, Mock(side_effect=AssertionError("Unexpected word pipeline")))
    return mock


@pytest.mark.django_db
@pytest.mark.parametrize("key,context,token,evidence", CASES)
def test_construction_preview_uses_one_call_and_saves_nothing(model, key, context, token, evidence):
    model.return_value = payload(key, evidence)
    response = request(context, token)
    assert response.status_code == 200
    result = response.json()
    assert result["item_type"] == "pattern"
    assert result["created"] is False and result["id"] is None
    preview = result["construction_pattern"]
    assert preview["save_token"] and preview["saved_id"] is None
    assert {key: value for key, value in preview.items() if key not in {"save_token", "saved_id"}} == {
        "key": key, "form": CATALOGS["german"][key]["form"],
        "meaning": model.return_value["source_text"], "explanation": model.return_value["note"],
        "example": context, "matched_parts": evidence, "replaces_word": True,
    }
    assert not Item.objects.exists()
    model.assert_called_once()
    prompt, user_input = model.call_args.args
    assert context in user_input and f"Clicked target word: {token}" in user_input
    for pattern in CATALOGS["german"]:
        assert pattern in user_input
    assert "not merely because it participates" in prompt


@pytest.mark.django_db
@pytest.mark.parametrize("key,context,token,evidence", CASES)
def test_construction_cannot_accidentally_be_saved_as_a_word(model, key, context, token, evidence):
    model.return_value = payload(key, evidence)
    assert request(context, token, check_only=False).status_code == 409
    assert not Item.objects.exists()


@pytest.mark.django_db
@pytest.mark.parametrize("change", [
    {"construction_pattern_key": "Future with werden"},
    {"construction_pattern_key": ["future_with_werden"]},
    {"construction_evidence": ["wird", "gehen"]},
    {"construction_evidence": ["Er", "kommen"]},
    {"construction_evidence": ["wird", "wird"]},
    {"construction_evidence": []},
    {"note": ""},
    {"source_text": None},
])
def test_invalid_model_output_is_not_guessed_or_saved(model, change):
    model.return_value = {**payload("future_with_werden", ["wird", "kommen"]), **change}
    assert request("Er wird kommen.", "wird").status_code == 503
    assert not Item.objects.exists()
    model.assert_called_once()


@pytest.mark.django_db
def test_missing_classification_is_an_error(model):
    model.return_value = {"source_text": "venir", "target_text": "kommen", "word_type": "verb"}
    assert request("Er wird kommen.", "kommen").status_code == 503


@pytest.mark.django_db
def test_other_language_cannot_use_german_catalog(model):
    model.return_value = payload("future_with_werden", ["will", "come"])
    assert request("He will come.", "will", language="english").status_code == 503
    assert "Available construction patterns: {}" in model.call_args.args[1]


@pytest.mark.django_db
@pytest.mark.parametrize("context,token,lemma,word_type", [
    ("Er wird kommen.", "kommen", "kommen", "verb"),
    ("Er wird müde.", "wird", "werden", "verb"),
    ("Ich habe Hunger.", "habe", "haben", "verb"),
    ("Ich bin müde.", "bin", "sein", "verb"),
    ("Das liegt auf dem Tisch.", "auf", "auf", "other"),
    ("Der Hund schläft.", "Hund", "der Hund", "noun"),
])
def test_no_pattern_preserves_normal_word_pipeline(model, monkeypatch, context, token, lemma, word_type):
    model.return_value = {
        "construction_pattern_key": None, "construction_evidence": [],
        "source_text": "significado", "target_text": lemma, "word_type": word_type, "note": "",
    }
    normalize = Mock(return_value=("significado", lemma, word_type))
    monkeypatch.setattr(quick_add, "_normalize_word_metadata", normalize)
    result = request(context, token)
    assert result.status_code == 200
    assert result.json()["target_text"] == lemma
    assert result.json()["word_type"] == word_type
    assert not result.json().get("construction_pattern")
    normalize.assert_called_once()
    model.assert_called_once()
    assert not Item.objects.exists()


@pytest.mark.django_db
@pytest.mark.parametrize("token", ["stehe", "auf"])
def test_separable_verb_keeps_complete_lexical_word(model, monkeypatch, token):
    model.return_value = {
        **payload("separable_verb", ["stehe", "auf"]),
        "target_text": "aufstehen", "source_text": "levantarse", "word_type": "verb",
    }
    monkeypatch.setattr(quick_add, "_normalize_word_metadata", Mock(return_value=("levantarse", "aufstehen", "verb")))
    preview = request("Ich stehe auf.", token).json()
    assert preview["target_text"] == "aufstehen"
    assert preview["construction_pattern"]["replaces_word"] is False
    assert not Item.objects.exists()

    def create(**kwargs):
        candidate = kwargs["candidate"]
        return Item.objects.create(item_type="word", word_type="verb",
                                   german_text=candidate.german_text, spanish_text=candidate.spanish_text)

    monkeypatch.setattr(quick_add, "create_word_if_missing", create)
    monkeypatch.setattr(quick_add, "ensure_audio_for_dialog_turn", Mock())
    saved = request("Ich stehe auf.", token, check_only=False)
    assert saved.status_code == 201
    assert Item.objects.get().german_text == "aufstehen"
    assert Item.objects.get().item_type == "word"
