import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient

from learning.models import ConversationFingerprint, DialogTurn, ExcludedWordSuggestion, Item, ItemQuestionExchange, SavedDialog, SavedTopic


@pytest.mark.django_db
def test_content_preview_returns_phrase_and_model_keywords(monkeypatch):
    from learning.views import content as content_views

    monkeypatch.setattr(
        content_views,
        "generate_content_with_chatgpt",
        lambda topic: (
            "Hoy estudio python para ciencia de datos.",
            "Heute lerne ich Python fuer Data Science.",
            [
                {"spanish_text": "python", "german_text": "das Python"},
                {"spanish_text": "ciencia", "german_text": "die Wissenschaft"},
                {"spanish_text": "datos", "german_text": "die Daten"},
            ],
        ),
    )

    Item.objects.create(item_type=Item.ItemType.WORD, spanish_text="python", german_text="das Python")

    client = APIClient()
    response = client.post("/api/content/preview", {"topic": "python para ciencia de datos"}, format="json")

    assert response.status_code == 200
    payload = response.json()
    assert "phrases" in payload
    assert payload["phrases"][0]["spanish_text"] == "Hoy estudio python para ciencia de datos."
    words = payload["words"]
    spanish_words = [word["spanish_text"].lower() for word in words]
    assert "python" in spanish_words
    assert "ciencia" in spanish_words
    assert "datos" in spanish_words
    python_word = next(word for word in words if word["spanish_text"].lower() == "python")
    assert python_word["exists"] is True


