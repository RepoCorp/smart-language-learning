from __future__ import annotations

import hashlib
import json
import logging
import os
import re
from pathlib import Path
from random import sample
from uuid import uuid4
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request as UrlRequest, urlopen

from django.conf import settings

from ...languages import language_display_name

logger = logging.getLogger(__name__)

OPENAI_TTS_ITEM_VOICE_BY_STUDY_LANGUAGE = {
    "spanish": "nova",
    "english": "alloy",
    "german": "onyx",
    "french": "shimmer",
    "italian": "echo",
    "portuguese": "fable",
}
TTS_LANGUAGE_CODE_BY_STUDY_LANGUAGE = {
    "spanish": "es",
    "english": "en",
    "german": "de",
    "french": "fr",
    "italian": "it",
    "portuguese": "pt",
}
OPENAI_TTS_ITEM_DEFAULT_SPEED = 1.0
OPENAI_TTS_PHRASE_DEFAULT_SPEED = 1.25


def _tts_language_instruction(target_language: str) -> str:
    language_label = language_display_name(target_language)
    return (
        f"Speak only in {language_label}. "
        f"Every word, syllable, abbreviation, article, and phrase must be pronounced with {language_label} phonetics and accent. "
        f"If a token looks like English or another language, still pronounce it as {language_label} text. "
        "Do not translate, switch languages, infer an English pronunciation, or reinterpret words as another language."
    )


def _configured_tts_provider() -> str:
    provider = str(getattr(settings, "AUDIO_TTS_PROVIDER", "openai")).strip().lower()
    return provider if provider in {"openai", "elevenlabs"} else "openai"


def _comma_separated_values(value: str) -> list[str]:
    return [entry.strip() for entry in value.split(",") if entry.strip()]


def _deterministic_index(seed: str, count: int) -> int:
    if count <= 0:
        return 0
    digest = hashlib.sha256(seed.encode("utf-8")).hexdigest()
    return int(digest[:12], 16) % count


def _language_setting_name(prefix: str, target_language: str, suffix: str) -> str:
    normalized_language = re.sub(r"[^A-Z0-9]+", "_", target_language.upper()).strip("_")
    return f"{prefix}_{normalized_language}_{suffix}"


def _setting_or_env(setting_name: str, default: str = "") -> str:
    configured = getattr(settings, setting_name, None)
    if configured is not None:
        return str(configured).strip()
    return os.getenv(setting_name, default).strip()


def _elevenlabs_voice_ids(*, target_language: str, kind: str = "") -> list[str]:
    kind_prefix = f"{kind.upper()}_" if kind else ""
    setting_candidates = [
        _language_setting_name("ELEVENLABS", target_language, f"{kind_prefix}VOICE_IDS"),
        _language_setting_name("ELEVENLABS", target_language, f"{kind_prefix}VOICE_ID"),
        f"ELEVENLABS_{kind_prefix}VOICE_IDS",
        f"ELEVENLABS_{kind_prefix}VOICE_ID",
        "ELEVENLABS_VOICE_IDS",
        "ELEVENLABS_VOICE_ID",
    ]
    for setting_name in setting_candidates:
        voice_ids = _comma_separated_values(_setting_or_env(setting_name))
        if voice_ids:
            return voice_ids
    return []


def _elevenlabs_voice_id(*, target_language: str, kind: str = "", seed: str = "") -> str:
    voice_ids = _elevenlabs_voice_ids(target_language=target_language, kind=kind)
    if not voice_ids:
        return ""
    return voice_ids[_deterministic_index(seed or f"{target_language}:{kind}", len(voice_ids))]


def _elevenlabs_dialog_voice_ids(target_language: str) -> list[str]:
    language_specific = _setting_or_env(_language_setting_name("ELEVENLABS", target_language, "DIALOG_VOICE_IDS"))
    configured = language_specific or _setting_or_env("ELEVENLABS_DIALOG_VOICE_IDS")
    voice_ids = _comma_separated_values(configured)
    if len(voice_ids) >= 2:
        return voice_ids
    return _elevenlabs_voice_ids(target_language=target_language)


