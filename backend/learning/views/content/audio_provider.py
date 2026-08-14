from __future__ import annotations

from django.conf import settings


def configured_tts_provider() -> str:
    provider = str(getattr(settings, "AUDIO_TTS_PROVIDER", "openai")).strip().lower()
    return provider if provider in {"openai", "elevenlabs"} else "openai"


def should_use_elevenlabs(*, voice_id: str, force_elevenlabs: bool = False) -> bool:
    return bool(voice_id) and (force_elevenlabs or configured_tts_provider() == "elevenlabs")
