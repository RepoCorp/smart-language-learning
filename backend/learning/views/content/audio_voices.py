from __future__ import annotations

import hashlib
import logging
import os
import re

from django.conf import settings

from .audio_provider import configured_tts_provider

logger = logging.getLogger(__name__)


def _comma_separated_values(value: str) -> list[str]:
    return [entry.strip() for entry in value.split(",") if entry.strip()]


def _deterministic_index(seed: str, count: int) -> int:
    if count <= 0:
        return 0
    return int(hashlib.sha256(seed.encode("utf-8")).hexdigest()[:12], 16) % count


def _language_setting_name(prefix: str, target_language: str, suffix: str) -> str:
    normalized_language = re.sub(r"[^A-Z0-9]+", "_", target_language.upper()).strip("_")
    return f"{prefix}_{normalized_language}_{suffix}"


def _setting_or_env(setting_name: str, default: str = "") -> str:
    configured = getattr(settings, setting_name, None)
    return str(configured).strip() if configured is not None else os.getenv(setting_name, default).strip()


def _disabled_voice_ids() -> set[str]:
    from ...models import DisabledElevenLabsVoice

    try:
        return set(DisabledElevenLabsVoice.objects.values_list("voice_id", flat=True))
    except Exception:
        return set()


def _voice_ids(*, target_language: str, kind: str = "") -> list[str]:
    kind_prefix = f"{kind.upper()}_" if kind else ""
    candidates = [
        _language_setting_name("ELEVENLABS", target_language, f"{kind_prefix}VOICE_IDS"),
        _language_setting_name("ELEVENLABS", target_language, f"{kind_prefix}VOICE_ID"),
        f"ELEVENLABS_{kind_prefix}VOICE_IDS",
        f"ELEVENLABS_{kind_prefix}VOICE_ID",
        "ELEVENLABS_VOICE_IDS",
        "ELEVENLABS_VOICE_ID",
    ]
    disabled = _disabled_voice_ids()
    for setting_name in candidates:
        voices = [voice_id for voice_id in _comma_separated_values(_setting_or_env(setting_name)) if voice_id not in disabled]
        if voices:
            return voices
    return []


def configured_elevenlabs_voice_ids(target_language: str) -> list[str]:
    ordered: list[str] = []
    for kind in ("", "phrase", "word"):
        for voice_id in _voice_ids(target_language=target_language, kind=kind):
            if voice_id not in ordered:
                ordered.append(voice_id)
    for voice_id in _dialog_voice_ids(target_language):
        if voice_id not in ordered:
            ordered.append(voice_id)
    return ordered


def elevenlabs_voice_id(*, target_language: str, kind: str = "", seed: str = "") -> str:
    voice_ids = _voice_ids(target_language=target_language, kind=kind)
    return voice_ids[_deterministic_index(seed or f"{target_language}:{kind}", len(voice_ids))] if voice_ids else ""


def _dialog_voice_ids(target_language: str) -> list[str]:
    configured = _setting_or_env(_language_setting_name("ELEVENLABS", target_language, "DIALOG_VOICE_IDS"))
    configured = configured or _setting_or_env("ELEVENLABS_DIALOG_VOICE_IDS")
    disabled = _disabled_voice_ids()
    voices = [voice_id for voice_id in _comma_separated_values(configured) if voice_id not in disabled]
    return voices if len(voices) >= 2 else _voice_ids(target_language=target_language)


def select_dialog_speaker_voice_ids(target_language: str, seed: str = "", *, force_elevenlabs: bool = False) -> tuple[str, str] | None:
    if not force_elevenlabs and configured_tts_provider() != "elevenlabs":
        return None
    voices = _dialog_voice_ids(target_language)
    if len(voices) < 2:
        logger.warning("content.audio.dialog_voices.elevenlabs_missing_voices target_language=%s", target_language)
        return None
    first_index = _deterministic_index(f"{seed or target_language}:a", len(voices))
    remaining = [voice for index, voice in enumerate(voices) if index != first_index]
    return voices[first_index], remaining[_deterministic_index(f"{seed or target_language}:b", len(remaining))]
