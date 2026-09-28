from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from learning.models import Item, ItemGrammarFeature
from learning.views.content.conversation_error_exercises import add_conversation_error_exercises


@pytest.mark.django_db
def test_grammar_practice_keeps_only_requested_rules_through_session_and_reset():
    phrase = Item.objects.create(
        item_type="phrase", german_text="Ich muss gehen.", spanish_text="Tengo que ir.",
    )
    keys = ["verb_position_main_clause", "modal_verb_with_infinitive"]
    for key in [*keys, "time_expression_position"]:
        ItemGrammarFeature.objects.create(item=phrase, feature_key=key)
    word = Item.objects.create(item_type="word", german_text="gehen", spanish_text="ir")

    for key in [*keys, keys[0]]:
        add_conversation_error_exercises(
            user=None, source_language="spanish", target_language="german",
            grammar_feature_keys=[key], word_item_targets=["gehen"],
        )
    phrase.refresh_from_db()
    word.refresh_from_db()
    assert phrase.difficult_grammar_feature_keys == sorted(keys)
    assert word.difficult_grammar_feature_keys == []
    assert phrase.due_at_es_to_de is None
    assert phrase.due_at_de_to_es is None
    assert phrase.repetition_count == 0

    phrase.difficult_marked_at = timezone.now() - timedelta(days=1)
    phrase.save(update_fields=["difficult_marked_at"])
    client = APIClient()
    entries = client.get("/api/session", {"size": 10}).json()["items"]
    exercises = [entry for entry in entries if entry["id"] == phrase.id]
    assert [entry["repeatPracticeStep"] for entry in exercises] == [
        "phrase_progressive_blocks", "phrase_builder",
    ]
    for entry in exercises:
        response = client.get(f"/api/session/items/{phrase.id}", {
            "mode": "review", "direction": "es_to_de", "repeated_after_failure": "true",
            "repeat_practice_step": entry["repeatPracticeStep"],
        })
        assert response.status_code == 200
        payload = response.json()
        assert payload["practice_grammar_feature_keys"] == sorted(keys)
    state = payload["session_restore_state"]

    normal = client.get(f"/api/session/items/{phrase.id}", {
        "mode": "review", "direction": "es_to_de",
    })
    assert normal.json()["practice_grammar_feature_keys"] == []

    response = client.post("/api/difficult-items/complete", {"item_id": phrase.id}, format="json")
    assert response.status_code == 200
    phrase.refresh_from_db()
    assert phrase.difficult_grammar_feature_keys == []
    response = client.post("/api/session/restore-item-state", {
        "item_id": phrase.id, "state": state,
    }, format="json")
    assert response.status_code == 200
    phrase.refresh_from_db()
    assert phrase.difficult_grammar_feature_keys == sorted(keys)


@pytest.mark.django_db
def test_ordinary_difficult_phrase_does_not_get_rule_labels():
    phrase = Item.objects.create(
        item_type="phrase", german_text="Ich gehe.", spanish_text="Voy.",
        is_difficult=True, difficult_marked_at=timezone.now() - timedelta(days=1),
    )
    ItemGrammarFeature.objects.create(item=phrase, feature_key="verb_position_main_clause")
    response = APIClient().get(f"/api/session/items/{phrase.id}", {
        "mode": "review", "direction": "es_to_de", "repeated_after_failure": "true",
        "repeat_practice_step": "phrase_builder",
    })
    assert response.status_code == 200
    assert response.json()["practice_grammar_feature_keys"] == []