@pytest.mark.django_db
def test_content_confirm_creates_only_missing_items(monkeypatch):
    from learning.views import content as content_views

    monkeypatch.setattr(
        content_views,
        "generate_content_with_chatgpt",
        lambda topic: (
            "Hoy estudio python avanzado.",
            "Heute lerne ich fortgeschrittenes Python.",
            [
                {"spanish_text": "python", "german_text": "das Python"},
                {"spanish_text": "avanzado", "german_text": "der Fortschritt"},
            ],
        ),
    )
    monkeypatch.setattr(
        content_views,
        "create_audio_file",
        lambda text, prefix: f"http://localhost:8000/media/audio/{prefix}-mock.mp3",
    )

    Item.objects.create(item_type=Item.ItemType.WORD, spanish_text="python", german_text="das Python")

    client = APIClient()
    response = client.post(
        "/api/content/confirm",
        {"topic": "python avanzado", "selected_words": ["avanzado"]},
        format="json",
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["created_phrase"] is True
    assert "python" not in [word.lower() for word in payload["created_words"]]
    assert Item.objects.filter(item_type=Item.ItemType.PHRASE, spanish_text="Hoy estudio python avanzado.").exists()
    assert Item.objects.filter(
        item_type=Item.ItemType.WORD,
        spanish_text="avanzado",
        german_text="der Fortschritt",
    ).exists()
    assert (
        Item.objects.filter(
            item_type=Item.ItemType.PHRASE,
            spanish_text="Hoy estudio python avanzado.",
            audio_url="http://localhost:8000/media/audio/phrase-mock.mp3",
        ).exists()
        is True
    )
    assert (
        Item.objects.filter(
            item_type=Item.ItemType.WORD,
            spanish_text="avanzado",
            german_text="der Fortschritt",
            audio_url="http://localhost:8000/media/audio/word-mock.mp3",
        ).exists()
        is True
    )


@pytest.mark.django_db
def test_content_confirm_only_creates_selected_words(monkeypatch):
    from learning.views import content as content_views

    monkeypatch.setattr(
        content_views,
        "generate_content_with_chatgpt",
        lambda topic: (
            "Hoy estudio robotica aplicada avanzada.",
            "Heute lerne ich angewandte fortgeschrittene Robotik.",
            [
                {"spanish_text": "robotica", "german_text": "die Robotik"},
                {"spanish_text": "aplicada", "german_text": "die Anwendung"},
                {"spanish_text": "avanzada", "german_text": "der Fortschritt"},
            ],
        ),
    )
    monkeypatch.setattr(
        content_views,
        "create_audio_file",
        lambda text, prefix: f"http://localhost:8000/media/audio/{prefix}-mock.mp3",
    )

    client = APIClient()
    response = client.post(
        "/api/content/confirm",
        {"topic": "robotica aplicada avanzada", "selected_words": ["robotica", "avanzada"]},
        format="json",
    )

    assert response.status_code == 200
    payload = response.json()
    created_words = [word.lower() for word in payload["created_words"]]
    assert "robotica" in created_words
    assert "avanzada" in created_words
    assert "aplicada" not in created_words
    assert Item.objects.filter(item_type=Item.ItemType.WORD, spanish_text="aplicada").exists() is False


@pytest.mark.django_db
def test_unchecked_words_are_excluded_from_future_suggestions(monkeypatch):
    from learning.views import content as content_views

    monkeypatch.setattr(
        content_views,
        "generate_content_with_chatgpt",
        lambda topic: (
            "Hoy estudio robotica aplicada avanzada.",
            "Heute lerne ich angewandte fortgeschrittene Robotik.",
            [
                {"spanish_text": "robotica", "german_text": "die Robotik"},
                {"spanish_text": "aplicada", "german_text": "die Anwendung"},
                {"spanish_text": "avanzada", "german_text": "der Fortschritt"},
            ],
        ),
    )

    client = APIClient()
    response = client.post(
        "/api/content/confirm",
        {"topic": "robotica aplicada avanzada", "selected_words": ["robotica", "avanzada"]},
        format="json",
    )
    assert response.status_code == 200

    assert ExcludedWordSuggestion.objects.filter(
        spanish_text="aplicada",
        german_text="die anwendung",
    ).exists()

    preview_response = client.post(
        "/api/content/preview",
        {"topic": "robotica aplicada avanzada"},
        format="json",
    )
    assert preview_response.status_code == 200
    words = preview_response.json()["words"]
    preview_words = [word["spanish_text"].lower() for word in words]
    assert "aplicada" not in preview_words


@pytest.mark.django_db
def test_exclusion_requires_spanish_and_german_match(monkeypatch):
    from learning.views import content as content_views

    ExcludedWordSuggestion.objects.create(spanish_text="banco", german_text="das bankinstitut")

    monkeypatch.setattr(
        content_views,
        "generate_content_with_chatgpt",
        lambda topic: (
            "Hoy estudio en el banco del parque.",
            "Heute lerne ich auf der Parkbank.",
            [
                {"spanish_text": "banco", "german_text": "die Parkbank"},
                {"spanish_text": "parque", "german_text": "der Park"},
            ],
        ),
    )

    client = APIClient()
    response = client.post("/api/content/preview", {"topic": "parque"}, format="json")

    assert response.status_code == 200
    words = response.json()["words"]
    suggested_pairs = {(w["spanish_text"].lower(), w["german_text"].lower()) for w in words}
    assert ("banco", "die parkbank") in suggested_pairs


@pytest.mark.django_db
def test_content_preview_skips_keywords_without_german_article(monkeypatch):
    from learning.views import content as content_views

    monkeypatch.setattr(
        content_views,
        "generate_content_with_chatgpt",
        lambda topic: (
            "Hoy estudio ciencia y parque.",
            "Heute lerne ich Wissenschaft und Park.",
            [
                {"spanish_text": "ciencia", "german_text": "Wissenschaft"},
                {"spanish_text": "parque", "german_text": "der Park"},
            ],
        ),
    )

    client = APIClient()
    response = client.post("/api/content/preview", {"topic": "ciencia"}, format="json")

    assert response.status_code == 200
    words = response.json()["words"]
    spanish_words = [word["spanish_text"].lower() for word in words]
    assert "ciencia" not in spanish_words
    assert "parque" in spanish_words


@pytest.mark.django_db
def test_word_audio_includes_word_and_phrase(monkeypatch):
    from learning.views import content as content_views

    captured_audio_inputs: list[tuple[str, str]] = []

    monkeypatch.setattr(
        content_views,
        "generate_content_with_chatgpt",
        lambda topic: (
            "Hoy estudio parques urbanos.",
            "Heute lerne ich stadtische Parks.",
            [
                {"spanish_text": "parque", "german_text": "der Park"},
            ],
        ),
    )

    def fake_create_audio_file(text: str, prefix: str) -> str:
        captured_audio_inputs.append((prefix, text))
        return f"http://localhost:8000/media/audio/{prefix}-mock.mp3"

    monkeypatch.setattr(content_views, "create_audio_file", fake_create_audio_file)

    client = APIClient()
    response = client.post(
        "/api/content/confirm",
        {"topic": "parques urbanos", "selected_words": ["parque"]},
        format="json",
    )

    assert response.status_code == 200
    assert ("phrase", "Heute lerne ich stadtische Parks.") in captured_audio_inputs
    assert ("word", "der Park. Heute lerne ich stadtische Parks.") in captured_audio_inputs
    created_word = Item.objects.get(item_type=Item.ItemType.WORD, spanish_text="parque", german_text="der Park")
    assert created_word.notes == ""
    assert created_word.example_sentence == "Heute lerne ich stadtische Parks."


@pytest.mark.django_db
def test_content_confirm_saves_generated_exercise_phrases_for_word(monkeypatch):
    from learning.views import content as content_views

    monkeypatch.setattr(
        content_views,
        "generate_content_with_chatgpt",
        lambda topic: (
            "Hoy practico leer.",
            "Heute uebe ich lesen.",
            [
                {"spanish_text": "leer", "german_text": "lesen"},
            ],
        ),
    )
    monkeypatch.setattr(
        content_views,
        "generate_word_exercise_phrases_with_chatgpt",
        lambda spanish_word, german_word, **kwargs: {
            "first_section": [
                {"source_text": "Yo quiero leer.", "target_text": "Ich will lesen."},
                {"source_text": "Yo puedo leer.", "target_text": "Ich kann lesen."},
            ],
            "second_section": [
                {"source_text": "La lectura esta aqui.", "target_text": "Das Lesen ist hier."},
                {"source_text": "Yo veo la lectura.", "target_text": "Ich sehe das Lesen."},
            ],
        },
    )
    monkeypatch.setattr(
        content_views,
        "create_audio_file",
        lambda text, prefix: f"http://localhost:8000/media/audio/{prefix}-mock.mp3",
    )

    client = APIClient()
    response = client.post(
        "/api/content/confirm",
        {"topic": "leer", "selected_words": ["leer"]},
        format="json",
    )
    assert response.status_code == 200

    created_word = Item.objects.get(item_type=Item.ItemType.WORD, spanish_text="leer", german_text="lesen")
    assert created_word.exercise_phrases["first_section"][0]["target_text"] == "Ich will lesen."
    assert created_word.exercise_phrases["second_section"][1]["target_text"] == "Ich sehe das Lesen."


@pytest.mark.django_db
def test_content_confirm_saves_model_notes_when_present(monkeypatch):
    from learning.views import content as content_views

    monkeypatch.setattr(
        content_views,
        "generate_content_with_chatgpt",
        lambda topic: (
            "Hoy visito el parque.",
            "Heute besuche ich den Park.",
            "Useful phrase note from model.",
            [
                {
                    "spanish_text": "parque",
                    "german_text": "der Park",
                    "notes": "Masculine noun, plural: die Parks.",
                    "plural_german": "die Parks",
                },
            ],
        ),
    )
    monkeypatch.setattr(
        content_views,
        "create_audio_file",
        lambda text, prefix: f"http://localhost:8000/media/audio/{prefix}-mock.mp3",
    )

    client = APIClient()
    response = client.post(
        "/api/content/confirm",
        {"topic": "parque", "selected_words": ["parque"]},
        format="json",
    )

    assert response.status_code == 200
    phrase = Item.objects.get(item_type=Item.ItemType.PHRASE, spanish_text="Hoy visito el parque.")
    word = Item.objects.get(item_type=Item.ItemType.WORD, spanish_text="parque", german_text="der Park")
    assert phrase.notes == "Useful phrase note from model."
    assert word.notes == "Masculine noun, plural: die Parks."


@pytest.mark.django_db
def test_content_confirm_adds_plural_to_word_notes(monkeypatch):
    from learning.views import content as content_views

    monkeypatch.setattr(
        content_views,
        "generate_content_with_chatgpt",
        lambda topic: (
            "Hoy visito el jardin.",
            "Heute besuche ich den Garten.",
            "",
            [
                {
                    "spanish_text": "jardin",
                    "german_text": "der Garten",
                    "notes": "Common noun.",
                    "plural_german": "die Garten",
                },
            ],
        ),
    )
    monkeypatch.setattr(
        content_views,
        "create_audio_file",
        lambda text, prefix: f"http://localhost:8000/media/audio/{prefix}-mock.mp3",
    )

    client = APIClient()
    response = client.post(
        "/api/content/confirm",
        {"topic": "jardin", "selected_words": ["jardin"]},
        format="json",
    )

    assert response.status_code == 200
    word = Item.objects.get(item_type=Item.ItemType.WORD, spanish_text="jardin", german_text="der Garten")
    assert word.notes == "Common noun. Plural: die Garten"


@pytest.mark.django_db
def test_content_topics_endpoint_returns_recent_topics(monkeypatch):
    from learning.views import content as content_views

    monkeypatch.setattr(
        content_views,
        "generate_content_with_chatgpt",
        lambda topic: (
            f"Hoy estudio {topic}.",
            f"Heute lerne ich {topic}.",
            "",
            [],
        ),
    )
    monkeypatch.setattr(content_views, "generate_conversation_with_chatgpt", lambda topic: None)

    client = APIClient()
    preview_one = client.post("/api/content/preview", {"topic": "travel"}, format="json")
    preview_two = client.post("/api/content/preview", {"topic": "cooking"}, format="json")
    assert preview_one.status_code == 200
    assert preview_two.status_code == 200

    response = client.get("/api/content/topics")
    assert response.status_code == 200
    topics = response.json()["topics"]
    assert "travel" in topics
    assert "cooking" in topics


@pytest.mark.django_db
def test_content_topic_contexts_endpoint_returns_contexts_for_topic(monkeypatch):
    from learning.views import content as content_views

    monkeypatch.setattr(content_views, "generate_conversation_with_chatgpt", lambda topic, context="": None)
    monkeypatch.setattr(
        content_views,
        "generate_content_with_chatgpt",
        lambda topic, context="": (
            f"Hoy estudio {topic}.",
            f"Heute lerne ich {topic}.",
            "",
            [],
        ),
    )

    client = APIClient()
    response_one = client.post(
        "/api/content/preview",
        {"topic": "travel", "context": "at the airport"},
        format="json",
    )
    response_two = client.post(
        "/api/content/preview",
        {"topic": "travel", "context": "buying train tickets"},
        format="json",
    )
    assert response_one.status_code == 200
    assert response_two.status_code == 200

    contexts_response = client.get("/api/content/topic-contexts", {"topic": "travel"})
    assert contexts_response.status_code == 200
    contexts = contexts_response.json()["contexts"]
    assert "at the airport" in contexts
    assert "buying train tickets" in contexts


@pytest.mark.django_db
def test_content_topics_endpoint_isolated_by_language_pair(monkeypatch):
    from learning.views import content as content_views

    monkeypatch.setattr(content_views, "generate_conversation_with_chatgpt", lambda topic, context="": None)
    monkeypatch.setattr(
        content_views,
        "generate_content_with_chatgpt",
        lambda topic, context="": (
            f"Topic {topic}",
            f"Thema {topic}",
            "",
            [],
        ),
    )

    client = APIClient()
    response_es_de = client.post(
        "/api/content/preview",
        {"topic": "travel", "source_language": "spanish", "target_language": "german"},
        format="json",
    )
    response_en_fr = client.post(
        "/api/content/preview",
        {"topic": "meeting", "source_language": "english", "target_language": "french"},
        format="json",
    )
    assert response_es_de.status_code == 200
    assert response_en_fr.status_code == 200

    es_de_topics = client.get(
        "/api/content/topics",
        {"source_language": "spanish", "target_language": "german"},
    )
    en_fr_topics = client.get(
        "/api/content/topics",
        {"source_language": "english", "target_language": "french"},
    )
    assert es_de_topics.status_code == 200
    assert en_fr_topics.status_code == 200
    assert "travel" in es_de_topics.json()["topics"]
    assert "meeting" not in es_de_topics.json()["topics"]
    assert "meeting" in en_fr_topics.json()["topics"]
    assert "travel" not in en_fr_topics.json()["topics"]


@pytest.mark.django_db
def test_content_topic_contexts_endpoint_isolated_by_language_pair(monkeypatch):
    from learning.views import content as content_views

    monkeypatch.setattr(content_views, "generate_conversation_with_chatgpt", lambda topic, context="": None)
    monkeypatch.setattr(
        content_views,
        "generate_content_with_chatgpt",
        lambda topic, context="": (
            f"Topic {topic}",
            f"Thema {topic}",
            "",
            [],
        ),
    )

    client = APIClient()
    response_es_de = client.post(
        "/api/content/preview",
        {
            "topic": "travel",
            "context": "at the airport",
            "source_language": "spanish",
            "target_language": "german",
        },
        format="json",
    )
    response_en_fr = client.post(
        "/api/content/preview",
        {
            "topic": "travel",
            "context": "at the office",
            "source_language": "english",
            "target_language": "french",
        },
        format="json",
    )
    assert response_es_de.status_code == 200
    assert response_en_fr.status_code == 200

    contexts_es_de = client.get(
        "/api/content/topic-contexts",
        {"topic": "travel", "source_language": "spanish", "target_language": "german"},
    )
    contexts_en_fr = client.get(
        "/api/content/topic-contexts",
        {"topic": "travel", "source_language": "english", "target_language": "french"},
    )
    assert contexts_es_de.status_code == 200
    assert contexts_en_fr.status_code == 200
    assert "at the airport" in contexts_es_de.json()["contexts"]
    assert "at the office" not in contexts_es_de.json()["contexts"]
    assert "at the office" in contexts_en_fr.json()["contexts"]
    assert "at the airport" not in contexts_en_fr.json()["contexts"]


@pytest.mark.django_db
def test_content_confirm_creates_only_selected_phrases(monkeypatch):
    from learning.views import content as content_views

    monkeypatch.setattr(
        content_views,
        "generate_conversation_with_chatgpt",
        lambda topic, context="": [
            {"spanish_text": "Hola.", "german_text": "Hallo.", "notes": ""},
            {"spanish_text": "Como estas?", "german_text": "Wie geht's?", "notes": ""},
        ],
    )
    monkeypatch.setattr(content_views, "generate_keywords_for_phrase_with_chatgpt", lambda s, g: [])
    monkeypatch.setattr(
        content_views,
        "create_audio_file",
        lambda text, prefix: f"http://localhost:8000/media/audio/{prefix}-mock.mp3",
    )

    client = APIClient()
    response = client.post(
        "/api/content/confirm",
        {
            "topic": "greetings",
            "selected_phrases": ["hola.|||hallo."],
            "selected_words": [],
        },
        format="json",
    )
    assert response.status_code == 200

    assert Item.objects.filter(item_type=Item.ItemType.PHRASE, spanish_text="Hola.", german_text="Hallo.").exists()
    assert (
        Item.objects.filter(item_type=Item.ItemType.PHRASE, spanish_text="Como estas?", german_text="Wie geht's?").exists()
        is False
    )


@pytest.mark.django_db
def test_content_preview_skips_keywords_not_present_in_phrase(monkeypatch):
    from learning.views import content as content_views

    monkeypatch.setattr(
        content_views,
        "generate_conversation_with_chatgpt",
        lambda topic, context="": [
            {
                "spanish_text": "Hola, cuanto es en total?",
                "german_text": "Hallo, wie viel macht das insgesamt?",
                "notes": "",
            }
        ],
    )
    monkeypatch.setattr(
        content_views,
        "generate_keywords_for_phrase_with_chatgpt",
        lambda spanish_phrase, german_phrase: [
            {
                "spanish_text": "total",
                "german_text": "der Gesamtbetrag",
                "notes": "",
                "plural_german": "",
            }
        ],
    )

    client = APIClient()
    response = client.post("/api/content/preview", {"topic": "shopping"}, format="json")

    assert response.status_code == 200
    words = response.json()["words"]
    german_words = [word["german_text"] for word in words]
    assert "der Gesamtbetrag" not in german_words


@pytest.mark.django_db
def test_generate_conversation_retries_after_validation_failure(monkeypatch):
    from learning.views.content import generation

    ConversationFingerprint.objects.create(
        first_line="hola como estas",
        keywords="hola,estas",
        fingerprint="hola como estas || hola estas",
    )

    calls = []

    def fake_call_openai_json(system_prompt, user_input, timeout_seconds=10, **kwargs):
        calls.append((user_input, kwargs))
        if len(calls) == 1:
            return {
                "conversation": [
                    {"spanish_text": "Hola, ¿cómo estás?", "german_text": "Hallo, wie geht es dir?", "notes": ""},
                    {"spanish_text": "Hola, ¿cómo estás?", "german_text": "Hallo, wie geht es dir?", "notes": ""},
                    {"spanish_text": "Hola, ¿cómo estás?", "german_text": "Hallo, wie geht es dir?", "notes": ""},
                    {"spanish_text": "Hola, ¿cómo estás?", "german_text": "Hallo, wie geht es dir?", "notes": ""},
                    {"spanish_text": "Hola, ¿cómo estás?", "german_text": "Hallo, wie geht es dir?", "notes": ""},
                    {"spanish_text": "Hola, ¿cómo estás?", "german_text": "Hallo, wie geht es dir?", "notes": ""},
                ]
            }
        return {
            "conversation": [
                {"spanish_text": "Buenas, necesito pan.", "german_text": "Guten Tag, ich brauche Brot.", "notes": ""},
                {"spanish_text": "Claro, aqui tiene uno.", "german_text": "Klar, hier haben Sie eins.", "notes": ""},
                {"spanish_text": "Tambien quiero leche.", "german_text": "Ich moechte auch Milch.", "notes": ""},
                {"spanish_text": "Perfecto, algo mas?", "german_text": "Perfekt, noch etwas?", "notes": ""},
                {"spanish_text": "No, cuanto pago?", "german_text": "Nein, wie viel zahle ich?", "notes": ""},
                {"spanish_text": "Son cinco euros.", "german_text": "Das sind fuenf Euro.", "notes": ""},
            ]
        }

    monkeypatch.setattr(generation, "call_openai_json", fake_call_openai_json)
    monkeypatch.setattr(generation, "choice", lambda values: values[0])

    phrases = generation.generate_conversation_with_chatgpt("shopping", context="at a bakery")

    assert phrases is not None
    assert len(calls) == 2
    assert calls[0][1]["temperature"] == 0.9
    assert calls[0][1]["top_p"] == 0.9
    assert calls[0][1]["presence_penalty"] == 0.6
    assert "Style seed: casual" in calls[0][0]
    assert "Topic: shopping" in calls[0][0]
    assert "Context: at a bakery" in calls[0][0]
    assert "Situation detail: at a bakery" in calls[0][0]
    assert "hola como estas | hola estas" in calls[0][0]
    assert "Retry instruction: more variation, same topic and level" in calls[1][0]
    assert ConversationFingerprint.objects.count() == 2


@pytest.mark.django_db
def test_generate_conversation_prompt_includes_context_and_situation_when_missing(monkeypatch):
    from learning.views.content import generation

    captured = {}

    def fake_call_openai_json(system_prompt, user_input, timeout_seconds=10, **kwargs):
        captured["user_input"] = user_input
        return {
            "conversation": [
                {"spanish_text": "Busco un taxi.", "german_text": "Ich suche ein Taxi.", "notes": ""},
                {"spanish_text": "Hay uno afuera.", "german_text": "Draußen ist eins.", "notes": ""},
                {"spanish_text": "Gracias por la ayuda.", "german_text": "Danke fuer die Hilfe.", "notes": ""},
                {"spanish_text": "Con gusto.", "german_text": "Gern geschehen.", "notes": ""},
                {"spanish_text": "Hasta luego.", "german_text": "Bis spaeter.", "notes": ""},
                {"spanish_text": "Buen viaje.", "german_text": "Gute Reise.", "notes": ""},
            ]
        }

    monkeypatch.setattr(generation, "call_openai_json", fake_call_openai_json)
    monkeypatch.setattr(generation, "choice", lambda values: values[-1])

    phrases = generation.generate_conversation_with_chatgpt("transport", context="")

    assert phrases is not None
    assert "Topic: transport" in captured["user_input"]
    assert "Context: not provided" in captured["user_input"]
    assert "Situation detail: not provided" in captured["user_input"]
    assert "Style seed: small-talk" in captured["user_input"]


@pytest.mark.django_db
def test_content_confirm_uses_preview_phrases_when_regeneration_differs(monkeypatch):
    from learning.views import content as content_views

    call_count = {"value": 0}

    def fake_generate_conversation(topic, context="", **kwargs):
        call_count["value"] += 1
        if call_count["value"] == 1:
            return [
                {"spanish_text": "Quiero reservar una mesa.", "german_text": "Ich moechte einen Tisch reservieren.", "notes": ""}
            ]
        return [
            {"spanish_text": "Necesito un taxi.", "german_text": "Ich brauche ein Taxi.", "notes": ""}
        ]

    monkeypatch.setattr(content_views, "generate_conversation_with_chatgpt", fake_generate_conversation)
    monkeypatch.setattr(content_views, "generate_keywords_for_phrase_with_chatgpt", lambda s, g, **kwargs: [])
    monkeypatch.setattr(
        content_views,
        "create_audio_file",
        lambda text, prefix: f"http://localhost:8000/media/audio/{prefix}-mock.mp3",
    )

    client = APIClient()
    preview = client.post("/api/content/preview", {"topic": "restaurant"}, format="json")
    assert preview.status_code == 200
    preview_payload = preview.json()
    selected_key = preview_payload["phrases"][0]["selection_key"]

    confirm = client.post(
        "/api/content/confirm",
        {
            "topic": "restaurant",
            "selected_phrases": [selected_key],
            "selected_words": [],
            "preview_phrases": preview_payload["phrases"],
        },
        format="json",
    )
    assert confirm.status_code == 200
    assert confirm.json()["created_phrases_count"] == 1
    assert Item.objects.filter(
        item_type=Item.ItemType.PHRASE,
        spanish_text="Quiero reservar una mesa.",
        german_text="Ich moechte einen Tisch reservieren.",
    ).exists()


@pytest.mark.django_db
def test_content_confirm_uses_preview_words_when_regeneration_differs(monkeypatch):
    from learning.views import content as content_views

    call_count = {"value": 0}

    def fake_generate_conversation(topic, context="", **kwargs):
        return [
            {"spanish_text": "Necesito ayuda.", "german_text": "Ich brauche Hilfe.", "notes": ""},
        ]

    def fake_generate_keywords(spanish_phrase, german_phrase, **kwargs):
        call_count["value"] += 1
        if call_count["value"] == 1:
            return [
                {"spanish_text": "ayuda", "german_text": "die Hilfe", "notes": "", "plural_german": ""},
            ]
        return [
            {"spanish_text": "taxi", "german_text": "das Taxi", "notes": "", "plural_german": ""},
        ]

    monkeypatch.setattr(content_views, "generate_conversation_with_chatgpt", fake_generate_conversation)
    monkeypatch.setattr(content_views, "generate_keywords_for_phrase_with_chatgpt", fake_generate_keywords)
    monkeypatch.setattr(
        content_views,
        "create_audio_file",
        lambda text, prefix: f"http://localhost:8000/media/audio/{prefix}-mock.mp3",
    )

    client = APIClient()
    preview = client.post("/api/content/preview", {"topic": "help"}, format="json")
    assert preview.status_code == 200
    preview_payload = preview.json()
    selected_word_key = preview_payload["words"][0]["selection_key"]

    confirm = client.post(
        "/api/content/confirm",
        {
            "topic": "help",
            "selected_words": [selected_word_key],
            "preview_words": preview_payload["words"],
        },
        format="json",
    )
    assert confirm.status_code == 200
    assert confirm.json()["created_words_count"] == 1
    assert Item.objects.filter(
        item_type=Item.ItemType.WORD,
        spanish_text="ayuda",
        german_text="die Hilfe",
    ).exists()


@pytest.mark.django_db
def test_content_items_endpoint_lists_items_for_language_pair():
    first = Item.objects.create(
        item_type=Item.ItemType.WORD,
        spanish_text="hola",
        german_text="hallo",
        source_language="spanish",
        target_language="german",
    )
    Item.objects.create(
        item_type=Item.ItemType.WORD,
        spanish_text="hello",
        german_text="bonjour",
        source_language="english",
        target_language="french",
    )

    client = APIClient()
    response = client.get(
        "/api/content/items",
        {"source_language": "spanish", "target_language": "german"},
    )
    assert response.status_code == 200
    ids = [item["id"] for item in response.json()["items"]]
    assert first.id in ids
    assert len(ids) == 1


@pytest.mark.django_db
def test_content_item_delete_endpoint_removes_item_for_language_pair():
    removable = Item.objects.create(
        item_type=Item.ItemType.PHRASE,
        spanish_text="hola",
        german_text="hallo",
        source_language="spanish",
        target_language="german",
    )
    other_pair = Item.objects.create(
        item_type=Item.ItemType.PHRASE,
        spanish_text="hola",
        german_text="salut",
        source_language="spanish",
        target_language="french",
    )

    client = APIClient()
    response = client.delete(
        f"/api/content/items/{removable.id}",
        {"source_language": "spanish", "target_language": "german"},
        format="json",
    )
    assert response.status_code == 204
    assert Item.objects.filter(id=removable.id).exists() is False
    assert Item.objects.filter(id=other_pair.id).exists() is True


@pytest.mark.django_db
def test_content_item_mark_learned_endpoint_updates_item_for_language_pair():
    item = Item.objects.create(
        item_type=Item.ItemType.WORD,
        spanish_text="hola",
        german_text="hallo",
        source_language="spanish",
        target_language="german",
        is_learned=False,
    )

    client = APIClient()
    response = client.post(
        f"/api/content/items/{item.id}/mark-learned",
        {"source_language": "spanish", "target_language": "german"},
        format="json",
    )
    assert response.status_code == 200

    item.refresh_from_db()
    assert item.is_learned is True


@pytest.mark.django_db
def test_content_item_mark_learned_endpoint_can_unmark_item():
    item = Item.objects.create(
        item_type=Item.ItemType.WORD,
        spanish_text="hola",
        german_text="hallo",
        source_language="spanish",
        target_language="german",
        is_learned=True,
    )

    client = APIClient()
    response = client.post(
        f"/api/content/items/{item.id}/mark-learned",
        {"source_language": "spanish", "target_language": "german", "is_learned": False},
        format="json",
    )
    assert response.status_code == 200
    assert response.json()["is_learned"] is False

    item.refresh_from_db()
    assert item.is_learned is False


@pytest.mark.django_db
def test_content_topic_delete_endpoint_removes_topic_for_language_pair():
    SavedTopic.objects.create(topic="travel", source_language="spanish", target_language="german")
    SavedTopic.objects.create(topic="travel", source_language="english", target_language="french")

    client = APIClient()
    response = client.delete(
        "/api/content/topics/delete",
        {"topic": "travel", "source_language": "spanish", "target_language": "german"},
        format="json",
    )
    assert response.status_code == 204
    assert SavedTopic.objects.filter(topic="travel", source_language="spanish", target_language="german").exists() is False
    assert SavedTopic.objects.filter(topic="travel", source_language="english", target_language="french").exists() is True


@pytest.mark.django_db
def test_content_confirm_saves_dialog_and_returns_turns(monkeypatch):
    from learning.views import content as content_views

    monkeypatch.setattr(
        content_views,
        "generate_conversation_with_chatgpt",
        lambda topic, context="", **kwargs: [
            {"spanish_text": "Hola.", "german_text": "Hallo.", "notes": ""},
            {"spanish_text": "Necesito ayuda.", "german_text": "Ich brauche Hilfe.", "notes": ""},
        ],
    )
    monkeypatch.setattr(content_views, "generate_keywords_for_phrase_with_chatgpt", lambda s, g, **kwargs: [])
    monkeypatch.setattr(
        content_views,
        "create_audio_file",
        lambda text, prefix: f"http://localhost:8000/media/audio/{prefix}-mock.mp3",
    )

    client = APIClient()
    response = client.post(
        "/api/content/confirm",
        {"topic": "help", "selected_words": []},
        format="json",
    )
    assert response.status_code == 200

    payload = response.json()
    assert payload["dialog_audio_url"] == ""
    assert len(payload["saved_dialog_turns"]) == 2
    assert isinstance(payload["saved_dialog_id"], int)

    saved_dialog = SavedDialog.objects.get(id=payload["saved_dialog_id"])
    assert saved_dialog.topic == "help"
    assert len(saved_dialog.turns) == 2
    assert saved_dialog.audio_url == ""


@pytest.mark.django_db
def test_content_confirm_generates_dialog_audio_when_requested(monkeypatch):
    from learning.views import content as content_views

    captured_dialog_lines = []

    monkeypatch.setattr(
        content_views,
        "generate_conversation_with_chatgpt",
        lambda topic, context="", **kwargs: [
            {"spanish_text": "Buenos dias.", "german_text": "Guten Morgen.", "notes": ""},
            {"spanish_text": "Como estas?", "german_text": "Wie geht es dir?", "notes": ""},
        ],
    )
    monkeypatch.setattr(content_views, "generate_keywords_for_phrase_with_chatgpt", lambda s, g, **kwargs: [])
    monkeypatch.setattr(
        content_views,
        "create_audio_file",
        lambda text, prefix: f"http://localhost:8000/media/audio/{prefix}-mock.mp3",
    )

    def fake_dialog_audio(lines, target_language="german"):
        captured_dialog_lines.extend(lines)
        return "http://localhost:8000/media/audio/dialog-mock.wav"

    monkeypatch.setattr(content_views, "create_dialog_audio_file", fake_dialog_audio)

    client = APIClient()
    response = client.post(
        "/api/content/confirm",
        {"topic": "greetings", "selected_words": [], "create_dialog_audio": True},
        format="json",
    )
    assert response.status_code == 200

    payload = response.json()
    assert payload["dialog_audio_url"] == "http://localhost:8000/media/audio/dialog-mock.wav"
    assert captured_dialog_lines == ["Guten Morgen.", "Wie geht es dir?"]

    saved_dialog = SavedDialog.objects.get(id=payload["saved_dialog_id"])
    assert saved_dialog.audio_url == "http://localhost:8000/media/audio/dialog-mock.wav"


@pytest.mark.django_db
def test_content_words_endpoint_filters_and_returns_related_dialogs():
    word = Item.objects.create(
        item_type=Item.ItemType.WORD,
        spanish_text="taxi",
        german_text="das Taxi",
        source_language="spanish",
        target_language="german",
        example_sentence="Necesito un taxi.",
        notes="Transport word",
        audio_url="http://localhost:8000/media/audio/word-mock.mp3",
    )
    Item.objects.create(
        item_type=Item.ItemType.WORD,
        spanish_text="pan",
        german_text="das Brot",
        source_language="spanish",
        target_language="german",
    )
    dialog = SavedDialog.objects.create(
        topic="transport",
        context="airport",
        source_language="spanish",
        target_language="german",
        turns=[{"source_text": "Necesito un taxi.", "target_text": "Ich brauche ein Taxi."}],
        audio_url="http://localhost:8000/media/audio/dialog-mock.wav",
    )
    from learning.models import DialogTurn, ItemDialogOccurrence
    turn = DialogTurn.objects.create(dialog=dialog, turn_index=0, source_text="Necesito un taxi.", target_text="Ich brauche ein Taxi.")
    ItemDialogOccurrence.objects.create(
        item=word,
        dialog=dialog,
        turn=turn,
        turn_index=0,
        side=ItemDialogOccurrence.Side.SOURCE,
        match_score=0.75,
    )

    client = APIClient()
    response = client.get(
        "/api/content/words",
        {"source_language": "spanish", "target_language": "german", "q": "tax"},
    )
    assert response.status_code == 200
    payload = response.json()["words"]
    assert len(payload) == 1
    assert payload[0]["id"] == word.id
    assert payload[0]["related_dialogs"][0]["dialog_id"] == dialog.id


@pytest.mark.django_db
def test_content_item_regenerate_audio_updates_audio_url(monkeypatch):
    from learning.views import content as content_views

    item = Item.objects.create(
        item_type=Item.ItemType.WORD,
        spanish_text="taxi",
        german_text="das Taxi",
        source_language="spanish",
        target_language="german",
        example_sentence="Ich brauche ein Taxi.",
        audio_url="",
    )
    monkeypatch.setattr(
        content_views,
        "create_audio_file",
        lambda text, prefix, target_language="german": "http://localhost:8000/media/audio/word-regenerated.mp3",
    )

    client = APIClient()
    response = client.post(
        f"/api/content/items/{item.id}",
        {"source_language": "spanish", "target_language": "german"},
        format="json",
    )
    assert response.status_code == 200
    assert response.json()["audio_url"] == "http://localhost:8000/media/audio/word-regenerated.mp3"
    item.refresh_from_db()
    assert item.audio_url == "http://localhost:8000/media/audio/word-regenerated.mp3"


@pytest.mark.django_db
def test_content_item_question_saves_conversation(monkeypatch):
    from learning.views.content import management as management_views

    item = Item.objects.create(
        item_type=Item.ItemType.WORD,
        spanish_text="gracias",
        german_text="danke",
        source_language="spanish",
        target_language="german",
    )
    monkeypatch.setattr(
        management_views,
        "call_openai_json",
        lambda *args, **kwargs: {"related": True, "result_code": "RELATED_OK", "answer": "Use this for polite thanks."},
    )

    client = APIClient()
    response_one = client.post(
        f"/api/content/items/{item.id}/question?source_language=spanish&target_language=german",
        {"question_text": "Can you explain how to use danke politely?"},
        format="json",
    )
    response_two = client.post(
        f"/api/content/items/{item.id}/question?source_language=spanish&target_language=german",
        {"question_text": "Give me two more examples with danke."},
        format="json",
    )

    assert response_one.status_code == 201
    assert response_two.status_code == 201
    payload = response_two.json()
    assert len(payload["conversation"]) == 2
    assert payload["conversation"][0]["question_text"] == "Give me two more examples with danke."
    assert payload["conversation"][1]["question_text"] == "Can you explain how to use danke politely?"
    assert payload["exchange"]["answer_text"] == "Use this for polite thanks."
    assert ItemQuestionExchange.objects.filter(item=item).count() == 2

    detail = client.get(f"/api/content/items/{item.id}?source_language=spanish&target_language=german")
    assert detail.status_code == 200
    assert len(detail.json()["item_questions"]) == 2


@pytest.mark.django_db
def test_content_item_question_rejects_unrelated_questions(monkeypatch):
    from learning.views.content import management as management_views

    item = Item.objects.create(
        item_type=Item.ItemType.PHRASE,
        spanish_text="hola",
        german_text="hallo",
        source_language="spanish",
        target_language="german",
    )
    monkeypatch.setattr(
        management_views,
        "call_openai_json",
        lambda *args, **kwargs: {"related": False, "result_code": "UNRELATED_QUESTION", "answer": ""},
    )
    client = APIClient()
    response = client.post(
        f"/api/content/items/{item.id}/question?source_language=spanish&target_language=german",
        {"question_text": "Who won the world cup?"},
        format="json",
    )
    assert response.status_code == 400
    assert response.json()["code"] == "UNRELATED_QUESTION"
    assert ItemQuestionExchange.objects.filter(item=item).count() == 0


@pytest.mark.django_db
def test_quick_add_word_uses_contextual_translation_for_existing_item(monkeypatch):
    from learning.views.content import management as management_views

    existing = Item.objects.create(
        item_type=Item.ItemType.WORD,
        spanish_text="vuelta",
        german_text="runde",
        source_language="spanish",
        target_language="german",
    )
    dialog = SavedDialog.objects.create(
        topic="transporte",
        context="estacion",
        source_language="spanish",
        target_language="german",
        turns=[{"source_text": "Está justo a la vuelta de la esquina.", "target_text": "Es ist gleich um die Ecke."}],
    )
    DialogTurn.objects.create(
        dialog=dialog,
        turn_index=0,
        source_text="Está justo a la vuelta de la esquina.",
        target_text="Es ist gleich um die Ecke.",
    )
    monkeypatch.setattr(
        management_views,
        "call_openai_json",
        lambda *args, **kwargs: {"source_text": "vuelta", "target_text": "Runde"},
    )

    client = APIClient()
    response = client.post(
        "/api/content/words/add?source_language=spanish&target_language=german",
        {
            "source_text": "esquina",
            "target_text": "Runde",
            "dialog_id": dialog.id,
            "turn_index": 0,
            "check_only": True,
        },
        format="json",
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["exists"] is True
    assert payload["created"] is False
    assert payload["id"] == existing.id
    assert payload["source_text"] == "vuelta"
    assert payload["target_text"] == "Runde"


@pytest.mark.django_db
def test_quick_add_word_creates_item_with_contextual_translation(monkeypatch):
    from learning.views import content as content_views
    from learning.views.content import management as management_views

    dialog = SavedDialog.objects.create(
        topic="transporte",
        context="estacion",
        source_language="spanish",
        target_language="german",
        turns=[{"source_text": "Está justo a la vuelta de la esquina.", "target_text": "Es ist gleich um die Ecke."}],
    )
    DialogTurn.objects.create(
        dialog=dialog,
        turn_index=0,
        source_text="Está justo a la vuelta de la esquina.",
        target_text="Es ist gleich um die Ecke.",
    )
    monkeypatch.setattr(
        management_views,
        "call_openai_json",
        lambda *args, **kwargs: {"source_text": "esquina", "target_text": "Ecke"},
    )
    monkeypatch.setattr(
        content_views,
        "create_audio_file",
        lambda text, prefix, target_language="german": f"http://localhost:8000/media/audio/{prefix}-mock.mp3",
    )

    client = APIClient()
    response = client.post(
        "/api/content/words/add?source_language=spanish&target_language=german",
        {
            "source_text": "vuelta",
            "target_text": "Runde",
            "dialog_id": dialog.id,
            "turn_index": 0,
        },
        format="json",
    )

    assert response.status_code == 201
    payload = response.json()
    assert payload["created"] is True
    assert payload["exists"] is False
    assert payload["source_text"] == "esquina"
    assert payload["target_text"] == "Ecke"
    assert Item.objects.filter(
        item_type=Item.ItemType.WORD,
        spanish_text="esquina",
        german_text="Ecke",
        source_language="spanish",
        target_language="german",
    ).exists()


@pytest.mark.django_db
def test_quick_add_word_inline_context_fallback_avoids_target_language_source(monkeypatch):
    from learning.views.content import management as management_views

    monkeypatch.setattr(management_views, "call_openai_json", lambda *args, **kwargs: None)

    client = APIClient()
    response = client.post(
        "/api/content/words/add?source_language=spanish&target_language=german",
        {
            "source_text": "Ecke",
            "target_text": "Ecke",
            "check_only": True,
            "source_line": "Está justo a la vuelta de la esquina.",
            "target_line": "Es ist gleich um die Ecke.",
            "clicked_target_token": "Ecke",
        },
        format="json",
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["created"] is False
    assert payload["exists"] is False
    assert payload["source_text"] == "esquina"
    assert payload["target_text"] == "Ecke"


@pytest.mark.django_db
def test_quick_add_word_dialog_resolution_sanitizes_target_language_source(monkeypatch):
    from learning.views.content import management as management_views

    dialog = SavedDialog.objects.create(
        topic="transporte",
        context="estacion",
        source_language="spanish",
        target_language="german",
        turns=[{"source_text": "Está justo a la vuelta de la esquina.", "target_text": "Es ist gleich um die Ecke."}],
    )
    DialogTurn.objects.create(
        dialog=dialog,
        turn_index=0,
        source_text="Está justo a la vuelta de la esquina.",
        target_text="Es ist gleich um die Ecke.",
    )
    monkeypatch.setattr(
        management_views,
        "call_openai_json",
        lambda *args, **kwargs: {"source_text": "Ecke", "target_text": "Ecke"},
    )

    client = APIClient()
    response = client.post(
        "/api/content/words/add?source_language=spanish&target_language=german",
        {
            "source_text": "Ecke",
            "target_text": "Ecke",
            "dialog_id": dialog.id,
            "turn_index": 0,
            "check_only": True,
        },
        format="json",
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["created"] is False
    assert payload["exists"] is False
    assert payload["source_text"] == "esquina"
    assert payload["target_text"] == "Ecke"


@pytest.mark.django_db
def test_item_conversation_audio_returns_transcript_reply_and_audio(monkeypatch):
    from learning.views import content as content_views
    from learning.views.content import management as management_views

    item = Item.objects.create(
        item_type=Item.ItemType.WORD,
        spanish_text="taxi",
        german_text="das Taxi",
        source_language="spanish",
        target_language="german",
    )
    monkeypatch.setattr(
        management_views,
        "_openai_transcribe_audio_upload",
        lambda *args, **kwargs: "Ich brauche ein Taxi.",
    )
    monkeypatch.setattr(
        management_views,
        "call_openai_json",
        lambda *args, **kwargs: {
            "reply_text": "Sehr gut. Wohin moechtest du mit dem Taxi fahren?",
            "source_translation": "Muy bien. A donde quieres ir en taxi?",
            "user_source_translation": "Necesito un taxi.",
            "corrected_user_text": "Ich brauche ein Taxi.",
            "corrected_user_source_translation": "Necesito un taxi.",
            "corrected_user_explanation": "Usa 'brauche' para necesidad directa en este contexto.",
        },
    )
    monkeypatch.setattr(
        content_views,
        "create_audio_file",
        lambda text, prefix, target_language="german": "http://localhost:8000/media/audio/conversation-reply.mp3",
    )

    client = APIClient()
    response = client.post(
        f"/api/content/items/{item.id}/conversation?source_language=spanish&target_language=german",
        {
            "audio": SimpleUploadedFile("speech.webm", b"fake-audio-bytes", content_type="audio/webm"),
            "history": "[]",
        },
        format="multipart",
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["user_text"] == "Ich brauche ein Taxi."
    assert payload["user_translation_text"] == "Necesito un taxi."
    assert payload["user_corrected_text"] == "Ich brauche ein Taxi."
    assert payload["user_corrected_translation_text"] == "Necesito un taxi."
    assert payload["user_correction_explanation"] == "Usa 'brauche' para necesidad directa en este contexto."
    assert payload["assistant_text"] == "Sehr gut. Wohin moechtest du mit dem Taxi fahren?"
    assert payload["assistant_translation_text"] == "Muy bien. A donde quieres ir en taxi?"
    assert payload["assistant_audio_url"] == "http://localhost:8000/media/audio/conversation-reply.mp3"


@pytest.mark.django_db
def test_item_conversation_audio_requires_audio_file():
    item = Item.objects.create(
        item_type=Item.ItemType.WORD,
        spanish_text="taxi",
        german_text="das Taxi",
        source_language="spanish",
        target_language="german",
    )

    client = APIClient()
    response = client.post(
        f"/api/content/items/{item.id}/conversation?source_language=spanish&target_language=german",
        {"history": "[]"},
        format="multipart",
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "audio file is required"


@pytest.mark.django_db
def test_quick_add_phrase_creates_item(monkeypatch):
    from learning.views import content as content_views

    monkeypatch.setattr(
        content_views,
        "create_audio_file",
        lambda text, prefix, target_language="german": "http://localhost:8000/media/audio/phrase-from-conversation.mp3",
    )

    client = APIClient()
    response = client.post(
        "/api/content/phrases/add?source_language=spanish&target_language=german",
        {"source_text": "Necesito un taxi ahora.", "target_text": "Ich brauche jetzt ein Taxi."},
        format="json",
    )

    assert response.status_code == 201
    payload = response.json()
    assert payload["created"] is True
    assert payload["exists"] is False
    assert Item.objects.filter(
        item_type=Item.ItemType.PHRASE,
        spanish_text="Necesito un taxi ahora.",
        german_text="Ich brauche jetzt ein Taxi.",
        source_language="spanish",
        target_language="german",
    ).exists()


@pytest.mark.django_db
def test_quick_add_phrase_returns_existing():
    existing = Item.objects.create(
        item_type=Item.ItemType.PHRASE,
        spanish_text="Necesito un taxi ahora.",
        german_text="Ich brauche jetzt ein Taxi.",
        source_language="spanish",
        target_language="german",
    )
    client = APIClient()
    response = client.post(
        "/api/content/phrases/add?source_language=spanish&target_language=german",
        {"source_text": "Necesito un taxi ahora.", "target_text": "Ich brauche jetzt ein Taxi."},
        format="json",
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["created"] is False
    assert payload["exists"] is True
    assert payload["id"] == existing.id
