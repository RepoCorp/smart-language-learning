from __future__ import annotations

import json
import logging
import time
from dataclasses import dataclass
from urllib.error import HTTPError, URLError
from urllib.request import Request as UrlRequest, urlopen

from django.conf import settings

from ...ai_usage import reserve_ai_usage, settle_ai_usage
from ...models import DailyAIUsage

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class ElevenLabsMusicResult:
    audio_bytes: bytes
    song_id: str = ""


def _music_api_key() -> str:
    return str(getattr(settings, "ELEVENLABS_API_KEY", "")).strip()


def _music_model_id() -> str:
    return str(getattr(settings, "ELEVENLABS_MUSIC_MODEL_ID", "music_v2")).strip() or "music_v2"


def elevenlabs_music_generation(
    *,
    prompt: str | None = None,
    composition_plan: dict | None = None,
    duration_seconds: int | None = None,
    quota_seconds: int | None = None,
    store_for_inpainting: bool = False,
    log_context: str = "",
) -> ElevenLabsMusicResult | None:
    api_key = _music_api_key()
    if not api_key:
        logger.warning("content.audio.elevenlabs_music.request_skipped context=%s reason=missing_api_key", log_context)
        return None
    if bool(prompt) == bool(composition_plan):
        logger.warning("content.audio.elevenlabs_music.invalid_request context=%s reason=provide_prompt_or_plan", log_context)
        return None
    requested_duration = max(3, min(600, int(duration_seconds))) if duration_seconds is not None else None
    usage_seconds = quota_seconds or requested_duration or int(
        getattr(settings, "ELEVENLABS_MUSIC_QUOTA_SECONDS_PER_GENERATION", 15)
    )
    model_id = _music_model_id()
    reservation = reserve_ai_usage(
        provider="elevenlabs",
        category=DailyAIUsage.Category.AUDIO,
        units=usage_seconds,
        model=model_id,
        feature="sing-strategy",
    )
    body = {"model_id": model_id}
    if composition_plan is not None:
        body["composition_plan"] = composition_plan
    else:
        body["prompt"] = prompt
        if requested_duration is not None:
            body["music_length_ms"] = requested_duration * 1000
    if store_for_inpainting:
        body["store_for_inpainting"] = True
    request = UrlRequest(
        "https://api.elevenlabs.io/v1/music?output_format=mp3_44100_128",
        data=json.dumps(body).encode("utf-8"),
        headers={"xi-api-key": api_key, "Content-Type": "application/json"},
        method="POST",
    )
    started_at = time.perf_counter()
    logger.info(
        "content.audio.elevenlabs_music.requested context=%s model=%s request_kind=%s quota_seconds=%s body=%s",
        log_context,
        model_id,
        "composition_plan" if composition_plan is not None else "prompt",
        usage_seconds,
        body,
    )
    try:
        with urlopen(request, timeout=int(getattr(settings, "ELEVENLABS_MUSIC_REQUEST_TIMEOUT_SECONDS", 60))) as response:
            payload = response.read()
            song_id = str(response.headers.get("song-id", "")).strip()
            content_type = str(response.headers.get("content-type", "")).strip()
            request_id = str(response.headers.get("request-id", response.headers.get("x-request-id", ""))).strip()
    except HTTPError as exc:
        settle_ai_usage(reservation, failed=True)
        try:
            response_body = exc.read().decode("utf-8", errors="replace")[:1000]
        except Exception:
            response_body = ""
        logger.warning(
            "content.audio.elevenlabs_music.request_failed context=%s elapsed_ms=%s status=%s reason=%s model=%s response_body=%s",
            log_context,
            round((time.perf_counter() - started_at) * 1000),
            exc.code,
            exc.reason,
            model_id,
            response_body,
        )
        return None
    except (URLError, TimeoutError) as exc:
        settle_ai_usage(reservation, failed=True)
        logger.warning(
            "content.audio.elevenlabs_music.request_failed context=%s elapsed_ms=%s error=%s",
            log_context,
            round((time.perf_counter() - started_at) * 1000),
            exc,
        )
        return None
    settle_ai_usage(reservation)
    if not payload:
        logger.warning("content.audio.elevenlabs_music.empty_response context=%s", log_context)
        return None
    logger.info(
        "content.audio.elevenlabs_music.succeeded context=%s elapsed_ms=%s bytes=%s song_id=%s content_type=%s request_id=%s",
        log_context,
        round((time.perf_counter() - started_at) * 1000),
        len(payload),
        song_id,
        content_type,
        request_id,
    )
    return ElevenLabsMusicResult(audio_bytes=payload, song_id=song_id)


def elevenlabs_music_audio(
    *,
    prompt: str | None = None,
    composition_plan: dict | None = None,
    duration_seconds: int | None = None,
) -> bytes | None:
    result = elevenlabs_music_generation(
        prompt=prompt,
        composition_plan=composition_plan,
        duration_seconds=duration_seconds,
    )
    return result.audio_bytes if result else None
