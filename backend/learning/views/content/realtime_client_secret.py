from __future__ import annotations

import hashlib
import json
import logging
import time
from urllib.error import HTTPError, URLError
from urllib.request import Request as UrlRequest, urlopen

from django.conf import settings
from rest_framework.request import Request

from ...ai_usage import reserve_ai_usage, settle_ai_usage
from ...auth import get_request_user
from ...models import DailyAIUsage

logger = logging.getLogger(__name__)


def build_realtime_safety_identifier(request: Request) -> str:
    user = get_request_user(request)
    if user is None:
        return "anonymous"
    raw_identifier = f"user:{getattr(user, 'id', '')}:{getattr(user, 'username', '')}"
    return hashlib.sha256(raw_identifier.encode("utf-8")).hexdigest()


def create_realtime_client_secret(*, request: Request, instructions: str) -> dict[str, object]:
    api_key = str(getattr(settings, "OPENAI_API_KEY", "")).strip()
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is not configured")

    model = str(getattr(settings, "OPENAI_REALTIME_MODEL", "gpt-realtime-2.1")).strip() or "gpt-realtime-2.1"
    voice = str(getattr(settings, "OPENAI_REALTIME_VOICE", "marin")).strip() or "marin"
    transcription_model = (
        str(getattr(settings, "OPENAI_REALTIME_TRANSCRIPTION_MODEL", "gpt-4o-mini-transcribe")).strip()
        or "gpt-4o-mini-transcribe"
    )
    payload = {
        "session": {
            "type": "realtime",
            "model": model,
            "instructions": instructions,
            "audio": {
                "input": {"transcription": {"model": transcription_model}},
                "output": {"voice": voice},
            },
        }
    }
    logger.info(
        "content.topic_conversation.realtime_client_secret_started model=%s voice=%s transcription_model=%s instructions_length=%s",
        model,
        voice,
        transcription_model,
        len(instructions),
    )
    reservation = reserve_ai_usage(
        provider="openai",
        category=DailyAIUsage.Category.TEXT,
        units=1,
        model=model,
        feature="realtime-session",
    )
    started_at = time.perf_counter()
    request_data = UrlRequest(
        "https://api.openai.com/v1/realtime/client_secrets",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "OpenAI-Safety-Identifier": build_realtime_safety_identifier(request),
        },
        method="POST",
    )
    try:
        with urlopen(request_data, timeout=int(getattr(settings, "OPENAI_REQUEST_TIMEOUT_SECONDS", 30))) as response:
            response_payload = json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        settle_ai_usage(reservation, failed=True)
        try:
            response_body = exc.read().decode("utf-8", errors="replace")
            response_detail = str(json.loads(response_body).get("error", {}).get("message", "")).strip()
        except Exception:
            response_body = ""
            response_detail = ""
        logger.warning(
            "content.topic_conversation.realtime_client_secret_failed error_class=%s status=%s elapsed_ms=%s body=%s",
            exc.__class__.__name__,
            getattr(exc, "code", ""),
            int((time.perf_counter() - started_at) * 1000),
            response_body[:1000],
        )
        message = "Could not create Realtime session"
        if response_detail:
            message = f"{message}: {response_detail}"
        raise RuntimeError(message) from exc
    except (URLError, TimeoutError, json.JSONDecodeError) as exc:
        settle_ai_usage(reservation, failed=True)
        logger.warning(
            "content.topic_conversation.realtime_client_secret_failed error_class=%s elapsed_ms=%s",
            exc.__class__.__name__,
            int((time.perf_counter() - started_at) * 1000),
        )
        raise RuntimeError("Could not create Realtime session") from exc

    settle_ai_usage(reservation)
    logger.info(
        "content.topic_conversation.realtime_client_secret_succeeded model=%s voice=%s elapsed_ms=%s",
        model,
        voice,
        int((time.perf_counter() - started_at) * 1000),
    )
    return response_payload
