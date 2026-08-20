import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from learning.models import Item, UserAuthToken


@pytest.mark.django_db
def test_admin_grammar_pool_processes_phrases_from_all_users(monkeypatch):
    from learning.views import grammar_pool

    user_model = get_user_model()
    admin = user_model.objects.create_superuser(username="admin", email="admin@example.com", password="1234")
    learner = user_model.objects.create_user(username="learner", email="learner@example.com", password="1234")
    admin_item = Item.objects.create(
        user=admin,
        item_type=Item.ItemType.PHRASE,
        spanish_text="Es una frase larga.",
        german_text="Das ist ein langer Satz.",
        source_language="spanish",
        target_language="german",
    )
    learner_item = Item.objects.create(
        user=learner,
        item_type=Item.ItemType.PHRASE,
        spanish_text="Hola.",
        german_text="Hallo.",
        source_language="spanish",
        target_language="german",
    )
    other_source_item = Item.objects.create(
        user=learner,
        item_type=Item.ItemType.PHRASE,
        spanish_text="Yes.",
        german_text="Ja.",
        source_language="english",
        target_language="german",
    )
    monkeypatch.setattr(grammar_pool, "analyze_phrase_grammar_features", lambda item: ["verb_position_main_clause"])

    token = UserAuthToken.objects.create(user=admin)
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token.key}")

    response = client.post(
        "/api/config/phrase-grammar-pool",
        {"source_language": "spanish", "target_language": "german"},
        format="json",
    )

    assert response.status_code == 200
    assert response.json()["item_id"] == other_source_item.id
    assert response.json()["item_id"] != admin_item.id
    assert response.json()["item_id"] != learner_item.id
