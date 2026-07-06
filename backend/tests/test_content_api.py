import json

import pytest
from rest_framework.test import APIClient

from learning.models import DialogTurn, Item, ItemDialogOccurrence, ItemQuestionExchange, SavedDialog, SavedTopic


def _patch_dialog_click_call(monkeypatch, fake_call_openai_json) -> None:
    from learning.views.content import dialog_click_resolution

    monkeypatch.setattr(dialog_click_resolution, "call_openai_json", fake_call_openai_json)


def _patch_word_metadata_call(monkeypatch, fake_call_openai_json) -> None:
    from learning.views.content import word_metadata

    monkeypatch.setattr(word_metadata, "call_openai_json", fake_call_openai_json)


def test_tts_instruction_forces_target_language_pronunciation():
    from learning.views.content.audio import _tts_language_instruction

    instruction = _tts_language_instruction("german")

    assert "Speak only in German" in instruction
    assert "German phonetics and accent" in instruction
    assert "looks like English" in instruction
    assert "still pronounce it as German text" in instruction
    assert "infer an English pronunciation" in instruction


def test_elevenlabs_item_audio_is_used_when_configured(monkeypatch, settings):
    from learning.views.content import audio as content_audio

    captured_calls = []
    settings.AUDIO_TTS_PROVIDER = "elevenlabs"
    settings.ELEVENLABS_GERMAN_PHRASE_VOICE_IDS = "leipzig-phrase-a,leipzig-phrase-b"

    def fake_elevenlabs_audio(**kwargs):
        captured_calls.append(kwargs)
        return b"audio-bytes"

    monkeypatch.setattr(content_audio, "_elevenlabs_tts_audio", fake_elevenlabs_audio)
    monkeypatch.setattr(content_audio, "_deterministic_index", lambda seed, count: 1)

    audio_bytes, voice = content_audio._item_tts_audio_bytes(
        text="Guten Morgen.",
        prefix="phrase",
        target_language="german",
        default_speed=1.25,
    )

    assert audio_bytes == b"audio-bytes"
    assert voice == "elevenlabs:leipzig-phrase-b"
    assert captured_calls == [
        {
            "text": "Guten Morgen.",
            "voice_id": "leipzig-phrase-b",
            "target_language": "german",
            "output_format": "mp3_44100_128",
        }
    ]


def test_elevenlabs_item_audio_falls_back_to_openai_without_audio(monkeypatch, settings):
    from learning.views.content import audio as content_audio

    settings.AUDIO_TTS_PROVIDER = "elevenlabs"
    settings.ELEVENLABS_VOICE_ID = "leipzig-default"
    monkeypatch.setattr(content_audio, "_elevenlabs_tts_audio", lambda **kwargs: None)
    monkeypatch.setattr(content_audio, "_openai_tts_audio", lambda **kwargs: b"openai-audio")

    audio_bytes, voice = content_audio._item_tts_audio_bytes(
        text="Guten Morgen.",
        prefix="phrase",
        target_language="german",
        default_speed=1.25,
    )

    assert audio_bytes == b"openai-audio"
    assert voice == "openai:onyx"


def test_elevenlabs_dialog_speaker_voices_use_configured_voice_ids(monkeypatch, settings):
    from learning.views.content import audio as content_audio

    settings.AUDIO_TTS_PROVIDER = "elevenlabs"
    settings.ELEVENLABS_GERMAN_DIALOG_VOICE_IDS = "voice-a, voice-b"

    voice_ids = content_audio.select_dialog_speaker_voice_ids("german")

    assert voice_ids is not None
    assert set(voice_ids) == {"voice-a", "voice-b"}


def test_elevenlabs_dialog_speaker_voices_can_use_general_voice_pool(monkeypatch, settings):
    from learning.views.content import audio as content_audio

    settings.AUDIO_TTS_PROVIDER = "elevenlabs"
    settings.ELEVENLABS_DIALOG_VOICE_IDS = ""
    settings.ELEVENLABS_GERMAN_DIALOG_VOICE_IDS = ""
    settings.ELEVENLABS_GERMAN_VOICE_IDS = "voice-a, voice-b, voice-c"

    voice_ids = content_audio.select_dialog_speaker_voice_ids("german")

    assert voice_ids is not None
    assert len(set(voice_ids)) == 2
    assert set(voice_ids).issubset({"voice-a", "voice-b", "voice-c"})


def test_dialog_speaker_voice_ids_are_stable_for_seed(settings):
    from learning.views.content import audio as content_audio

    settings.AUDIO_TTS_PROVIDER = "elevenlabs"
    settings.ELEVENLABS_GERMAN_DIALOG_VOICE_IDS = "voice-a,voice-b,voice-c"

    first = content_audio.select_dialog_speaker_voice_ids("german", seed="dialog:42")
    second = content_audio.select_dialog_speaker_voice_ids("german", seed="dialog:42")
    third = content_audio.select_dialog_speaker_voice_ids("german", seed="dialog:99")

    assert first == second
    assert first is not None
    assert len(set(first)) == 2
    assert third is not None


@pytest.mark.django_db
def test_ensure_dialog_turn_audio_reuses_stable_dialog_speaker_voice(monkeypatch, settings):
    from learning.views.content import dialog_item_context

    settings.AUDIO_TTS_PROVIDER = "elevenlabs"
    dialog = SavedDialog.objects.create(
        topic="greetings",
        context="",
        source_language="spanish",
        target_language="german",
        turns=[
            {"source_text": "Hola.", "target_text": "Hallo.", "speaker": "a"},
            {"source_text": "Bien.", "target_text": "Gut.", "speaker": "b"},
        ],
    )
    first_turn = DialogTurn.objects.create(
        dialog=dialog,
        turn_index=0,
        source_text="Hola.",
        target_text="Hallo.",
        audio_url="",
    )

    monkeypatch.setattr(dialog_item_context, "select_dialog_speaker_voice_ids", lambda target_language, seed="": ("voice-a", "voice-b"))
    captured_calls = []

    def fake_create_audio_file(text, prefix, target_language="german", voice_id=""):
        captured_calls.append((text, prefix, target_language, voice_id))
        return "audio://voice-a/hallo"

    monkeypatch.setattr(dialog_item_context, "create_audio_file", fake_create_audio_file)

    audio_url = dialog_item_context.ensure_audio_for_dialog_turn(user=None, dialog_id_raw=dialog.id, turn_index_raw=0)

    assert audio_url == "audio://voice-a/hallo"
    first_turn.refresh_from_db()
    assert first_turn.audio_url == "audio://voice-a/hallo"
    assert captured_calls == [("Hallo.", "phrase", "german", "voice-a")]


@pytest.mark.django_db
def test_dialog_turn_audio_reuses_dialog_speaker_voices(monkeypatch, settings):
    from learning.views.content import persistence as content_persistence

    captured_calls = []
    settings.AUDIO_TTS_PROVIDER = "elevenlabs"
    dialog = SavedDialog.objects.create(
        topic="greetings",
        context="",
        source_language="spanish",
        target_language="german",
        turns=[],
    )

    def fake_create_audio_file(text, prefix, target_language="german", voice_id=""):
        captured_calls.append((text, prefix, target_language, voice_id))
        return f"audio://{voice_id}/{text}"

    monkeypatch.setattr(content_persistence, "create_audio_file", fake_create_audio_file)

    content_persistence.save_dialog_turns(
        dialog,
        [
            {"source_text": "Hola.", "target_text": "Hallo."},
            {"source_text": "Como estas?", "target_text": "Wie geht es dir?"},
            {"source_text": "Bien.", "target_text": "Gut."},
        ],
        speaker_voice_ids=("voice-a", "voice-b"),
    )

    assert captured_calls == [
        ("Hallo.", "phrase", "german", "voice-a"),
        ("Wie geht es dir?", "phrase", "german", "voice-b"),
        ("Gut.", "phrase", "german", "voice-a"),
    ]


def test_elevenlabs_voice_pool_reads_language_specific_env(monkeypatch, settings):
    from learning.views.content import audio as content_audio

    monkeypatch.delenv("ELEVENLABS_VOICE_IDS", raising=False)
    monkeypatch.setenv("ELEVENLABS_GERMAN_PHRASE_VOICE_IDS", "env-voice-a, env-voice-b")
    if hasattr(settings, "ELEVENLABS_GERMAN_PHRASE_VOICE_IDS"):
        delattr(settings, "ELEVENLABS_GERMAN_PHRASE_VOICE_IDS")

    voice_ids = content_audio._elevenlabs_voice_ids(target_language="german", kind="phrase")

    assert voice_ids == ["env-voice-a", "env-voice-b"]


def test_basic_word_metadata_prompt_requires_noun_articles_in_both_languages(monkeypatch):
    from learning.views.content import word_metadata

    captured_prompts = []

    def fake_call_openai_json(system_prompt, user_input, **kwargs):
        captured_prompts.append(system_prompt)
        if "return the clicked word's contextual translation and word type" in system_prompt:
            return {"source_text": "recibo", "target_text": "Kassenbon", "word_type": "noun"}
        if "Normalize a noun study entry" in system_prompt:
            return {"source_text": "el recibo", "target_text": "der Kassenbon"}
        return None

    _patch_word_metadata_call(monkeypatch, fake_call_openai_json)

    source_text, target_text, word_type = word_metadata.basic_word_metadata(
        source_text="recibo",
        target_text="der Kassenbon",
        source_language="spanish",
        target_language="german",
    )

    assert (source_text, target_text, word_type) == ("el recibo", "der Kassenbon", "noun")


def test_basic_word_metadata_refines_expression_beyond_single_word(monkeypatch):
    from learning.views.content import word_metadata

    captured_prompts = []

    def fake_call_openai_json(system_prompt, user_input, **kwargs):
        captured_prompts.append(system_prompt)
        if "return the clicked word's contextual translation and word type" in system_prompt:
            return {"source_text": "opinar", "target_text": "hältst", "word_type": "expression"}
        if "Refine a clicked target-language expression study item" in system_prompt:
            return {
                "source_text": "opinar sobre algo",
                "target_text": "von etwas halten",
                "note": "The clicked word alone is misleading here.",
            }
        if "Normalize a expression study entry" in system_prompt:
            return {"source_text": "opinar sobre algo", "target_text": "von etwas halten"}
        return None

    _patch_word_metadata_call(monkeypatch, fake_call_openai_json)
    _patch_dialog_click_call(monkeypatch, fake_call_openai_json)

    source_text, target_text, word_type = word_metadata.basic_word_metadata(
        source_text="hältst",
        target_text="hältst",
        source_language="spanish",
        target_language="german",
        source_line="¿Qué opinas de la serie?",
        target_line="Was hältst du von der Serie?",
    )

    assert (source_text, target_text, word_type) == ("opinar sobre algo", "von etwas halten", "expression")
    assert any("return the clicked word's contextual translation and word type" in prompt for prompt in captured_prompts)
    assert any("Refine a clicked target-language expression study item" in prompt for prompt in captured_prompts)
    assert any("Normalize a expression study entry" in prompt for prompt in captured_prompts)