def select_dialog_speaker_voice_ids(target_language: str) -> tuple[str, str] | None:
    if _configured_tts_provider() != "elevenlabs":
        return None
    dialog_voices = _elevenlabs_dialog_voice_ids(target_language)
    logger.info(
        "content.audio.dialog_voices.provider_check provider=elevenlabs elevenlabs_key=%s elevenlabs_dialog_voice_count=%d target_language=%s",
        bool(str(getattr(settings, "ELEVENLABS_API_KEY", "")).strip()),
        len(dialog_voices),
        target_language,
    )
    if len(dialog_voices) < 2:
        logger.warning("content.audio.dialog_voices.elevenlabs_missing_voices target_language=%s", target_language)
        return None
    voice_a, voice_b = sample(dialog_voices, 2)
    return voice_a, voice_b


def _build_local_audio_url(filename: str) -> str:
    relative_url = f"{settings.MEDIA_URL.rstrip('/')}/audio/{filename}"
    return f"{settings.APP_BASE_URL.rstrip('/')}{relative_url}"


def _build_s3_audio_url(key: str) -> str:
    explicit_base_url = str(getattr(settings, "AWS_S3_AUDIO_BASE_URL", "")).strip().rstrip("/")
    if explicit_base_url:
        normalized_key = key.lstrip("/")
        prefix = str(getattr(settings, "AWS_S3_AUDIO_PREFIX", "audio")).strip().strip("/")
        if prefix:
            base_suffix = f"/{prefix.lower()}"
            key_prefix = f"{prefix.lower()}/"
            if explicit_base_url.lower().endswith(base_suffix) and normalized_key.lower().startswith(key_prefix):
                normalized_key = normalized_key[len(prefix) + 1 :]
        return f"{explicit_base_url}/{normalized_key}"

    bucket = str(getattr(settings, "AWS_S3_AUDIO_BUCKET", "")).strip()
    region = str(getattr(settings, "AWS_S3_AUDIO_REGION", "")).strip()
    if region:
        return f"https://{bucket}.s3.{region}.amazonaws.com/{key}"
    return f"https://{bucket}.s3.amazonaws.com/{key}"


def _store_audio_bytes(filename: str, payload: bytes, content_type: str) -> str:
    storage_backend = str(getattr(settings, "AUDIO_STORAGE_BACKEND", "local")).strip().lower()
    if storage_backend == "s3":
        bucket = str(getattr(settings, "AWS_S3_AUDIO_BUCKET", "")).strip()
        if not bucket:
            logger.warning("content.audio.failed_s3 reason=missing_bucket filename=%s", filename)
            return ""

        prefix = str(getattr(settings, "AWS_S3_AUDIO_PREFIX", "audio")).strip().strip("/")
        key = f"{prefix}/{filename}" if prefix else filename

        try:
            import boto3
        except Exception:
            logger.warning("content.audio.failed_s3 reason=missing_boto3 filename=%s", filename)
            return ""

        s3_client_kwargs: dict[str, str] = {}
        region = str(getattr(settings, "AWS_S3_AUDIO_REGION", "")).strip()
        if region:
            s3_client_kwargs["region_name"] = region

        logger.info(
            "content.audio.s3.upload_started filename=%s bucket=%s key=%s content_type=%s bytes=%d region=%s",
            filename,
            bucket,
            key,
            content_type,
            len(payload),
            region or "default",
        )
        try:
            boto3.client("s3", **s3_client_kwargs).put_object(
                Bucket=bucket,
                Key=key,
                Body=payload,
                ContentType=content_type,
            )
        except Exception as exc:
            logger.warning(
                "content.audio.failed_s3_upload filename=%s bucket=%s key=%s error=%s",
                filename,
                bucket,
                key,
                exc.__class__.__name__,
            )
            return ""

        audio_url = _build_s3_audio_url(key)
        logger.info("content.audio.s3.upload_succeeded filename=%s bucket=%s key=%s", filename, bucket, key)
        return audio_url

    audio_dir = Path(settings.MEDIA_ROOT) / "audio"
    audio_dir.mkdir(parents=True, exist_ok=True)
    file_path = audio_dir / filename
    try:
        file_path.write_bytes(payload)
    except Exception:
        logger.warning("content.audio.failed_write filename=%s", filename)
        return ""
    return _build_local_audio_url(filename)


