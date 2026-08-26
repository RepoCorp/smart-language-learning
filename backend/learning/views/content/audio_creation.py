from __future__ import annotations

import base64
import logging
import re
import time
from uuid import uuid4

from django.conf import settings

from ...languages import OPENAI_TTS_ITEM_VOICE_BY_STUDY_LANGUAGE
from .tts_config import OPENAI_TTS_ITEM_DEFAULT_SPEED, OPENAI_TTS_PHRASE_DEFAULT_SPEED
from .tts_instructions import openai_tts_language_instruction

logger = logging.getLogger(__name__)


def _filename_for(text: str, prefix: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-") or "audio"
    return f"{prefix}-{slug[:32]}-{uuid4().hex[:8]}.mp3"


def _audio_bytes_for(
    *,
    text: str,
    prefix: str,
    target_language: str,
    voice_id: str,
    force_elevenlabs: bool,
    inline: bool,
) -> tuple[bytes | None, str]:
    # Import lazily to preserve audio.py's public helpers and test patches.
    from . import audio

    event_prefix = "content.audio.inline" if inline else "content.audio"
    default_speed = OPENAI_TTS_PHRASE_DEFAULT_SPEED if prefix == "phrase" else OPENAI_TTS_ITEM_DEFAULT_SPEED
    if audio.should_use_elevenlabs(voice_id=voice_id, force_elevenlabs=force_elevenlabs):
        tts_started_at = time.perf_counter()
        audio_bytes = audio._elevenlabs_tts_audio(
            text=text,
            voice_id=voice_id,
            target_language=target_language,
            output_format=str(getattr(settings, "ELEVENLABS_OUTPUT_FORMAT", "mp3_44100_128")),
        )
        voice = f"elevenlabs:{voice_id}"
        logger.info(
            "%s.tts_finished prefix=%s provider=elevenlabs target_language=%s voice=%s elapsed_ms=%s bytes=%s",
            event_prefix,
            prefix,
            target_language,
            voice,
            int((time.perf_counter() - tts_started_at) * 1000),
            len(audio_bytes or b""),
        )
        if audio_bytes:
            return audio_bytes, voice

        logger.warning(
            "%s.elevenlabs.voice_fallback prefix=%s target_language=%s voice_id=%s",
            event_prefix,
            prefix,
            target_language,
            voice_id,
        )
        tts_started_at = time.perf_counter()
        audio_bytes, voice = audio._item_tts_audio_bytes(
            text=text,
            prefix=prefix,
            target_language=target_language,
            default_speed=default_speed,
        )
        provider = "fallback"
    else:
        tts_started_at = time.perf_counter()
        audio_bytes, voice = audio._item_tts_audio_bytes(
            text=text,
            prefix=prefix,
            target_language=target_language,
            default_speed=default_speed,
        )
        provider = "auto"

    logger.info(
        "%s.tts_finished prefix=%s provider=%s target_language=%s voice=%s elapsed_ms=%s bytes=%s",
        event_prefix,
        prefix,
        provider,
        target_language,
        voice,
        int((time.perf_counter() - tts_started_at) * 1000),
        len(audio_bytes or b""),
    )
    return audio_bytes, voice


def create_audio_file(
    text: str,
    prefix: str,
    target_language: str = "german",
    voice_id: str = "",
    *,
    force_elevenlabs: bool = False,
) -> str:
    from . import audio

    started_at = time.perf_counter()
    if not text.strip():
        logger.warning("content.audio.skipped prefix=%s reason=empty_text", prefix)
        return ""

    filename = _filename_for(text, prefix)
    audio_bytes, voice = _audio_bytes_for(
        text=text,
        prefix=prefix,
        target_language=target_language,
        voice_id=voice_id,
        force_elevenlabs=force_elevenlabs,
        inline=False,
    )
    if not audio_bytes:
        logger.warning("content.audio.failed prefix=%s filename=%s target_language=%s", prefix, filename, target_language)
        return ""

    store_started_at = time.perf_counter()
    audio_url = audio._store_audio_bytes(filename, audio_bytes, content_type="audio/mpeg")
    logger.info(
        "content.audio.store_finished prefix=%s filename=%s target_language=%s elapsed_ms=%s has_audio=%s",
        prefix,
        filename,
        target_language,
        int((time.perf_counter() - store_started_at) * 1000),
        bool(audio_url),
    )
    if not audio_url:
        logger.warning("content.audio.failed_store prefix=%s filename=%s", prefix, filename)
        return ""

    logger.info(
        "content.audio.created prefix=%s filename=%s target_language=%s voice=%s total_elapsed_ms=%s",
        prefix,
        filename,
        target_language,
        voice,
        int((time.perf_counter() - started_at) * 1000),
    )
    return audio_url


def create_audio_data_url(
    text: str,
    prefix: str,
    target_language: str = "german",
    voice_id: str = "",
    *,
    force_elevenlabs: bool = False,
) -> str:
    started_at = time.perf_counter()
    if not text.strip():
        logger.warning("content.audio.inline_skipped prefix=%s reason=empty_text", prefix)
        return ""

    audio_bytes, voice = _audio_bytes_for(
        text=text,
        prefix=prefix,
        target_language=target_language,
        voice_id=voice_id,
        force_elevenlabs=force_elevenlabs,
        inline=True,
    )
    if not audio_bytes:
        logger.warning("content.audio.inline_failed prefix=%s target_language=%s", prefix, target_language)
        return ""

    data_url = f"data:audio/mpeg;base64,{base64.b64encode(audio_bytes).decode('ascii')}"
    logger.info(
        "content.audio.inline_created prefix=%s target_language=%s voice=%s total_elapsed_ms=%s bytes=%s",
        prefix,
        target_language,
        voice,
        int((time.perf_counter() - started_at) * 1000),
        len(audio_bytes),
    )
    return data_url


def create_openai_audio_file(text: str, prefix: str, target_language: str = "german") -> str:
    from . import audio

    if not text.strip():
        logger.warning("content.audio.openai_skipped prefix=%s reason=empty_text", prefix)
        return ""

    filename = _filename_for(text, prefix)
    default_speed = OPENAI_TTS_PHRASE_DEFAULT_SPEED if prefix == "phrase" else OPENAI_TTS_ITEM_DEFAULT_SPEED
    voice = OPENAI_TTS_ITEM_VOICE_BY_STUDY_LANGUAGE.get(target_language, "onyx")
    audio_bytes = audio._openai_tts_audio(
        text=text,
        voice=voice,
        speed=default_speed,
        response_format="mp3",
        instructions=openai_tts_language_instruction(target_language),
    )
    if not audio_bytes:
        logger.warning("content.audio.openai_failed prefix=%s filename=%s target_language=%s", prefix, filename, target_language)
        return ""

    audio_url = audio._store_audio_bytes(filename, audio_bytes, content_type="audio/mpeg")
    if not audio_url:
        logger.warning("content.audio.openai_failed_store prefix=%s filename=%s", prefix, filename)
        return ""
    logger.info(
        "content.audio.openai_created prefix=%s filename=%s target_language=%s voice=%s",
        prefix,
        filename,
        target_language,
        f"openai:{voice}",
    )
    return audio_url


def create_elevenlabs_audio_file(text: str, prefix: str, target_language: str, voice_id: str) -> str:
    from . import audio

    if not text.strip() or not voice_id.strip():
        return ""

    filename = _filename_for(text, prefix)
    audio_bytes = audio._elevenlabs_tts_audio(
        text=text,
        voice_id=voice_id.strip(),
        target_language=target_language,
        output_format=str(getattr(settings, "ELEVENLABS_OUTPUT_FORMAT", "mp3_44100_128")),
    )
    if not audio_bytes:
        logger.warning("content.audio.elevenlabs.preview_failed prefix=%s target_language=%s voice_id=%s", prefix, target_language, voice_id)
        return ""

    audio_url = audio._store_audio_bytes(filename, audio_bytes, content_type="audio/mpeg")
    if not audio_url:
        logger.warning("content.audio.elevenlabs.preview_store_failed prefix=%s filename=%s", prefix, filename)
        return ""
    return audio_url