@pytest.mark.django_db
def test_content_preview_returns_generated_dialog_turns(monkeypatch):
    from learning.views.content import api as api_views

    def fake_generate_conversation(topic, context="", conversation_details="", **kwargs):
        return [
            {"speaker": "a", "spanish_text": "Hoy estudio python.", "german_text": "Heute lerne ich Python.", "notes": ""},
            {"speaker": "b", "spanish_text": "Uso datos simples.", "german_text": "Ich benutze einfache Daten.", "notes": ""},
        ]

    monkeypatch.setattr(api_views, "generate_conversation_with_chatgpt", fake_generate_conversation)

    client = APIClient()
    response = client.post("/api/content/preview", {"topic": "python para ciencia de datos"}, format="json")

    assert response.status_code == 200
    payload = response.json()
    assert payload["topic"] == "python para ciencia de datos"
    assert payload["dialog_turns"] == [
        {"source_text": "Hoy estudio python.", "target_text": "Heute lerne ich Python.", "speaker": "a"},
        {"source_text": "Uso datos simples.", "target_text": "Ich benutze einfache Daten.", "speaker": "b"},
    ]


@pytest.mark.django_db
def test_content_preview_passes_short_three_dialog_length(monkeypatch):
    from learning.views.content import api as api_views

    captured = {}

    def fake_generate_conversation(topic, context="", conversation_details="", dialog_length="standard", **kwargs):
        captured["dialog_length"] = dialog_length
        return [
            {"speaker": "a", "spanish_text": "Hola.", "german_text": "Hallo.", "notes": ""},
            {"speaker": "b", "spanish_text": "Necesito pan.", "german_text": "Ich brauche Brot.", "notes": ""},
            {"speaker": "a", "spanish_text": "Gracias.", "german_text": "Danke.", "notes": ""},
        ]

    monkeypatch.setattr(api_views, "generate_conversation_with_chatgpt", fake_generate_conversation)

    client = APIClient()
    response = client.post(
        "/api/content/preview",
        {"topic": "shopping", "dialog_length": "short_three"},
        format="json",
    )

    assert response.status_code == 200
    assert captured["dialog_length"] == "short_three"
    assert len(response.json()["dialog_turns"]) == 3


@pytest.mark.django_db
def test_content_preview_passes_required_dialog_words(monkeypatch):
    from learning.views.content import api as api_views

    captured = {}

    def fake_generate_conversation(
        topic,
        context="",
        conversation_details="",
        required_words="",
        required_words_language="target",
        **kwargs,
    ):
        captured["required_words"] = required_words
        captured["required_words_language"] = required_words_language
        return [
            {"speaker": "a", "spanish_text": "Necesito pan.", "german_text": "Ich brauche Brot.", "notes": ""},
            {"speaker": "b", "spanish_text": "Puede pagar ahora.", "german_text": "Sie koennen jetzt bezahlen.", "notes": ""},
        ]

    monkeypatch.setattr(api_views, "generate_conversation_with_chatgpt", fake_generate_conversation)

    client = APIClient()
    response = client.post(
        "/api/content/preview",
        {"topic": "shopping", "required_words": "Brot, bezahlen", "required_words_language": "target"},
        format="json",
    )

    assert response.status_code == 200
    assert captured["required_words"] == "Brot, bezahlen"
    assert captured["required_words_language"] == "target"


@pytest.mark.django_db
def test_create_word_if_missing_saves_word_type(monkeypatch):
    from learning.views.content import persistence
    from learning.views.content.types import ContentCandidate

    monkeypatch.setattr(
        persistence,
        "create_audio_file",
        lambda text, prefix, target_language="german": f"http://localhost:8000/media/audio/{prefix}-mock.mp3",
    )

    word = persistence.create_word_if_missing(
        user=None,
        candidate=ContentCandidate(
            spanish_text="leer",
            german_text="lesen",
            exists=False,
            word_type="verb",
        ),
        topic="verbs",
    )

    assert word is not None
    assert word.word_type == "verb"


@pytest.mark.django_db
def test_create_word_if_missing_treats_word_type_as_identity(monkeypatch):
    from learning.views.content import persistence
    from learning.views.content.types import ContentCandidate

    monkeypatch.setattr(
        persistence,
        "create_audio_file",
        lambda text, prefix, target_language="german": f"http://localhost:8000/media/audio/{prefix}-mock.mp3",
    )

    noun = persistence.create_word_if_missing(
        user=None,
        candidate=ContentCandidate(
            spanish_text="la ayuda",
            german_text="die Hilfe",
            exists=False,
            word_type="noun",
        ),
        topic="identity",
    )
    verb = persistence.create_word_if_missing(
        user=None,
        candidate=ContentCandidate(
            spanish_text="la ayuda",
            german_text="die Hilfe",
            exists=False,
            word_type="verb",
        ),
        topic="identity",
    )
    duplicate_noun = persistence.create_word_if_missing(
        user=None,
        candidate=ContentCandidate(
            spanish_text="la ayuda",
            german_text="die Hilfe",
            exists=False,
            word_type="noun",
        ),
        topic="identity",
    )

    assert noun is not None
    assert verb is not None
    assert duplicate_noun is None
    assert Item.objects.filter(
        item_type=Item.ItemType.WORD,
        spanish_text="la ayuda",
        german_text="die Hilfe",
    ).count() == 2


def test_word_selection_key_includes_word_type():
    from learning.views.content.selection import word_selection_id
    from learning.views.content.types import ContentCandidate

    noun_key = word_selection_id(
        ContentCandidate(spanish_text="la ayuda", german_text="die Hilfe", exists=False, word_type="noun")
    )
    verb_key = word_selection_id(
        ContentCandidate(spanish_text="la ayuda", german_text="die Hilfe", exists=False, word_type="verb")
    )

    assert noun_key != verb_key


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
def test_generate_conversation_retries_after_validation_failure(monkeypatch):
    from learning.views.content import generation

    calls = []

    def fake_call_openai_json(system_prompt, user_input, timeout_seconds=10, **kwargs):
        calls.append((user_input, kwargs))
        if len(calls) == 1:
            return {
                "scenarios": [
                    "Comprar pan en una panaderia local.",
                    "Pedir ayuda para encontrar una tienda.",
                    "Preguntar el precio en una caja.",
                    "Reservar una mesa sencilla.",
                    "Comprar un billete de transporte.",
                ]
            }
        return {
            "conversation": [
                {"speaker": "a", "source_text": "Buenas, necesito pan.", "target_text": "Guten Tag, ich brauche Brot.", "notes": ""},
                {"speaker": "b", "source_text": "Claro, aqui tiene uno.", "target_text": "Klar, hier haben Sie eins.", "notes": ""},
                {"speaker": "a", "source_text": "Tambien quiero leche.", "target_text": "Ich moechte auch Milch.", "notes": ""},
                {"speaker": "b", "source_text": "Perfecto, algo mas?", "target_text": "Perfekt, noch etwas?", "notes": ""},
                {"speaker": "a", "source_text": "No, cuanto pago?", "target_text": "Nein, wie viel zahle ich?", "notes": ""},
                {"speaker": "b", "source_text": "Son cinco euros.", "target_text": "Das sind fuenf Euro.", "notes": ""},
            ]
        }

    monkeypatch.setattr(generation, "call_openai_json", fake_call_openai_json)
    monkeypatch.setattr(generation, "choice", lambda values: values[0])

    phrases = generation.generate_conversation_with_chatgpt("shopping", context="at a bakery")

    assert phrases is not None
    assert len(calls) == 2
    assert calls[0][1]["temperature"] == 0.8
    assert calls[0][1]["top_p"] == 1.0
    assert calls[0][1]["presence_penalty"] == 0.2
    assert calls[1][1]["temperature"] == 0.75
    assert "Style seed: casual" in calls[1][0]
    assert "Topic: shopping" in calls[1][0]
    assert "Context: at a bakery" in calls[1][0]
    assert "Situation detail: at a bakery" in calls[1][0]
    assert "Selected scenario: Comprar pan en una panaderia local." in calls[1][0]


