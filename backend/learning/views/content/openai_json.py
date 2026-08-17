from __future__ import annotations

import json
import logging
import re
from collections.abc import Callable
from uuid import uuid4
from urllib.error import HTTPError, URLError
from urllib.request import Request as UrlRequest, urlopen

from django.conf import settings

from ...ai_usage import reserve_ai_usage, settle_ai_usage
from ...models import DailyAIUsage

logger = logging.getLogger(__name__)

DEFAULT_TEMPERATURE = 1.0
DEFAULT_TOP_P = 1.0
DEFAULT_PRESENCE_PENALTY = 0.0


def _supports_custom_sampling(model_name: str) -> bool:
    return (model_name or "").strip().lower() != "gpt-5.6-sol"


def call_openai_json(
    system_prompt: str,
    user_input: str,
    timeout_seconds: int = 10,
    *,
    model: str | None = None,
    reasoning_effort: str | None = None,
    temperature: float = 0.2,
    top_p: float = 1.0,
    presence_penalty: float = 0.0,
    json_mode: bool = False,
    urlopen_fn: Callable[..., object] | None = None,
) -> dict | list | None:
    call_id = uuid4().hex[:10]
    api_key = settings.OPENAI_API_KEY
    if not api_key:
        logger.warning("content.generate.chatgpt.skipped reason=missing_api_key")
        return None
    model_name = str(model or settings.OPENAI_MODEL).strip() or settings.OPENAI_MODEL
    effective_timeout = max(timeout_seconds, int(getattr(settings, "OPENAI_REQUEST_TIMEOUT_SECONDS", 30)))
    body: dict[str, object] = {
        "model": model_name,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_input},
        ],
    }
    if json_mode:
        body["response_format"] = {"type": "json_object"}
    if _supports_custom_sampling(model_name):
        body.update({"temperature": temperature, "top_p": top_p, "presence_penalty": presence_penalty})
    else:
        _log_omitted_sampling(call_id, model_name, temperature, top_p, presence_penalty)
    if normalized_reasoning_effort := str(reasoning_effort or "").strip():
        body["reasoning_effort"] = normalized_reasoning_effort

    request = UrlRequest(
        "https://api.openai.com/v1/chat/completions",
        data=json.dumps(body).encode("utf-8"),
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        method="POST",
    )
    opener = urlopen_fn or urlopen
    reservation = reserve_ai_usage(
        provider="openai",
        category=DailyAIUsage.Category.TEXT,
        units=1,
        model=model_name,
        feature="text-generation",
    )
    try:
        with opener(request, timeout=effective_timeout) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError) as exc:
        settle_ai_usage(reservation, failed=True)
        _log_request_failure(call_id, model_name, exc)
        return None

    usage = payload.get("usage") if isinstance(payload, dict) else {}
    usage = usage if isinstance(usage, dict) else {}
    settle_ai_usage(
        reservation,
        input_tokens=int(usage.get("prompt_tokens", 0) or 0),
        output_tokens=int(usage.get("completion_tokens", 0) or 0),
    )

    logger.info("content.generate.chatgpt.raw_response call_id=%s model=%s payload=%s", call_id, model_name, json.dumps(payload, ensure_ascii=False))
    try:
        content = payload["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError, json.JSONDecodeError) as exc:
        logger.warning("content.generate.chatgpt.parse_failed call_id=%s model=%s error=%s payload=%s", call_id, model_name, exc.__class__.__name__, json.dumps(payload, ensure_ascii=False))
        return None

    logger.info("content.generate.chatgpt.content call_id=%s model=%s content=%s", call_id, model_name, content)
    try:
        parsed = extract_json_from_text(content)
    except json.JSONDecodeError:
        logger.warning("content.generate.chatgpt.invalid_json call_id=%s model=%s content=%s", call_id, model_name, content)
        return None
    logger.info("content.generate.chatgpt.parsed call_id=%s model=%s parsed=%s", call_id, model_name, json.dumps(parsed, ensure_ascii=False))
    return parsed


def _log_omitted_sampling(
    call_id: str,
    model_name: str,
    temperature: float,
    top_p: float,
    presence_penalty: float,
) -> None:
    for param, requested, default in (
        ("temperature", temperature, DEFAULT_TEMPERATURE),
        ("top_p", top_p, DEFAULT_TOP_P),
        ("presence_penalty", presence_penalty, DEFAULT_PRESENCE_PENALTY),
    ):
        if requested != default:
            logger.info("content.generate.chatgpt.sampling_omitted call_id=%s model=%s param=%s requested=%s", call_id, model_name, param, requested)


def _log_request_failure(call_id: str, model_name: str, exc: Exception) -> None:
    details: dict[str, object] = {
        "error_class": exc.__class__.__name__,
        "error_text": str(exc),
        "error_repr": repr(exc),
    }
    if isinstance(exc, HTTPError):
        try:
            response_body = exc.read().decode("utf-8", errors="replace")
        except Exception:
            response_body = ""
        details.update({
            "http_status": exc.code,
            "http_reason": exc.reason,
            "http_headers": dict(exc.headers.items()) if getattr(exc, "headers", None) else {},
            "http_url": exc.geturl(),
            "http_response_body": response_body,
        })
    elif isinstance(exc, URLError):
        details["url_error_reason"] = str(getattr(exc, "reason", ""))
    logger.warning("content.generate.chatgpt.request_failed call_id=%s model=%s error_details=%s", call_id, model_name, json.dumps(details, ensure_ascii=False))


def extract_json_from_text(content: str) -> dict | list:
    stripped = content.strip()
    if (stripped.startswith("{") and stripped.endswith("}")) or (
        stripped.startswith("[") and stripped.endswith("]")
    ):
        return json.loads(stripped)
    match = re.search(r"(?:\{.*\}|\[.*\])", stripped, flags=re.DOTALL)
    if not match:
        raise json.JSONDecodeError("No JSON object or array found", content, 0)
    return json.loads(match.group(0))
