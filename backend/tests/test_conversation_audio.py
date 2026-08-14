import base64


def test_natural_voice_selection_uses_elevenlabs_when_global_provider_is_openai(settings):
    from learning.views.content import audio

    settings.AUDIO_TTS_PROVIDER = "openai"
    settings.ELEVENLABS_GERMAN_DIALOG_VOICE_IDS = "voice-a,voice-b"

    voice_ids = audio.select_dialog_speaker_voice_ids("german", force_elevenlabs=True)

    assert voice_ids is not None
    assert set(voice_ids) == {"voice-a", "voice-b"}


def test_forced_elevenlabs_inline_audio_uses_selected_voice(monkeypatch, settings):
    from learning.views.content import audio

    settings.AUDIO_TTS_PROVIDER = "openai"
    captured_calls = []

    def fake_elevenlabs_audio(**kwargs):
        captured_calls.append(kwargs)
        return b"elevenlabs-audio"

    monkeypatch.setattr(audio, "_elevenlabs_tts_audio", fake_elevenlabs_audio)

    data_url = audio.create_audio_data_url(
        "Guten Morgen.",
        "conversation",
        target_language="german",
        voice_id="voice-b",
        force_elevenlabs=True,
    )

    assert base64.b64decode(data_url.split(",", 1)[1]) == b"elevenlabs-audio"
    assert captured_calls[0]["voice_id"] == "voice-b"