def create_audio_file(text: str, prefix: str, target_language: str = "german", voice_id: str = "") -> str:
    if not text.strip():
        logger.warning("content.audio.skipped prefix=%s reason=empty_text", prefix)
        return ""

    slug = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    if not slug:
        slug = "audio"
    filename = f"{prefix}-{slug[:32]}-{uuid4().hex[:8]}.mp3"

    default_speed = OPENAI_TTS_PHRASE_DEFAULT_SPEED if prefix == "phrase" else OPENAI_TTS_ITEM_DEFAULT_SPEED
    if voice_id and _configured_tts_provider() == "elevenlabs":
        audio_bytes = _elevenlabs_tts_audio(
            text=text,
            voice_id=voice_id,
            target_language=target_language,
            output_format=str(getattr(settings, "ELEVENLABS_OUTPUT_FORMAT", "mp3_44100_128")),
        )
        voice = f"elevenlabs:{voice_id}"
        if not audio_bytes:
            logger.warning(
                "content.audio.elevenlabs.voice_fallback prefix=%s target_language=%s voice_id=%s",
                prefix,
                target_language,
                voice_id,
            )
            audio_bytes, voice = _item_tts_audio_bytes(
                text=text,
                prefix=prefix,
                target_language=target_language,
                default_speed=default_speed,
            )
    else:
        audio_bytes, voice = _item_tts_audio_bytes(
            text=text,
            prefix=prefix,
            target_language=target_language,
            default_speed=default_speed,
        )
    if not audio_bytes:
        logger.warning("content.audio.failed prefix=%s filename=%s target_language=%s", prefix, filename, target_language)
        return ""
    audio_url = _store_audio_bytes(filename, audio_bytes, content_type="audio/mpeg")
    if not audio_url:
        logger.warning("content.audio.failed_store prefix=%s filename=%s", prefix, filename)
        return ""
    logger.info(
        "content.audio.created prefix=%s filename=%s target_language=%s voice=%s",
        prefix,
        filename,
        target_language,
        voice,
    )
    return audio_url


def _openai_tts_audio(
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
    model = getattr(settings, "OPENAI_TTS_MODEL", "gpt-4o-mini-tts")
    body = {
        "model": model,
        "voice": voice,
        "input": text,
        "speed": speed,
        "response_format": response_format,
    }
    if instructions.strip():
        body["instructions"] = instructions.strip()
    request = UrlRequest(
        "https://api.openai.com/v1/audio/speech",
        data=json.dumps(body).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    timeout_seconds = int(getattr(settings, "OPENAI_TTS_REQUEST_TIMEOUT_SECONDS", 40))
    try:
        with urlopen(request, timeout=timeout_seconds) as response:
            return response.read()
    except (HTTPError, URLError, TimeoutError):
        return None


def _elevenlabs_tts_audio(
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
    language_code = TTS_LANGUAGE_CODE_BY_STUDY_LANGUAGE.get(target_language, target_language[:2].lower())
    body = {
        "text": text,
        "model_id": model_id,
        "language_code": language_code,
    }
    request = UrlRequest(
        f"https://api.elevenlabs.io/v1/text-to-speech/{quote(voice_id)}?output_format={quote(output)}",
        data=json.dumps(body).encode("utf-8"),
        headers={
            "xi-api-key": api_key,
            "Content-Type": "application/json",
        },
        method="POST",
    )
    timeout_seconds = int(getattr(settings, "OPENAI_TTS_REQUEST_TIMEOUT_SECONDS", 40))
    try:
        with urlopen(request, timeout=timeout_seconds) as response:
            return response.read()
    except (HTTPError, URLError, TimeoutError):
        return None


def _item_tts_audio_bytes(*, text: str, prefix: str, target_language: str, default_speed: float) -> tuple[bytes | None, str]:
    if _configured_tts_provider() == "elevenlabs":
        voice_id = _elevenlabs_voice_id(target_language=target_language, kind=prefix, seed=f"{target_language}:{prefix}:{text}")
        audio_bytes = _elevenlabs_tts_audio(
            text=text,
            voice_id=voice_id,
            target_language=target_language,
            output_format=str(getattr(settings, "ELEVENLABS_OUTPUT_FORMAT", "mp3_44100_128")),
        )
        if audio_bytes:
            return audio_bytes, f"elevenlabs:{voice_id}"
        logger.warning("content.audio.elevenlabs.fallback_openai prefix=%s target_language=%s", prefix, target_language)

    voice = OPENAI_TTS_ITEM_VOICE_BY_STUDY_LANGUAGE.get(target_language, "alloy")
    return (
        _openai_tts_audio(
            text=text,
            voice=voice,
            speed=float(getattr(settings, "OPENAI_TTS_ITEM_SPEED", default_speed)),
            response_format="mp3",
            instructions=_tts_language_instruction(target_language),
        ),
        f"openai:{voice}",
    )
