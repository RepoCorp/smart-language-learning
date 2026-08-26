from __future__ import annotations

import logging
from pathlib import Path

from django.conf import settings

from ...languages import (
    OPENAI_TTS_ITEM_VOICE_BY_STUDY_LANGUAGE,
)
from .tts_config import OPENAI_TTS_ITEM_DEFAULT_SPEED, OPENAI_TTS_PHRASE_DEFAULT_SPEED
from .tts_instructions import openai_tts_language_instruction
from .audio_provider import configured_tts_provider, should_use_elevenlabs
from .audio_clients import (
    elevenlabs_tts_audio as _elevenlabs_tts_audio,
    fetch_elevenlabs_voices,
    openai_tts_audio as _openai_tts_audio,
)
from .audio_voices import (
    configured_elevenlabs_voice_ids,
    elevenlabs_voice_id as _elevenlabs_voice_id,
    select_dialog_speaker_voice_ids,
)

logger = logging.getLogger(__name__)
_s3_identity_logged = False

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
    global _s3_identity_logged
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

        if not _s3_identity_logged:
            try:
                session = boto3.Session()
                credentials = session.get_credentials()
                identity = session.client("sts", **s3_client_kwargs).get_caller_identity()
                logger.info(
                    "content.audio.s3.runtime_identity account=%s arn=%s user_id=%s credential_method=%s",
                    identity.get("Account", ""),
                    identity.get("Arn", ""),
                    identity.get("UserId", ""),
                    getattr(credentials, "method", "unknown"),
                )
            except Exception as exc:
                logger.warning("content.audio.s3.runtime_identity_failed error=%s", exc.__class__.__name__)
            _s3_identity_logged = True

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
            error_response = getattr(exc, "response", {})
            error_details = error_response.get("Error", {}) if isinstance(error_response, dict) else {}
            logger.warning(
                "content.audio.failed_s3_upload filename=%s bucket=%s key=%s error=%s code=%s message=%s",
                filename,
                bucket,
                key,
                exc.__class__.__name__,
                error_details.get("Code", ""),
                error_details.get("Message", ""),
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


def _item_tts_audio_bytes(*, text: str, prefix: str, target_language: str, default_speed: float) -> tuple[bytes | None, str]:
    if configured_tts_provider() == "elevenlabs":
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
            instructions=openai_tts_language_instruction(target_language),
        ),
        f"openai:{voice}",
    )


# Audio creation has its own module; re-export these functions so callers keep
# using the stable content.audio API.
from .audio_creation import (  # noqa: E402
    create_audio_data_url,
    create_audio_file,
    create_elevenlabs_audio_file,
    create_openai_audio_file,
)
