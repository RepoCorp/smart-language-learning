from __future__ import annotations

import json
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request as UrlRequest, urlopen

from django.conf import settings

from ...ai_usage import reserve_ai_usage, settle_ai_usage
from ...models import DailyAIUsage
from ...languages import TTS_LANGUAGE_CODE_BY_STUDY_LANGUAGE


def openai_tts_audio(
    *,
    text: str,
    voice: str,
    speed: float,
    response_format: str,
    instructions: str = "",
) -> bytes | None:
    api_key = settings.OPENAI_API_KEY
    if not api_key:
        return None
    model = str(getattr(settings, "OPENAI_TTS_MODEL", "gpt-4o-mini-tts"))
    body = {
        "model": model,
        "voice": voice,
        "input": text,
        "speed": speed,
        "response_format": response_format,
    }
    if instructions.strip():
        body["instructions"] = instructions.strip()
    reservation = reserve_ai_usage(
        provider="openai",
        category=DailyAIUsage.Category.AUDIO,
        units=len(text),
        model=model,
        feature="audio",
    )
    request = UrlRequest(
        "https://api.openai.com/v1/audio/speech",
        data=json.dumps(body).encode("utf-8"),
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urlopen(request, timeout=int(getattr(settings, "OPENAI_TTS_REQUEST_TIMEOUT_SECONDS", 40))) as response:
            payload = response.read()
    except (HTTPError, URLError, TimeoutError):
        settle_ai_usage(reservation, failed=True)
        return None
    settle_ai_usage(reservation)
    return payload


def elevenlabs_tts_audio(
    *,
    text: str,
    voice_id: str,
    target_language: str,
    output_format: str,
) -> bytes | None:
    api_key = str(getattr(settings, "ELEVENLABS_API_KEY", "")).strip()
    if not api_key or not voice_id:
        return None
    model_id = str(getattr(settings, "ELEVENLABS_MODEL_ID", "eleven_multilingual_v2")).strip() or "eleven_multilingual_v2"
    output = output_format.strip() or "mp3_44100_128"
    body = {
        "text": text,
        "model_id": model_id,
        "language_code": TTS_LANGUAGE_CODE_BY_STUDY_LANGUAGE.get(target_language, target_language[:2].lower()),
    }
    reservation = reserve_ai_usage(
        provider="elevenlabs",
        category=DailyAIUsage.Category.AUDIO,
        units=len(text),
        model=model_id,
        feature="audio",
    )
    request = UrlRequest(
        f"https://api.elevenlabs.io/v1/text-to-speech/{quote(voice_id)}?output_format={quote(output)}",
        data=json.dumps(body).encode("utf-8"),
        headers={"xi-api-key": api_key, "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urlopen(request, timeout=int(getattr(settings, "OPENAI_TTS_REQUEST_TIMEOUT_SECONDS", 40))) as response:
            payload = response.read()
    except (HTTPError, URLError, TimeoutError):
        settle_ai_usage(reservation, failed=True)
        return None
    settle_ai_usage(reservation)
    return payload


def fetch_elevenlabs_voices() -> list[dict[str, object]]:
    api_key = str(getattr(settings, "ELEVENLABS_API_KEY", "")).strip()
    if not api_key:
        return []
    request = UrlRequest(
        "https://api.elevenlabs.io/v1/voices",
        headers={"xi-api-key": api_key, "Accept": "application/json"},
        method="GET",
    )
    try:
        with urlopen(request, timeout=int(getattr(settings, "OPENAI_TTS_REQUEST_TIMEOUT_SECONDS", 40))) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except (HTTPError, URLError, TimeoutError, ValueError):
        return []
    voices = payload.get("voices")
    return voices if isinstance(voices, list) else []
