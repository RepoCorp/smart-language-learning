def test_audio_creation_returns_empty_url_when_all_tts_providers_fail(monkeypatch):
    from learning.views.content import audio

    monkeypatch.setattr(audio, "should_use_elevenlabs", lambda **kwargs: True)
    monkeypatch.setattr(audio, "_elevenlabs_tts_audio", lambda **kwargs: None)
    monkeypatch.setattr(audio, "_item_tts_audio_bytes", lambda **kwargs: (None, "openai:alloy"))

    assert audio.create_audio_file("Guten Morgen.", "phrase", voice_id="voice-a") == ""


def test_audio_creation_uses_fallback_after_empty_elevenlabs_response(monkeypatch):
    from learning.views.content import audio

    monkeypatch.setattr(audio, "should_use_elevenlabs", lambda **kwargs: True)
    monkeypatch.setattr(audio, "_elevenlabs_tts_audio", lambda **kwargs: None)
    monkeypatch.setattr(audio, "_item_tts_audio_bytes", lambda **kwargs: (b"fallback-audio", "openai:alloy"))
    monkeypatch.setattr(audio, "_store_audio_bytes", lambda *args, **kwargs: "https://audio.example/fallback.mp3")

    assert audio.create_audio_file("Guten Morgen.", "phrase", voice_id="voice-a") == "https://audio.example/fallback.mp3"