@pytest.mark.django_db
def test_generate_conversation_prompt_includes_context_and_situation_when_missing(monkeypatch):
    from learning.views.content import generation

    captured = {}

    def fake_call_openai_json(system_prompt, user_input, timeout_seconds=10, **kwargs):
        captured["user_input"] = user_input
        if "Create five distinct conversation scenarios" in system_prompt:
            return {
                "scenarios": [
                    "Buscar un taxi cerca de una estacion.",
                    "Comprar un billete en una maquina.",
                    "Pedir indicaciones a una persona.",
                    "Avisar que el tren llega tarde.",
                    "Confirmar una direccion antes de salir.",
                ]
            }
        return {
            "conversation": [
                {"speaker": "a", "source_text": "Busco un taxi.", "target_text": "Ich suche ein Taxi.", "notes": ""},
                {"speaker": "b", "source_text": "Hay uno afuera.", "target_text": "Draußen ist eins.", "notes": ""},
                {"speaker": "a", "source_text": "Gracias por la ayuda.", "target_text": "Danke fuer die Hilfe.", "notes": ""},
                {"speaker": "b", "source_text": "Con gusto.", "target_text": "Gern geschehen.", "notes": ""},
                {"speaker": "a", "source_text": "Hasta luego.", "target_text": "Bis spaeter.", "notes": ""},
                {"speaker": "b", "source_text": "Buen viaje.", "target_text": "Gute Reise.", "notes": ""},
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
def test_generate_conversation_prompt_can_request_short_three_phrase_dialog(monkeypatch):
    from learning.views.content import generation

    captured = {}

    def fake_call_openai_json(system_prompt, user_input, timeout_seconds=10, **kwargs):
        captured.setdefault("prompts", []).append(user_input)
        if "Create five distinct conversation scenarios" in system_prompt:
            return {
                "scenarios": [
                    "Comprar pan rapidamente.",
                    "Pedir cafe para llevar.",
                    "Pagar en la caja.",
                    "Preguntar por una mesa.",
                    "Saludar a un vecino.",
                ]
            }
        return {
            "conversation": [
                {"speaker": "a", "source_text": "Necesito pan.", "target_text": "Ich brauche Brot.", "notes": ""},
                {"speaker": "b", "source_text": "Aqui tiene.", "target_text": "Hier bitte.", "notes": ""},
                {"speaker": "a", "source_text": "Gracias.", "target_text": "Danke.", "notes": ""},
            ]
        }

    monkeypatch.setattr(generation, "call_openai_json", fake_call_openai_json)
    monkeypatch.setattr(generation, "choice", lambda values: values[0])

    phrases = generation.generate_conversation_with_chatgpt("shopping", dialog_length="short_three")

    assert phrases is not None
    assert len(phrases) == 3
    assert "Length requirement: Exactly 3 very short dialogue turns/phrases total." in captured["prompts"][1]


@pytest.mark.django_db
def test_generate_conversation_prompt_includes_required_dialog_words(monkeypatch):
    from learning.views.content import generation

    captured = {}

    def fake_call_openai_json(system_prompt, user_input, timeout_seconds=10, **kwargs):
        captured.setdefault("prompts", []).append(user_input)
        if "Create five distinct conversation scenarios" in system_prompt:
            return {
                "scenarios": [
                    "Comprar pan rapidamente.",
                    "Pedir cafe para llevar.",
                    "Pagar en la caja.",
                    "Preguntar por una mesa.",
                    "Saludar a un vecino.",
                ]
            }
        return {
            "conversation": [
                {"speaker": "a", "source_text": "Necesito pan.", "target_text": "Ich brauche Brot.", "notes": ""},
                {"speaker": "b", "source_text": "Puede pagar ahora.", "target_text": "Sie koennen jetzt bezahlen.", "notes": ""},
            ]
        }

    monkeypatch.setattr(generation, "call_openai_json", fake_call_openai_json)
    monkeypatch.setattr(generation, "choice", lambda values: values[0])

    phrases = generation.generate_conversation_with_chatgpt("shopping", required_words="Brot, bezahlen")

    assert phrases is not None
    assert "Required target-language words/phrases for final dialog: Brot; bezahlen" in captured["prompts"][0]
    assert "Required German words/phrases: Brot; bezahlen." in captured["prompts"][1]
    assert "Include every listed item in target_text at least once" in captured["prompts"][1]


@pytest.mark.django_db
def test_generate_conversation_translates_source_required_words_before_prompt(monkeypatch):
    from learning.views.content import generation

    captured = {}

    def fake_call_openai_json(system_prompt, user_input, timeout_seconds=10, **kwargs):
        captured.setdefault("calls", []).append((system_prompt, user_input))
        if "Translate required language-learning vocabulary" in system_prompt:
            return {"target_words": ["das Brot", "bezahlen"]}
        if "Create five distinct conversation scenarios" in system_prompt:
            return {
                "scenarios": [
                    "Comprar pan rapidamente.",
                    "Pedir cafe para llevar.",
                    "Pagar en la caja.",
                    "Preguntar por una mesa.",
                    "Saludar a un vecino.",
                ]
            }
        return {
            "conversation": [
                {"speaker": "a", "source_text": "Necesito pan.", "target_text": "Ich brauche das Brot.", "notes": ""},
                {"speaker": "b", "source_text": "Puede pagar ahora.", "target_text": "Sie koennen jetzt bezahlen.", "notes": ""},
            ]
        }

    monkeypatch.setattr(generation, "call_openai_json", fake_call_openai_json)
    monkeypatch.setattr(generation, "choice", lambda values: values[0])

    phrases = generation.generate_conversation_with_chatgpt(
        "shopping",
        required_words="pan, pagar",
        required_words_language="source",
    )

    assert phrases is not None
    assert len(captured["calls"]) == 3
    assert "Source words/phrases: pan; pagar" in captured["calls"][0][1]
    assert "Required target-language words/phrases for final dialog: das Brot; bezahlen" in captured["calls"][1][1]
    assert "Required German words/phrases: das Brot; bezahlen." in captured["calls"][2][1]
    assert "pan, pagar" not in captured["calls"][2][1]


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
def test_content_item_refresh_word_scans_dialogs_adds_type_and_regenerates_exercises(monkeypatch):
    from learning.views.content import management_items_listing as listing_views

    item = Item.objects.create(
        item_type=Item.ItemType.WORD,
        spanish_text="ayudar",
        german_text="helfen",
        source_language="spanish",
        target_language="german",
        word_type="",
        exercise_phrases={},
    )
    first_dialog = SavedDialog.objects.create(
        topic="help",
        context="station",
        source_language="spanish",
        target_language="german",
        turns=[{"source_text": "Quiero ayudar.", "target_text": "Ich will helfen."}],
    )
    first_turn = DialogTurn.objects.create(
        dialog=first_dialog,
        turn_index=0,
        source_text="Quiero ayudar.",
        target_text="Ich will helfen.",
    )
    second_dialog = SavedDialog.objects.create(
        topic="work",
        context="office",
        source_language="spanish",
        target_language="german",
        turns=[{"source_text": "Puedo ayudar hoy.", "target_text": "Ich kann heute helfen."}],
    )
    DialogTurn.objects.create(
        dialog=second_dialog,
        turn_index=0,
        source_text="Puedo ayudar hoy.",
        target_text="Ich kann heute helfen.",
    )
    ItemDialogOccurrence.objects.create(
        item=item,
        dialog=first_dialog,
        turn=first_turn,
        turn_index=0,
        side=ItemDialogOccurrence.Side.TARGET,
        match_score=0.8,
    )

    monkeypatch.setattr(
        listing_views,
        "_basic_word_metadata",
        lambda **kwargs: ("ayudar", "helfen", "verb"),
    )
    monkeypatch.setattr(
        listing_views,
        "generate_word_exercise_phrases_with_chatgpt",
        lambda *args, **kwargs: {
            "phrases": [
                {"label": "present-1s", "source_text": "Yo ayudo.", "target_text": "Ich helfe."},
            ],
            "generation_mode": "verb_by_tense_v1",
        },
    )

    client = APIClient()
    response = client.post(
        f"/api/content/items/{item.id}/refresh-word?source_language=spanish&target_language=german",
        format="json",
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["word_type"] == "verb"
    assert payload["word_type_added"] is True
    assert payload["dialog_occurrences_created"] == 3
    assert payload["exercise_phrases"]["phrases"][0]["target_text"] == "Ich helfe."
    assert len(payload["related_dialogs"]) == 2

    item.refresh_from_db()
    assert item.word_type == "verb"
    assert item.exercise_phrases["generation_mode"] == "verb_by_tense_v1"
    assert ItemDialogOccurrence.objects.filter(item=item).count() == 4


@pytest.mark.django_db
def test_content_item_refresh_word_adds_missing_articles_for_noun(monkeypatch):
    from learning.views.content import management_items_listing as listing_views

    item = Item.objects.create(
        item_type=Item.ItemType.WORD,
        spanish_text="libro",
        german_text="Buch",
        source_language="spanish",
        target_language="german",
        word_type="noun",
        exercise_phrases={},
    )
    captured_args = {}

    monkeypatch.setattr(
        listing_views,
        "_basic_word_metadata",
        lambda **kwargs: ("el libro", "das Buch", "noun"),
    )

    def fake_generate(spanish_word, german_word, **kwargs):
        captured_args["spanish_word"] = spanish_word
        captured_args["german_word"] = german_word
        captured_args["word_type"] = kwargs.get("word_type")
        return {
            "phrases": [
                {"label": "example", "source_text": "Leo el libro.", "target_text": "Ich lese das Buch."},
            ],
        }

    monkeypatch.setattr(listing_views, "generate_word_exercise_phrases_with_chatgpt", fake_generate)

    client = APIClient()
    response = client.post(
        f"/api/content/items/{item.id}/refresh-word?source_language=spanish&target_language=german",
        format="json",
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["spanish_text"] == "el libro"
    assert payload["german_text"] == "das Buch"
    assert payload["word_type"] == "noun"
    assert payload["word_text_updated"] is True
    assert captured_args == {
        "spanish_word": "el libro",
        "german_word": "das Buch",
        "word_type": "noun",
    }

    item.refresh_from_db()
    assert item.spanish_text == "el libro"
    assert item.german_text == "das Buch"


@pytest.mark.django_db
def test_content_item_refresh_word_always_refreshes_metadata_using_target_token_and_context(monkeypatch):
    from learning.views.content import management_items_listing as listing_views

    item = Item.objects.create(
        item_type=Item.ItemType.WORD,
        spanish_text="el libro",
        german_text="das Buch",
        source_language="spanish",
        target_language="german",
        word_type="noun",
        example_sentence="Ich lese das Buch jeden Abend.",
        exercise_phrases={},
    )
    captured_metadata_kwargs = {}

    def fake_basic_word_metadata(**kwargs):
        captured_metadata_kwargs.update(kwargs)
        return ("el libro", "das Buch", "noun")

    monkeypatch.setattr(listing_views, "_basic_word_metadata", fake_basic_word_metadata)
    monkeypatch.setattr(
        listing_views,
        "generate_word_exercise_phrases_with_chatgpt",
        lambda *args, **kwargs: {
            "phrases": [
                {"label": "example", "source_text": "Leo el libro.", "target_text": "Ich lese das Buch."},
            ],
        },
    )

    client = APIClient()
    response = client.post(
        f"/api/content/items/{item.id}/refresh-word?source_language=spanish&target_language=german",
        format="json",
    )

    assert response.status_code == 200
    assert captured_metadata_kwargs["source_text"] == ""
    assert captured_metadata_kwargs["target_text"] == "Buch"
    assert captured_metadata_kwargs["source_line"] == ""
    assert captured_metadata_kwargs["target_line"] == "Ich lese das Buch jeden Abend."


@pytest.mark.django_db
def test_content_item_refresh_word_uses_dedicated_refresh_model(monkeypatch, settings):
    from learning.views.content import management_items_listing as listing_views

    settings.OPENAI_WORD_REFRESH_MODEL = "gpt-refresh-test"
    settings.OPENAI_WORD_REFRESH_REASONING_EFFORT = "high"
    item = Item.objects.create(
        item_type=Item.ItemType.WORD,
        spanish_text="ayudar",
        german_text="helfen",
        source_language="spanish",
        target_language="german",
        word_type="",
        exercise_phrases={},
    )
    captured_metadata_model = {}
    captured_exercise_model = {}

    def fake_basic_word_metadata(**kwargs):
        captured_metadata_model["model"] = kwargs.get("model")
        captured_metadata_model["reasoning_effort"] = kwargs.get("reasoning_effort")
        return ("ayudar", "helfen", "verb")

    def fake_generate(spanish_word, german_word, **kwargs):
        captured_exercise_model["model"] = kwargs.get("model")
        captured_exercise_model["reasoning_effort"] = kwargs.get("reasoning_effort")
        return {
            "phrases": [
                {"label": "present-1s", "source_text": "Yo ayudo.", "target_text": "Ich helfe."},
            ],
        }

    monkeypatch.setattr(listing_views, "_basic_word_metadata", fake_basic_word_metadata)
    monkeypatch.setattr(listing_views, "generate_word_exercise_phrases_with_chatgpt", fake_generate)

    client = APIClient()
    response = client.post(
        f"/api/content/items/{item.id}/refresh-word?source_language=spanish&target_language=german",
        format="json",
    )

    assert response.status_code == 200
    assert captured_metadata_model["model"] == "gpt-refresh-test"
    assert captured_metadata_model["reasoning_effort"] == "high"
    assert captured_exercise_model["model"] == "gpt-refresh-test"
    assert captured_exercise_model["reasoning_effort"] == "high"


@pytest.mark.django_db
def test_content_item_refresh_word_replaces_existing_type_with_regenerated_type(monkeypatch):
    from learning.views.content import management_items_listing as listing_views

    item = Item.objects.create(
        item_type=Item.ItemType.WORD,
        spanish_text="ayudar",
        german_text="helfen",
        source_language="spanish",
        target_language="german",
        word_type="noun",
        exercise_phrases={},
    )

    monkeypatch.setattr(
        listing_views,
        "_basic_word_metadata",
        lambda **kwargs: ("ayudar", "helfen", "verb"),
    )
    monkeypatch.setattr(
        listing_views,
        "generate_word_exercise_phrases_with_chatgpt",
        lambda *args, **kwargs: {
            "phrases": [
                {"label": "present-1s", "source_text": "Yo ayudo.", "target_text": "Ich helfe."},
            ],
        },
    )

    client = APIClient()
    response = client.post(
        f"/api/content/items/{item.id}/refresh-word?source_language=spanish&target_language=german",
        format="json",
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["word_type"] == "verb"
    assert payload["word_type_added"] is False

    item.refresh_from_db()
    assert item.word_type == "verb"


def test_call_openai_json_includes_reasoning_effort(monkeypatch, settings):
    from learning.views.content import generation

    settings.OPENAI_API_KEY = "test-key"
    captured = {}

    class FakeResponse:
        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        def read(self):
            return b'{"choices":[{"message":{"content":"{\\"ok\\": true}"}}]}'

    def fake_urlopen(request, timeout=0):
        captured["timeout"] = timeout
        captured["body"] = json.loads(request.data.decode("utf-8"))
        return FakeResponse()

    monkeypatch.setattr(generation, "urlopen", fake_urlopen)

    parsed = generation.call_openai_json(
        "system",
        "user",
        model="gpt-test",
        reasoning_effort="high",
    )

    assert parsed == {"ok": True}
    assert captured["body"]["model"] == "gpt-test"
    assert captured["body"]["reasoning_effort"] == "high"


@pytest.mark.django_db
def test_content_item_refresh_word_fails_when_required_source_article_is_missing(monkeypatch):
    from learning.views.content import management_items_listing as listing_views

    item = Item.objects.create(
        item_type=Item.ItemType.WORD,
        spanish_text="grupo",
        german_text="Gruppe",
        source_language="spanish",
        target_language="german",
        word_type="noun",
        exercise_phrases={},
    )

    monkeypatch.setattr(
        listing_views,
        "_basic_word_metadata",
        lambda **kwargs: ("grupo", "die Gruppe", "noun"),
    )
    monkeypatch.setattr(
        listing_views,
        "generate_word_exercise_phrases_with_chatgpt",
        lambda *args, **kwargs: {
            "phrases": [
                {"label": "example", "source_text": "El grupo llega.", "target_text": "Die Gruppe kommt."},
            ],
        },
    )

    client = APIClient()
    response = client.post(
        f"/api/content/items/{item.id}/refresh-word?source_language=spanish&target_language=german",
        format="json",
    )

    assert response.status_code == 503
    assert response.json()["detail"] == "Word metadata is missing source article"

    item.refresh_from_db()
    assert item.spanish_text == "grupo"
    assert item.german_text == "Gruppe"


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
        {
            "topic": "help",
            "selected_words": [],
            "dialog_turns": [
                {"source_text": "Hola.", "target_text": "Hallo.", "speaker": "a"},
                {"source_text": "Necesito ayuda.", "target_text": "Ich brauche Hilfe.", "speaker": "b"},
            ],
        },
        format="json",
    )
    assert response.status_code == 200

    payload = response.json()
    assert "dialog_audio_url" not in payload
    assert len(payload["saved_dialog_turns"]) == 2
    assert isinstance(payload["saved_dialog_id"], int)

    saved_dialog = SavedDialog.objects.get(id=payload["saved_dialog_id"])
    assert saved_dialog.topic == "help"
    assert len(saved_dialog.turns) == 2
    assert saved_dialog.audio_url == ""


@pytest.mark.django_db
def test_content_confirm_ignores_full_dialog_audio_and_reuses_speaker_voices(monkeypatch):
    from learning.views.content import api as content_api_views
    from learning.views.content import persistence as content_persistence

    captured_audio_calls = []
    monkeypatch.setattr(
        content_persistence,
        "create_audio_file",
        lambda text, prefix, **kwargs: captured_audio_calls.append((text, prefix, kwargs)) or f"http://localhost:8000/media/audio/{prefix}-mock.mp3",
    )
    monkeypatch.setattr(
        content_api_views,
        "select_dialog_speaker_voice_ids",
        lambda target_language, seed="": ("voice-a", "voice-b"),
    )

    client = APIClient()
    response = client.post(
        "/api/content/confirm",
        {
            "topic": "greetings",
            "selected_words": [],
            "create_dialog_audio": True,
            "dialog_turns": [
                {"source_text": "Buenos dias.", "target_text": "Guten Morgen.", "speaker": "a"},
                {"source_text": "Como estas?", "target_text": "Wie geht es dir?", "speaker": "b"},
            ],
            "selected_turn_indexes": [],
        },
        format="json",
    )
    assert response.status_code == 200

    payload = response.json()
    assert "dialog_audio_url" not in payload
    assert captured_audio_calls == [
        ("Guten Morgen.", "phrase", {"target_language": "german", "voice_id": "voice-a"}),
        ("Wie geht es dir?", "phrase", {"target_language": "german", "voice_id": "voice-b"}),
    ]

    saved_dialog = SavedDialog.objects.get(id=payload["saved_dialog_id"])
    assert saved_dialog.audio_url == ""


@pytest.mark.django_db
def test_content_confirm_saves_dialog_turns_as_phrase_items(monkeypatch):
    from learning.views.content import persistence as content_persistence

    monkeypatch.setattr(
        content_persistence,
        "create_audio_file",
        lambda text, prefix, **kwargs: "",
    )

    client = APIClient()
    response = client.post(
        "/api/content/confirm",
        {
            "topic": "shopping",
            "dialog_turns": [
                {"source_text": "Busco arroz integral.", "target_text": "Ich suche Vollkornreis."},
                {"source_text": "Esta en el pasillo dos.", "target_text": "Er ist in Gang zwei."},
            ],
        },
        format="json",
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["created_sentence_count"] == 2
    assert payload["existing_sentence_count"] == 0

    assert Item.objects.filter(
        item_type=Item.ItemType.PHRASE,
        spanish_text="Busco arroz integral.",
        german_text="Ich suche Vollkornreis.",
        source_language="spanish",
        target_language="german",
    ).exists()
    assert Item.objects.filter(
        item_type=Item.ItemType.PHRASE,
        spanish_text="Esta en el pasillo dos.",
        german_text="Er ist in Gang zwei.",
        source_language="spanish",
        target_language="german",
    ).exists()


@pytest.mark.django_db
def test_content_confirm_creates_phrase_items_only_for_selected_turn_indexes(monkeypatch):
    from learning.views.content import persistence as content_persistence

    monkeypatch.setattr(
        content_persistence,
        "create_audio_file",
        lambda text, prefix, **kwargs: "",
    )

    client = APIClient()
    response = client.post(
        "/api/content/confirm",
        {
            "topic": "shopping",
            "dialog_turns": [
                {"source_text": "Busco arroz integral.", "target_text": "Ich suche Vollkornreis."},
                {"source_text": "Esta en el pasillo dos.", "target_text": "Er ist in Gang zwei."},
            ],
            "selected_turn_indexes": [1],
        },
        format="json",
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["created_sentence_count"] == 1
    assert payload["existing_sentence_count"] == 0

    assert Item.objects.filter(
        item_type=Item.ItemType.PHRASE,
        spanish_text="Busco arroz integral.",
        german_text="Ich suche Vollkornreis.",
        source_language="spanish",
        target_language="german",
    ).exists() is False
    assert Item.objects.filter(
        item_type=Item.ItemType.PHRASE,
        spanish_text="Esta en el pasillo dos.",
        german_text="Er ist in Gang zwei.",
        source_language="spanish",
        target_language="german",
    ).exists()


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
    from learning.views.content import management_items_listing as listing_views

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
        listing_views,
        "create_audio_file",
        lambda text, prefix, **kwargs: "http://localhost:8000/media/audio/word-regenerated.mp3",
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
def test_content_dialog_regenerate_audio_updates_turn_audio_urls(monkeypatch):
    from learning.views.content import management_dialogs_listing as dialog_listing_views

    dialog = SavedDialog.objects.create(
        topic="travel",
        context="station",
        source_language="spanish",
        target_language="german",
        turns=[
            {"source_text": "Hola.", "target_text": "Hallo.", "speaker": "a"},
            {"source_text": "Adios.", "target_text": "Tschuss.", "speaker": "b"},
        ],
    )
    first_turn = DialogTurn.objects.create(
        dialog=dialog,
        turn_index=0,
        source_text="Hola.",
        target_text="Hallo.",
        audio_url="http://localhost:8000/media/audio/old-0.mp3",
    )
    second_turn = DialogTurn.objects.create(
        dialog=dialog,
        turn_index=1,
        source_text="Adios.",
        target_text="Tschuss.",
        audio_url="http://localhost:8000/media/audio/old-1.mp3",
    )

    monkeypatch.setattr(
        dialog_listing_views,
        "select_dialog_speaker_voice_ids",
        lambda target_language, seed="": ("voice-a", "voice-b"),
    )
    monkeypatch.setattr(
        dialog_listing_views,
        "create_audio_file",
        lambda text, prefix, **kwargs: f"http://localhost:8000/media/audio/{kwargs.get('voice_id', 'default')}-{text}.mp3",
    )

    client = APIClient()
    response = client.post(
        f"/api/content/dialogs/{dialog.id}/audio?source_language=spanish&target_language=german",
        format="json",
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["turns"][0]["phrase_audio_url"] == "http://localhost:8000/media/audio/voice-a-Hallo..mp3"
    assert payload["turns"][1]["phrase_audio_url"] == "http://localhost:8000/media/audio/voice-b-Tschuss..mp3"
    first_turn.refresh_from_db()
    second_turn.refresh_from_db()
    assert first_turn.audio_url == "http://localhost:8000/media/audio/voice-a-Hallo..mp3"
    assert second_turn.audio_url == "http://localhost:8000/media/audio/voice-b-Tschuss..mp3"


@pytest.mark.django_db
def test_content_item_question_saves_conversation(monkeypatch):
    from learning.views.content import item_questions as item_question_views

    item = Item.objects.create(
        item_type=Item.ItemType.WORD,
        spanish_text="gracias",
        german_text="danke",
        source_language="spanish",
        target_language="german",
    )
    monkeypatch.setattr(
        item_question_views,
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
def test_content_item_question_sends_full_conversation_context_to_model(monkeypatch):
    from learning.views.content import item_questions as item_question_views

    item = Item.objects.create(
        item_type=Item.ItemType.WORD,
        spanish_text="gracias",
        german_text="danke",
        source_language="spanish",
        target_language="german",
    )
    call_user_payloads: list[str] = []
    call_system_prompts: list[str] = []
    call_kwargs: list[dict] = []

    def fake_call_openai_json(system_prompt, user_payload, **kwargs):
        call_system_prompts.append(str(system_prompt))
        call_user_payloads.append(str(user_payload))
        call_kwargs.append(dict(kwargs))
        return {"related": True, "result_code": "RELATED_OK", "answer": "Nutze es in kurzen Saetzen."}

    monkeypatch.setattr(item_question_views.settings, "OPENAI_QUESTION_MODEL", "gpt-question-test")
    monkeypatch.setattr(item_question_views, "call_openai_json", fake_call_openai_json)

    client = APIClient()
    response_one = client.post(
        f"/api/content/items/{item.id}/question?source_language=spanish&target_language=german",
        {"question_text": "How can I use danke in a sentence?"},
        format="json",
    )
    response_two = client.post(
        f"/api/content/items/{item.id}/question?source_language=spanish&target_language=german",
        {"question_text": "Give me two more ways to say danke."},
        format="json",
    )

    assert response_one.status_code == 201
    assert response_two.status_code == 201
    assert len(call_user_payloads) == 2
    assert "Conversation history (oldest to newest):" in call_user_payloads[1]
    assert "How can I use danke in a sentence?" in call_user_payloads[1]
    assert "Nutze es in kurzen Saetzen." in call_user_payloads[1]
    assert "The answer text itself must be written in Spanish" in call_system_prompts[0]
    assert "Interpret every related question through German meaning/usage" in call_system_prompts[0]
    assert call_kwargs[0]["model"] == "gpt-question-test"


@pytest.mark.django_db
def test_content_item_question_merges_client_conversation_history(monkeypatch):
    from learning.views.content import item_questions as item_question_views

    item = Item.objects.create(
        item_type=Item.ItemType.WORD,
        spanish_text="gracias",
        german_text="danke",
        source_language="spanish",
        target_language="german",
    )
    captured_payloads: list[str] = []

    def fake_call_openai_json(system_prompt, user_payload, **kwargs):
        captured_payloads.append(str(user_payload))
        return {"related": True, "result_code": "RELATED_OK", "answer": "Se usa para dar las gracias."}

    monkeypatch.setattr(item_question_views.settings, "OPENAI_QUESTION_MODEL", "gpt-question-test")
    monkeypatch.setattr(item_question_views, "call_openai_json", fake_call_openai_json)

    client = APIClient()
    response = client.post(
        f"/api/content/items/{item.id}/question?source_language=spanish&target_language=german",
        {
            "question_text": "How else can I use danke here?",
            "conversation_history": [
                {
                    "question_text": "When do I use danke?",
                    "answer_text": "Use it to say thank you.",
                }
            ],
        },
        format="json",
    )

    assert response.status_code == 201
    assert len(captured_payloads) == 1
    assert "Conversation history (oldest to newest):" in captured_payloads[0]
    assert "When do I use danke?" in captured_payloads[0]
    assert "Use it to say thank you." in captured_payloads[0]


@pytest.mark.django_db
def test_content_item_question_rejects_unrelated_questions(monkeypatch):
    from learning.views.content import item_questions as item_question_views

    item = Item.objects.create(
        item_type=Item.ItemType.PHRASE,
        spanish_text="hola",
        german_text="hallo",
        source_language="spanish",
        target_language="german",
    )
    monkeypatch.setattr(
        item_question_views,
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
    from learning.models import ItemDialogOccurrence

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
    def fake_call_openai_json(system_prompt, user_input, **kwargs):
        if "Resolve a clicked target-language word translation" in system_prompt:
            return {"source_text": "vuelta", "target_text": "Runde", "word_type": "other"}
        if "Normalize a other study entry" in system_prompt:
            return {"source_text": "vuelta", "target_text": "Runde"}
        return None

    monkeypatch.setattr(management_views, "call_openai_json", fake_call_openai_json)
    _patch_word_metadata_call(monkeypatch, fake_call_openai_json)
    _patch_dialog_click_call(monkeypatch, fake_call_openai_json)

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
    assert ItemDialogOccurrence.objects.filter(
        item=existing,
        dialog=dialog,
        turn_index=0,
        side=ItemDialogOccurrence.Side.TARGET,
    ).exists()


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
    def fake_call_openai_json(system_prompt, user_input, **kwargs):
        if "Resolve a clicked target-language word translation" in system_prompt:
            return {"source_text": "esquina", "target_text": "Ecke", "word_type": "other"}
        if "Normalize a other study entry" in system_prompt:
            return {"source_text": "esquina", "target_text": "Ecke"}
        return None

    monkeypatch.setattr(management_views, "call_openai_json", fake_call_openai_json)
    _patch_word_metadata_call(monkeypatch, fake_call_openai_json)
    _patch_dialog_click_call(monkeypatch, fake_call_openai_json)
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
def test_quick_add_word_saves_basic_form_and_word_type(monkeypatch):
    from learning.views import content as content_views
    from learning.views.content import management as management_views

    def fake_call_openai_json(system_prompt, user_input, **kwargs):
        if "Resolve a clicked target-language word translation" in system_prompt:
            return {"source_text": "libros", "target_text": "Buecher", "word_type": "noun"}
        if "Normalize a noun study entry" in system_prompt:
            return {"source_text": "el libro", "target_text": "das Buch"}
        return None

    monkeypatch.setattr(management_views, "call_openai_json", fake_call_openai_json)
    _patch_word_metadata_call(monkeypatch, fake_call_openai_json)
    _patch_dialog_click_call(monkeypatch, fake_call_openai_json)
    monkeypatch.setattr(
        content_views,
        "create_audio_file",
        lambda text, prefix, target_language="german": f"http://localhost:8000/media/audio/{prefix}-mock.mp3",
    )
    dialog = SavedDialog.objects.create(
        topic="books",
        context="shop",
        source_language="spanish",
        target_language="german",
        turns=[{"source_text": "Busco libros.", "target_text": "Ich suche Buecher."}],
    )
    DialogTurn.objects.create(
        dialog=dialog,
        turn_index=0,
        source_text="Busco libros.",
        target_text="Ich suche Buecher.",
    )

    client = APIClient()
    response = client.post(
        "/api/content/words/add?source_language=spanish&target_language=german",
        {
            "source_text": "libros",
            "target_text": "Buecher",
            "dialog_id": dialog.id,
            "turn_index": 0,
        },
        format="json",
    )

    assert response.status_code == 201
    assert response.json()["word_type"] == "noun"
    word = Item.objects.get(item_type=Item.ItemType.WORD, spanish_text="el libro", german_text="das Buch")
    assert word.word_type == "noun"


@pytest.mark.django_db
def test_quick_add_word_creates_same_text_with_different_word_type(monkeypatch):
    from learning.views import content as content_views
    from learning.views.content import management_items_quick_add as quick_add_views

    Item.objects.create(
        item_type=Item.ItemType.WORD,
        spanish_text="ayuda",
        german_text="helfen",
        source_language="spanish",
        target_language="german",
        word_type="noun",
    )

    monkeypatch.setattr(quick_add_views, "_resolve_dialog_click_word_pair", lambda **kwargs: ("ayuda", "helfen", "verb"))
    monkeypatch.setattr(
        quick_add_views,
        "_normalize_word_metadata",
        lambda **kwargs: ("ayuda", "helfen", "verb"),
    )
    monkeypatch.setattr(
        content_views,
        "create_audio_file",
        lambda text, prefix, target_language="german": f"http://localhost:8000/media/audio/{prefix}-mock.mp3",
    )

    client = APIClient()
    response = client.post(
        "/api/content/words/add?source_language=spanish&target_language=german",
        {"source_text": "ayuda", "target_text": "helfen"},
        format="json",
    )

    assert response.status_code == 201
    assert response.json()["created"] is True
    assert Item.objects.filter(
        item_type=Item.ItemType.WORD,
        spanish_text="ayuda",
        german_text="helfen",
    ).count() == 2


@pytest.mark.django_db
def test_quick_add_existing_unknown_word_adds_type_and_returns_item(monkeypatch):
    from learning.views.content import management as management_views
    from learning.models import ItemDialogOccurrence

    existing = Item.objects.create(
        item_type=Item.ItemType.WORD,
        spanish_text="poder",
        german_text="können",
        source_language="spanish",
        target_language="german",
        word_type="",
    )
    dialog = SavedDialog.objects.create(
        topic="work",
        context="office",
        source_language="spanish",
        target_language="german",
        turns=[
            {
                "source_text": "Puedo ir hoy.",
                "target_text": "Ich kann heute gehen.",
            }
        ],
    )
    DialogTurn.objects.create(
        dialog=dialog,
        turn_index=0,
        source_text="Puedo ir hoy.",
        target_text="Ich kann heute gehen.",
    )

    def fake_call_openai_json(system_prompt, user_input, **kwargs):
        if "Resolve a clicked target-language word translation" in system_prompt:
            return {"source_text": "poder", "target_text": "kann", "word_type": "helper"}
        if "Normalize a helper study entry" in system_prompt:
            return {"source_text": "poder", "target_text": "können"}
        return None

    monkeypatch.setattr(management_views, "call_openai_json", fake_call_openai_json)
    _patch_word_metadata_call(monkeypatch, fake_call_openai_json)
    _patch_dialog_click_call(monkeypatch, fake_call_openai_json)

    client = APIClient()
    response = client.post(
        "/api/content/words/add?source_language=spanish&target_language=german",
        {
            "source_text": "kann",
            "target_text": "kann",
            "dialog_id": dialog.id,
            "turn_index": 0,
            "check_only": True,
        },
        format="json",
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["exists"] is True
    assert payload["id"] == existing.id
    assert payload["word_type"] == "helper"
    existing.refresh_from_db()
    assert existing.word_type == "helper"
    assert ItemDialogOccurrence.objects.filter(item=existing, dialog=dialog, turn_index=0).exists()


@pytest.mark.django_db
def test_quick_add_word_from_unselected_dialog_turn_creates_phrase_audio_context(monkeypatch):
    from learning.views.content import dialog_item_context
    from learning.views.content import management_items_quick_add as quick_add_views
    from learning.views.content import persistence as persistence_views

    dialog = SavedDialog.objects.create(
        topic="errands",
        context="shopping",
        source_language="spanish",
        target_language="german",
        turns=[
            {
                "source_text": "Compro pan.",
                "target_text": "Ich kaufe Brot.",
            },
            {
                "source_text": "Voy a la tienda.",
                "target_text": "Ich gehe zum Laden.",
            },
        ],
    )
    DialogTurn.objects.create(
        dialog=dialog,
        turn_index=0,
        source_text="Compro pan.",
        target_text="Ich kaufe Brot.",
    )
    turn = DialogTurn.objects.create(
        dialog=dialog,
        turn_index=1,
        source_text="Voy a la tienda.",
        target_text="Ich gehe zum Laden.",
    )

    monkeypatch.setattr(
        quick_add_views,
        "_resolve_dialog_click_word_pair",
        lambda **kwargs: ("tienda", "Laden", "noun"),
    )
    monkeypatch.setattr(
        quick_add_views,
        "_normalize_word_metadata",
        lambda **kwargs: ("la tienda", "der Laden", "noun"),
    )
    def fake_audio(text, prefix, target_language="german", voice_id=""):
        return f"http://localhost:8000/media/audio/{prefix}-{text[:6]}.mp3"

    monkeypatch.setattr(dialog_item_context, "create_audio_file", fake_audio)
    monkeypatch.setattr(persistence_views, "create_audio_file", fake_audio)

    client = APIClient()
    response = client.post(
        "/api/content/words/add?source_language=spanish&target_language=german",
        {
            "source_text": "Laden",
            "target_text": "Laden",
            "dialog_id": dialog.id,
            "turn_index": turn.turn_index,
            "source_line": turn.source_text,
            "target_line": turn.target_text,
            "clicked_target_token": "Laden",
        },
        format="json",
    )

    assert response.status_code == 201
    word = Item.objects.get(item_type=Item.ItemType.WORD, spanish_text="la tienda", german_text="der Laden")
    turn.refresh_from_db()
    assert turn.audio_url.startswith("http://localhost:8000/media/audio/phrase-")
    assert not Item.objects.filter(
        item_type=Item.ItemType.PHRASE,
        spanish_text="Voy a la tienda.",
        german_text="Ich gehe zum Laden.",
    ).exists()
    assert ItemDialogOccurrence.objects.filter(item=word, dialog=dialog, turn=turn, turn_index=1).exists()

    detail = client.get(f"/api/content/items/{word.id}?source_language=spanish&target_language=german")

    assert detail.status_code == 200
    related_turns = detail.json()["related_dialogs"][0]["turns"]
    assert related_turns[1]["phrase_audio_url"] == turn.audio_url


@pytest.mark.django_db
def test_quick_add_existing_noun_missing_articles_opens_existing_item(monkeypatch):
    from learning.views.content import management as management_views
    from learning.models import ItemDialogOccurrence

    existing = Item.objects.create(
        item_type=Item.ItemType.WORD,
        spanish_text="grupo",
        german_text="Gruppe",
        source_language="spanish",
        target_language="german",
        word_type="noun",
    )
    dialog = SavedDialog.objects.create(
        topic="people",
        context="meeting",
        source_language="spanish",
        target_language="german",
        turns=[
            {
                "source_text": "El grupo esta aqui.",
                "target_text": "Die Gruppe ist hier.",
            }
        ],
    )
    DialogTurn.objects.create(
        dialog=dialog,
        turn_index=0,
        source_text="El grupo esta aqui.",
        target_text="Die Gruppe ist hier.",
    )

    def fake_call_openai_json(system_prompt, user_input, **kwargs):
        if "Resolve a clicked target-language word translation" in system_prompt:
            return {"source_text": "grupo", "target_text": "Gruppe", "word_type": "noun"}
        if "Normalize a noun study entry" in system_prompt:
            return {"source_text": "el grupo", "target_text": "die Gruppe"}
        return None

    monkeypatch.setattr(management_views, "call_openai_json", fake_call_openai_json)
    _patch_word_metadata_call(monkeypatch, fake_call_openai_json)
    _patch_dialog_click_call(monkeypatch, fake_call_openai_json)

    client = APIClient()
    response = client.post(
        "/api/content/words/add?source_language=spanish&target_language=german",
        {
            "source_text": "Gruppe",
            "target_text": "Gruppe",
            "dialog_id": dialog.id,
            "turn_index": 0,
            "check_only": True,
        },
        format="json",
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["exists"] is True
    assert payload["id"] == existing.id
    assert payload["source_text"] == "el grupo"
    assert payload["target_text"] == "die Gruppe"
    existing.refresh_from_db()
    assert existing.spanish_text == "el grupo"
    assert existing.german_text == "die Gruppe"
    assert existing.word_type == "noun"
    assert ItemDialogOccurrence.objects.filter(item=existing, dialog=dialog, turn_index=0).exists()


@pytest.mark.django_db
def test_quick_add_helper_fails_when_metadata_returns_full_phrase(monkeypatch):
    from learning.views.content import management as management_views

    dialog = SavedDialog.objects.create(
        topic="work",
        context="office",
        source_language="spanish",
        target_language="german",
        turns=[
            {
                "source_text": "Puedo ir hoy.",
                "target_text": "Ich kann heute gehen.",
            }
        ],
    )
    DialogTurn.objects.create(
        dialog=dialog,
        turn_index=0,
        source_text="Puedo ir hoy.",
        target_text="Ich kann heute gehen.",
    )

    def fake_call_openai_json(system_prompt, user_input, **kwargs):
        if "Resolve a clicked target-language word translation" in system_prompt:
            return {"source_text": "poder", "target_text": "kann", "word_type": "helper"}
        if "Normalize a helper study entry" in system_prompt:
            return {
                "source_text": "puedo ir",
                "target_text": "Ich kann gehen",
            }
        return None

    monkeypatch.setattr(management_views, "call_openai_json", fake_call_openai_json)
    _patch_word_metadata_call(monkeypatch, fake_call_openai_json)
    _patch_dialog_click_call(monkeypatch, fake_call_openai_json)

    client = APIClient()
    response = client.post(
        "/api/content/words/add?source_language=spanish&target_language=german",
        {
            "source_text": "kann",
            "target_text": "kann",
            "dialog_id": dialog.id,
            "turn_index": 0,
            "check_only": True,
        },
        format="json",
    )

    assert response.status_code == 503
    assert response.json()["detail"] == "Word metadata generation failed"


@pytest.mark.django_db
def test_quick_add_helper_fails_when_source_translation_matches_target(monkeypatch):
    from learning.views.content import management as management_views

    dialog = SavedDialog.objects.create(
        topic="work",
        context="office",
        source_language="spanish",
        target_language="german",
        turns=[
            {
                "source_text": "Puedo ir hoy.",
                "target_text": "Ich kann heute gehen.",
            }
        ],
    )
    DialogTurn.objects.create(
        dialog=dialog,
        turn_index=0,
        source_text="Puedo ir hoy.",
        target_text="Ich kann heute gehen.",
    )

    def fake_call_openai_json(system_prompt, user_input, **kwargs):
        if "Resolve a clicked target-language word translation" in system_prompt:
            return {"source_text": "poder", "target_text": "kann", "word_type": "helper"}
        if "Normalize a helper study entry" in system_prompt:
            return {"source_text": "können", "target_text": "können"}
        return None

    monkeypatch.setattr(management_views, "call_openai_json", fake_call_openai_json)
    _patch_word_metadata_call(monkeypatch, fake_call_openai_json)
    _patch_dialog_click_call(monkeypatch, fake_call_openai_json)

    client = APIClient()
    response = client.post(
        "/api/content/words/add?source_language=spanish&target_language=german",
        {
            "source_text": "kann",
            "target_text": "kann",
            "dialog_id": dialog.id,
            "turn_index": 0,
            "check_only": True,
        },
        format="json",
    )

    assert response.status_code == 503
    assert response.json()["detail"] == "Word metadata generation failed"


@pytest.mark.django_db
def test_quick_add_helper_allows_short_phrase_translation_and_adds_note(monkeypatch):
    from learning.views import content as content_views
    from learning.views.content import management as management_views

    dialog = SavedDialog.objects.create(
        topic="work",
        context="office",
        source_language="spanish",
        target_language="german",
        turns=[
            {
                "source_text": "Puedo ir hoy.",
                "target_text": "Ich kann heute gehen.",
            }
        ],
    )
    DialogTurn.objects.create(
        dialog=dialog,
        turn_index=0,
        source_text="Puedo ir hoy.",
        target_text="Ich kann heute gehen.",
    )

    def fake_call_openai_json(system_prompt, user_input, **kwargs):
        if "Resolve a clicked target-language word translation" in system_prompt:
            return {
                "source_text": "poder",
                "target_text": "kann",
                "word_type": "helper",
                "note": "Helper verb.",
            }
        if "Refine a clicked target-language helper study item" in system_prompt:
            return {
                "source_text": "poder ir",
                "target_text": "kann",
                "note": "Helper verb here expressing possibility.",
            }
        if "Normalize a helper study entry" in system_prompt:
            return {"source_text": "poder ir", "target_text": "können"}
        return None

    monkeypatch.setattr(management_views, "call_openai_json", fake_call_openai_json)
    _patch_word_metadata_call(monkeypatch, fake_call_openai_json)
    _patch_dialog_click_call(monkeypatch, fake_call_openai_json)
    monkeypatch.setattr(
        content_views,
        "create_audio_file",
        lambda text, prefix, target_language="german": f"http://localhost:8000/media/audio/{prefix}-mock.mp3",
    )

    client = APIClient()
    response = client.post(
        "/api/content/words/add?source_language=spanish&target_language=german",
        {
            "source_text": "kann",
            "target_text": "kann",
            "dialog_id": dialog.id,
            "turn_index": 0,
        },
        format="json",
    )

    assert response.status_code == 201
    payload = response.json()
    assert payload["source_text"] == "poder ir"
    assert payload["target_text"] == "können"
    assert "Helper verb here expressing possibility." in payload["notes"]
    assert "short phrase rather than a single standalone word" in payload["notes"]


@pytest.mark.django_db
def test_quick_add_word_fails_when_resolution_model_returns_nothing(monkeypatch):
    from learning.views.content import management as management_views

    no_metadata = lambda *args, **kwargs: None
    monkeypatch.setattr(management_views, "call_openai_json", no_metadata)
    _patch_word_metadata_call(monkeypatch, no_metadata)
    _patch_dialog_click_call(monkeypatch, no_metadata)

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

    assert response.status_code == 503
    assert response.json()["detail"] == "Word metadata generation failed"


@pytest.mark.django_db
def test_quick_add_word_fails_when_metadata_model_returns_incomplete_payload(monkeypatch):
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
    incomplete_payload = lambda *args, **kwargs: {"source_text": "Ecke", "target_text": "Ecke"}
    monkeypatch.setattr(
        management_views,
        "call_openai_json",
        incomplete_payload,
    )
    _patch_word_metadata_call(monkeypatch, incomplete_payload)
    _patch_dialog_click_call(monkeypatch, incomplete_payload)

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

    assert response.status_code == 503
    assert response.json()["detail"] == "Word metadata generation failed"


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
def test_quick_add_whole_turn_phrase_reuses_dialog_turn_audio(monkeypatch):
    from learning.views.content import persistence as persistence_views

    def fail_audio_generation(*args, **kwargs):
        raise AssertionError("Whole-turn phrase should reuse dialog turn audio")

    monkeypatch.setattr(persistence_views, "create_audio_file", fail_audio_generation)
    dialog = SavedDialog.objects.create(
        topic="travel",
        context="airport",
        source_language="spanish",
        target_language="german",
        turns=[{"source_text": "Necesito un taxi ahora.", "target_text": "Ich brauche jetzt ein Taxi."}],
        audio_url="",
    )
    turn = DialogTurn.objects.create(
        dialog=dialog,
        turn_index=0,
        source_text="Necesito un taxi ahora.",
        target_text="Ich brauche jetzt ein Taxi.",
        audio_url="http://localhost:8000/media/audio/dialog-turn-taxi.mp3",
    )

    client = APIClient()
    response = client.post(
        "/api/content/phrases/add?source_language=spanish&target_language=german",
        {
            "source_text": "Necesito un taxi ahora.",
            "target_text": "Ich brauche jetzt ein Taxi.",
            "dialog_id": dialog.id,
            "turn_index": turn.turn_index,
            "source_line": "Necesito un taxi ahora.",
            "target_line": "Ich brauche jetzt ein Taxi.",
        },
        format="json",
    )

    assert response.status_code == 201
    phrase = Item.objects.get(
        item_type=Item.ItemType.PHRASE,
        spanish_text="Necesito un taxi ahora.",
        german_text="Ich brauche jetzt ein Taxi.",
    )
    assert phrase.audio_url == turn.audio_url
    assert ItemDialogOccurrence.objects.filter(item=phrase, dialog=dialog, turn=turn, turn_index=0).exists()


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


@pytest.mark.django_db
def test_quick_add_phrase_translates_dialog_selection_and_links_turn(monkeypatch):
    from learning.views.content import management_items_quick_add as quick_add_views
    from learning.views import content as content_views

    monkeypatch.setattr(
        content_views,
        "create_audio_file",
        lambda text, prefix, target_language="german": "http://localhost:8000/media/audio/phrase-selection.mp3",
    )
    calls = []

    def fake_call_openai_json_logged(**kwargs):
        calls.append(kwargs)
        return (
            {"is_valid": True, "target_text": "ein Taxi", "reason": "valid noun phrase"}
            if kwargs.get("label") == "dialog_phrase_selection_validation"
            else {"can_translate_without_non_selected_words": True, "source_text": "un taxi"}
        )

    monkeypatch.setattr(quick_add_views, "_call_openai_json_logged", fake_call_openai_json_logged)

    dialog = SavedDialog.objects.create(
        topic="travel",
        context="airport",
        source_language="spanish",
        target_language="german",
        turns=[{"source_text": "Necesito un taxi ahora.", "target_text": "Ich brauche jetzt ein Taxi."}],
        audio_url="",
    )
    turn = DialogTurn.objects.create(
        dialog=dialog,
        turn_index=0,
        source_text="Necesito un taxi ahora.",
        target_text="Ich brauche jetzt ein Taxi.",
    )

    client = APIClient()
    response = client.post(
        "/api/content/phrases/add?source_language=spanish&target_language=german",
        {
            "target_text": "ein Taxi",
            "dialog_id": dialog.id,
            "turn_index": 0,
            "source_line": "Necesito un taxi ahora.",
            "target_line": "Ich brauche jetzt ein Taxi.",
        },
        format="json",
    )

    assert response.status_code == 201
    payload = response.json()
    assert payload["created"] is True
    assert payload["source_text"] == "un taxi"
    assert payload["target_text"] == "ein Taxi"
    phrase = Item.objects.get(item_type=Item.ItemType.PHRASE, spanish_text="un taxi", german_text="ein Taxi")
    assert ItemDialogOccurrence.objects.filter(item=phrase, dialog=dialog, turn=turn, turn_index=0).exists()
    validation_input = calls[0]["user_input"]
    assert "Selected target text: ein Taxi" in validation_input
    assert "Ich brauche jetzt ein Taxi." not in validation_input
    assert "Necesito un taxi ahora." not in validation_input


@pytest.mark.django_db
def test_quick_add_phrase_rejects_invalid_dialog_selection(monkeypatch):
    from learning.views.content import management_items_quick_add as quick_add_views

    monkeypatch.setattr(
        quick_add_views,
        "_call_openai_json_logged",
        lambda **kwargs: {"is_valid": False, "target_text": "", "reason": "needs surrounding words"},
    )

    client = APIClient()
    response = client.post(
        "/api/content/phrases/add?source_language=spanish&target_language=german",
        {
            "target_text": "brauche jetzt",
            "source_line": "Necesito un taxi ahora.",
            "target_line": "Ich brauche jetzt ein Taxi.",
            "check_only": True,
        },
        format="json",
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Selected words do not form a complete expression."
    assert not Item.objects.filter(item_type=Item.ItemType.PHRASE, german_text="brauche jetzt").exists()


@pytest.mark.django_db
def test_quick_add_phrase_rejects_translation_that_needs_unselected_words(monkeypatch):
    from learning.views.content import management_items_quick_add as quick_add_views

    def fake_call_openai_json_logged(**kwargs):
        if kwargs.get("label") == "dialog_phrase_selection_validation":
            return {"is_valid": True, "target_text": "brauche jetzt", "reason": "looks possible"}
        return {"can_translate_without_non_selected_words": False, "source_text": ""}

    monkeypatch.setattr(quick_add_views, "_call_openai_json_logged", fake_call_openai_json_logged)

    client = APIClient()
    response = client.post(
        "/api/content/phrases/add?source_language=spanish&target_language=german",
        {
            "target_text": "brauche jetzt",
            "source_line": "Necesito un taxi ahora.",
            "target_line": "Ich brauche jetzt ein Taxi.",
            "check_only": True,
        },
        format="json",
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Selected words do not form a complete expression."
    assert not Item.objects.filter(item_type=Item.ItemType.PHRASE, german_text="brauche jetzt").exists()


@pytest.mark.django_db
def test_quick_add_word_expression_creates_phrase_item(monkeypatch):
    from learning.views import content as content_views
    from learning.views.content import management as management_views
    from learning.views.content import management_items_quick_add as quick_add_views

    monkeypatch.setattr(
        content_views,
        "create_audio_file",
        lambda text, prefix, target_language="german": "http://localhost:8000/media/audio/expression-selection.mp3",
    )

    def fake_call_openai_json(system_prompt, user_input, **kwargs):
        if "Resolve a clicked target-language word translation" in system_prompt:
            return {
                "source_text": "opinar",
                "target_text": "hältst",
                "word_type": "expression",
                "note": "The clicked word alone is misleading here.",
            }
        if "Refine a clicked target-language expression study item" in system_prompt:
            return {
                "source_text": "opinar sobre algo",
                "target_text": "von etwas halten",
                "note": "The clicked word alone is misleading here.",
            }
        if "Normalize a expression study entry" in system_prompt:
            return {
                "source_text": "opinar sobre algo",
                "target_text": "von etwas halten",
            }
        raise AssertionError(f"Unexpected prompt: {system_prompt}")

    def fake_call_openai_json_logged(**kwargs):
        label = kwargs.get("label")
        if label == "dialog_phrase_selection_validation":
            return {"is_valid": True, "target_text": "von etwas halten", "reason": "valid expression"}
        if label == "dialog_phrase_selection_translation":
            return {"can_translate_without_non_selected_words": True, "source_text": "opinar sobre algo"}
        raise AssertionError(f"Unexpected label: {label}")

    monkeypatch.setattr(management_views, "call_openai_json", fake_call_openai_json)
    _patch_word_metadata_call(monkeypatch, fake_call_openai_json)
    _patch_dialog_click_call(monkeypatch, fake_call_openai_json)
    monkeypatch.setattr(quick_add_views, "_call_openai_json_logged", fake_call_openai_json_logged)

    dialog = SavedDialog.objects.create(
        topic="opinions",
        context="conversation",
        source_language="spanish",
        target_language="german",
        turns=[{"source_text": "¿Qué opinas de la serie?", "target_text": "Was hältst du von der Serie?"}],
        audio_url="",
    )
    turn = DialogTurn.objects.create(
        dialog=dialog,
        turn_index=0,
        source_text="¿Qué opinas de la serie?",
        target_text="Was hältst du von der Serie?",
    )

    client = APIClient()
    response = client.post(
        "/api/content/words/add?source_language=spanish&target_language=german",
        {
            "source_text": "hältst",
            "target_text": "hältst",
            "dialog_id": dialog.id,
            "turn_index": 0,
            "source_line": "¿Qué opinas de la serie?",
            "target_line": "Was hältst du von der Serie?",
            "clicked_target_token": "hältst",
        },
        format="json",
    )

    assert response.status_code == 201
    payload = response.json()
    assert payload["source_text"] == "opinar sobre algo"
    assert payload["target_text"] == "von etwas halten"
    created = Item.objects.get(
        item_type=Item.ItemType.PHRASE,
        spanish_text="opinar sobre algo",
        german_text="von etwas halten",
    )
    assert created.notes == "The clicked word alone is misleading here."
    assert not Item.objects.filter(item_type=Item.ItemType.WORD, german_text="von etwas halten").exists()
    assert ItemDialogOccurrence.objects.filter(item=created, dialog=dialog, turn=turn, turn_index=0).exists()


@pytest.mark.django_db
def test_quick_add_word_expression_check_only_returns_phrase_span(monkeypatch):
    from learning.views.content import management as management_views
    from learning.views.content import management_items_quick_add as quick_add_views

    def fake_call_openai_json(system_prompt, user_input, **kwargs):
        if "Resolve a clicked target-language word translation" in system_prompt:
            return {
                "source_text": "dar",
                "target_text": "egal",
                "word_type": "expression",
                "note": "This meaning belongs to the expression, not the single word.",
            }
        if "Refine a clicked target-language expression study item" in system_prompt:
            return {
                "source_text": "dar igual",
                "target_text": "egal sein",
                "note": "This meaning belongs to the expression, not the single word.",
            }
        if "Normalize a expression study entry" in system_prompt:
            return {
                "source_text": "dar igual",
                "target_text": "egal sein",
            }
        raise AssertionError(f"Unexpected prompt: {system_prompt}")

    def fake_call_openai_json_logged(**kwargs):
        label = kwargs.get("label")
        if label == "dialog_phrase_selection_validation":
            return {"is_valid": True, "target_text": "egal sein", "reason": "valid expression"}
        if label == "dialog_phrase_selection_translation":
            return {"can_translate_without_non_selected_words": True, "source_text": "dar igual"}
        raise AssertionError(f"Unexpected label: {label}")

    monkeypatch.setattr(management_views, "call_openai_json", fake_call_openai_json)
    _patch_word_metadata_call(monkeypatch, fake_call_openai_json)
    _patch_dialog_click_call(monkeypatch, fake_call_openai_json)
    monkeypatch.setattr(quick_add_views, "_call_openai_json_logged", fake_call_openai_json_logged)

    client = APIClient()
    response = client.post(
        "/api/content/words/add?source_language=spanish&target_language=german",
        {
            "source_text": "egal",
            "target_text": "egal",
            "source_line": "Me da igual.",
            "target_line": "Es ist mir egal.",
            "clicked_target_token": "egal",
            "check_only": True,
        },
        format="json",
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["created"] is False
    assert payload["exists"] is False
    assert payload["source_text"] == "dar igual"
    assert payload["target_text"] == "egal sein"
    assert not Item.objects.filter(item_type=Item.ItemType.WORD, german_text="egal sein").exists()
    assert not Item.objects.filter(item_type=Item.ItemType.PHRASE, german_text="egal sein").exists()


@pytest.mark.django_db
def test_content_dialogs_endpoint_returns_saved_dialogs_for_language_pair():
    dialog_match = SavedDialog.objects.create(
        topic="travel",
        context="airport",
        source_language="spanish",
        target_language="german",
        audio_url="http://localhost:8000/media/audio/dialog-1.wav",
    )
    DialogTurn.objects.create(dialog=dialog_match, turn_index=0, source_text="Hola", target_text="Hallo")
    DialogTurn.objects.create(dialog=dialog_match, turn_index=1, source_text="Adios", target_text="Tschuss")
    Item.objects.create(
        item_type=Item.ItemType.PHRASE,
        spanish_text="Hola",
        german_text="Hallo",
        source_language="spanish",
        target_language="german",
        audio_url="http://localhost:8000/media/audio/hola.mp3",
    )

    SavedDialog.objects.create(
        topic="ignore",
        context="office",
        source_language="english",
        target_language="german",
        audio_url="http://localhost:8000/media/audio/dialog-2.wav",
    )

    client = APIClient()
    response = client.get("/api/content/dialogs?source_language=spanish&target_language=german")

    assert response.status_code == 200
    payload = response.json()
    assert len(payload["dialogs"]) == 1
    first_dialog = payload["dialogs"][0]
    assert first_dialog["dialog_id"] == dialog_match.id
    assert first_dialog["topic"] == "travel"
    assert first_dialog["context"] == "airport"
    assert first_dialog["audio_url"] == "http://localhost:8000/media/audio/dialog-1.wav"
    assert first_dialog["turn_count"] == 2
    assert first_dialog["turns"] == []
    assert payload["has_more"] is False

    response = client.get(f"/api/content/dialogs/{dialog_match.id}?source_language=spanish&target_language=german")

    assert response.status_code == 200
    first_dialog = response.json()
    assert len(first_dialog["turns"]) == 2
    assert first_dialog["turns"][0]["source_text"] == "Hola"
    assert first_dialog["turns"][0]["target_text"] == "Hallo"
    assert first_dialog["turns"][0]["phrase_audio_url"] == "http://localhost:8000/media/audio/hola.mp3"
    assert first_dialog["turns"][1]["phrase_audio_url"] == ""


@pytest.mark.django_db
def test_content_dialogs_endpoint_paginates_and_filters_by_topic():
    for index in range(3):
        SavedDialog.objects.create(
            topic=f"travel {index}",
            context="airport",
            source_language="spanish",
            target_language="german",
        )
    SavedDialog.objects.create(
        topic="cooking",
        context="kitchen",
        source_language="spanish",
        target_language="german",
    )

    client = APIClient()
    response = client.get("/api/content/dialogs?source_language=spanish&target_language=german&topic=travel&page=1&page_size=2")

    assert response.status_code == 200
    payload = response.json()
    assert len(payload["dialogs"]) == 2
    assert payload["page"] == 1
    assert payload["page_size"] == 2
    assert payload["has_more"] is True
    assert payload["next_page"] == 2
    assert all("travel" in dialog["topic"] for dialog in payload["dialogs"])

    response = client.get("/api/content/dialogs?source_language=spanish&target_language=german&topic=travel&page=2&page_size=2")

    assert response.status_code == 200
    payload = response.json()
    assert len(payload["dialogs"]) == 1
    assert payload["has_more"] is False
    assert payload["next_page"] is None
    assert payload["dialogs"][0]["topic"].startswith("travel")


@pytest.mark.django_db
def test_content_item_exercises_endpoint_generates_and_saves_exercises(monkeypatch):
    from learning.views.content import management_items_listing as listing_views

    item = Item.objects.create(
        item_type=Item.ItemType.WORD,
        spanish_text="mesa",
        german_text="der Tisch",
        word_type="noun",
        source_language="spanish",
        target_language="german",
    )
    captured_kwargs = {}

    def fake_generate(*args, **kwargs):
        captured_kwargs.update(kwargs)
        return {
            "phrases": [
                {"label": "singular", "source_text": "La mesa es grande.", "target_text": "Der Tisch ist groß."},
                {"label": "plural", "source_text": "Las mesas estan aqui.", "target_text": "Tische sind hier."},
                {"label": "nominative", "source_text": "La mesa esta lista.", "target_text": "Der Tisch ist bereit."},
                {"label": "dative", "source_text": "Esta en la mesa.", "target_text": "Es ist am Tisch."},
                {"label": "accusative", "source_text": "Veo la mesa.", "target_text": "Ich sehe den Tisch."},
                {"label": "definite", "source_text": "La mesa esta aqui.", "target_text": "Der Tisch ist hier."},
                {"label": "indefinite", "source_text": "Tengo una mesa.", "target_text": "Ich habe einen Tisch."},
            ],
        }

    monkeypatch.setattr(
        listing_views,
        "generate_word_exercise_phrases_with_chatgpt",
        fake_generate,
    )

    client = APIClient()
    response = client.post(
        f"/api/content/items/{item.id}/exercises?source_language=spanish&target_language=german",
        format="json",
    )
    assert response.status_code == 200
    payload = response.json()
    assert len(payload["exercise_phrases"]["phrases"]) == 7
    assert payload["exercise_phrases"]["phrases"][0]["label"] == "singular"
    assert captured_kwargs["word_type"] == "noun"

    item.refresh_from_db()
    assert len((item.exercise_phrases or {}).get("phrases", [])) == 7
    assert (item.exercise_phrases or {}).get("phrases", [])[6]["label"] == "indefinite"


def test_word_exercise_generation_uses_prompt_for_word_type():
    from learning.views.content import generation_words

    captured_prompts = []
    captured_inputs = []

    def fake_call_openai_json(prompt, user_input, **kwargs):
        captured_prompts.append(prompt)
        captured_inputs.append(user_input)
        return {
            "phrases": [
                {"label": "singular", "source_text": "La mesa.", "target_text": "Der Tisch."},
            ],
        }

    generation_words.generate_word_exercise_phrases_with_chatgpt(
        "la mesa",
        "der Tisch",
        word_type="noun",
        target_contexts=["Der Tisch steht am Fenster.", "Der Tisch ist zu laut."],
        call_openai_json_fn=fake_call_openai_json,
    )
    generation_words.generate_word_exercise_phrases_with_chatgpt(
        "poder",
        "können",
        word_type="helper",
        call_openai_json_fn=fake_call_openai_json,
    )
    generation_words.generate_word_exercise_phrases_with_chatgpt(
        "algo",
        "etwas",
        word_type="",
        call_openai_json_fn=fake_call_openai_json,
    )

    assert "Generate noun exercise phrases" in captured_prompts[0]
    assert "Generate helper-word exercise phrases" in captured_prompts[1]
    assert "Generate exercise phrases for one vocabulary item" in captured_prompts[2]
    assert "la mesa" not in captured_inputs[0]
    assert "der Tisch" in captured_inputs[0]
    assert "Target-language word/context: der Tisch" in captured_inputs[0]
    assert "Der Tisch steht am Fenster." in captured_inputs[0]
    assert "Der Tisch ist zu laut." not in captured_inputs[0]


def test_funny_image_generation_uses_prompt_for_word_type():
    from learning.views.content import generation_words

    captured_prompts = []
    captured_inputs = []
    expected_instructions = {
        "noun": [
            "grammatical subject of the sentence",
            "preferably begin with the target noun and its article",
        ],
        "verb": ["main visible action"],
        "adjective": ["clearly visible property"],
        "preposition": ["spatial relationship visually obvious"],
        "adverb": ["visibly affect the action"],
    }

    def fake_call_openai_json(prompt, user_input, **kwargs):
        captured_prompts.append(prompt)
        captured_inputs.append(user_input)
        return {
            "source_text": "La mesa lleva un sombrero.",
            "target_text": "Der Tisch tragt einen Hut.",
        }

    for word_type in expected_instructions:
        generation_words.generate_funny_image_exercise_phrase_with_chatgpt(
            "la mesa",
            "der Tisch",
            word_type=word_type,
            target_contexts=["Der Tisch steht am Fenster.", "Der Tisch ist zu laut."],
            call_openai_json_fn=fake_call_openai_json,
        )
    generation_words.generate_funny_image_exercise_phrase_with_chatgpt(
        "algo",
        "etwas",
        word_type="",
        call_openai_json_fn=fake_call_openai_json,
    )

    for index, snippets in enumerate(expected_instructions.values()):
        for snippet in snippets:
            assert snippet in captured_prompts[index]
    for snippets in expected_instructions.values():
        for snippet in snippets:
            assert snippet not in captured_prompts[-1]
    assert "la mesa" not in captured_inputs[0]
    assert "der Tisch" in captured_inputs[0]
    assert "Target-language word/context: der Tisch" in captured_inputs[0]
    assert "Der Tisch steht am Fenster." in captured_inputs[0]
    assert "Der Tisch ist zu laut." not in captured_inputs[0]


def test_verb_exercise_generation_requests_each_tense_separately():
    from learning.views.content import generation_words

    captured_inputs = []

    def fake_call_openai_json(prompt, user_input, **kwargs):
        captured_inputs.append(user_input)
        tense_key = user_input.split("Use labels prefixed with: ", 1)[1].split("-", 1)[0]
        if "simple-past-" in user_input:
            tense_key = "simple-past"
        return {
            "phrases": [
                {"label": f"{tense_key}-1s", "source_text": "Yo trabajo en casa.", "target_text": "Ich arbeite zu Hause."},
                {"label": f"{tense_key}-2s", "source_text": "Tu trabajas en casa.", "target_text": "Du arbeitest zu Hause."},
                {"label": f"{tense_key}-3s", "source_text": "Ella trabaja en casa.", "target_text": "Sie arbeitet zu Hause."},
                {"label": f"{tense_key}-1p", "source_text": "Nosotros trabajamos en casa.", "target_text": "Wir arbeiten zu Hause."},
                {"label": f"{tense_key}-2p", "source_text": "Ustedes trabajan en casa.", "target_text": "Ihr arbeitet zu Hause."},
                {"label": f"{tense_key}-3p", "source_text": "Ellos trabajan en casa.", "target_text": "Sie arbeiten zu Hause."},
            ],
        }

    payload = generation_words.generate_word_exercise_phrases_with_chatgpt(
        "trabajar",
        "arbeiten",
        word_type="verb",
        call_openai_json_fn=fake_call_openai_json,
    )

    assert len(captured_inputs) == 4
    assert "Requested tense: Present" in captured_inputs[0]
    assert "Requested tense: Perfect" in captured_inputs[1]
    assert "Requested tense: Simple past" in captured_inputs[2]
    assert "Requested tense: Future" in captured_inputs[3]
    assert len(payload["phrases"]) == 24
    assert payload["phrases"][0]["label"] == "present-1s"
    assert payload["phrases"][18]["label"] == "future-1s"


def test_word_exercise_generation_drops_bare_vocabulary_entries():
    from learning.views.content import generation_words

    def fake_call_openai_json(prompt, user_input, **kwargs):
        return {
            "phrases": [
                {"label": "word", "source_text": "la mesa", "target_text": "der Tisch"},
                {"label": "plural", "source_text": "las mesas", "target_text": "die Tische"},
                {"label": "nominative", "source_text": "La mesa esta aqui.", "target_text": "Der Tisch ist hier."},
            ],
        }

    payload = generation_words.generate_word_exercise_phrases_with_chatgpt(
        "la mesa",
        "der Tisch",
        word_type="noun",
        call_openai_json_fn=fake_call_openai_json,
    )

    assert payload["phrases"] == [
        {"label": "nominative", "source_text": "La mesa esta aqui.", "target_text": "Der Tisch ist hier."},
    ]
