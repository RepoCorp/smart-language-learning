from __future__ import annotations

import json
import logging
import re
from random import choice
from uuid import uuid4
from urllib.error import HTTPError, URLError
from urllib.request import Request as UrlRequest, urlopen

from django.conf import settings

from . import generation_conversation as _conversation
from . import generation_words as _words

logger = logging.getLogger(__name__)


def call_openai_json(
    system_prompt: str,
    user_input: str,
    timeout_seconds: int = 10,
    *,
    model: str | None = None,
    temperature: float = 0.2,
    top_p: float = 1.0,
    presence_penalty: float = 0.0,
) -> dict | None:
    call_id = uuid4().hex[:10]
    api_key = settings.OPENAI_API_KEY
    if not api_key:
        logger.warning("content.generate.chatgpt.skipped reason=missing_api_key")
        return None
    model_name = str(model or settings.OPENAI_MODEL).strip() or settings.OPENAI_MODEL

    configured_timeout = int(getattr(settings, "OPENAI_REQUEST_TIMEOUT_SECONDS", 30))
    effective_timeout = max(timeout_seconds, configured_timeout)
    body = {
        "model": model_name,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_input},
        ],
        "temperature": temperature,
        "top_p": top_p,
        "presence_penalty": presence_penalty,
    }

    request = UrlRequest(
        "https://api.openai.com/v1/chat/completions",
        data=json.dumps(body).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with urlopen(request, timeout=effective_timeout) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError) as exc:
        error_details: dict[str, object] = {
            "error_class": exc.__class__.__name__,
            "error_text": str(exc),
            "error_repr": repr(exc),
        }
        response_body = ""
        if isinstance(exc, HTTPError):
            try:
                response_body = exc.read().decode("utf-8", errors="replace")
            except Exception:
                response_body = ""
            error_details.update(
                {
                    "http_status": exc.code,
                    "http_reason": exc.reason,
                    "http_headers": dict(exc.headers.items()) if getattr(exc, "headers", None) else {},
                    "http_url": exc.geturl(),
                    "http_response_body": response_body,
                }
            )
        elif isinstance(exc, URLError):
            error_details["url_error_reason"] = str(getattr(exc, "reason", ""))

        logger.warning(
            "content.generate.chatgpt.request_failed call_id=%s model=%s error_details=%s",
            call_id,
            body["model"],
            json.dumps(error_details, ensure_ascii=False),
        )
        return None

    logger.info(
        "content.generate.chatgpt.raw_response call_id=%s model=%s payload=%s",
        call_id,
        body["model"],
        json.dumps(payload, ensure_ascii=False),
    )

    try:
        content = payload["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError, json.JSONDecodeError) as exc:
        logger.warning(
            "content.generate.chatgpt.parse_failed call_id=%s model=%s error=%s payload=%s",
            call_id,
            body["model"],
            exc.__class__.__name__,
            json.dumps(payload, ensure_ascii=False),
        )
        return None

    logger.info(
        "content.generate.chatgpt.content call_id=%s model=%s content=%s",
        call_id,
        body["model"],
        content,
    )

    try:
        parsed = extract_json_from_text(content)
    except json.JSONDecodeError:
        logger.warning(
            "content.generate.chatgpt.invalid_json call_id=%s model=%s content=%s",
            call_id,
            body["model"],
            content,
        )
        return None
    logger.info(
        "content.generate.chatgpt.parsed call_id=%s model=%s parsed=%s",
        call_id,
        body["model"],
        json.dumps(parsed, ensure_ascii=False),
    )
    return parsed


def generate_word_exercise_phrases_with_chatgpt(
    spanish_word: str,
    german_word: str,
    notes: str = "",
    word_type: str = "",
    source_language: str = "spanish",
    target_language: str = "german",
) -> dict:
    return _words.generate_word_exercise_phrases_with_chatgpt(
        spanish_word,
        german_word,
        notes=notes,
        word_type=word_type,
        source_language=source_language,
        target_language=target_language,
        call_openai_json_fn=call_openai_json,
    )


def generate_funny_image_exercise_phrase_with_chatgpt(
    source_word: str,
    target_word: str,
    notes: str = "",
    word_type: str = "",
    source_language: str = "spanish",
    target_language: str = "german",
) -> dict:
    return _words.generate_funny_image_exercise_phrase_with_chatgpt(
        source_word,
        target_word,
        notes=notes,
        word_type=word_type,
        source_language=source_language,
        target_language=target_language,
        call_openai_json_fn=call_openai_json,
    )


def generate_conversation_with_chatgpt(
    topic: str,
    context: str = "",
    conversation_details: str = "",
    source_language: str = "spanish",
    target_language: str = "german",
) -> list[dict[str, str]] | None:
    return _conversation.generate_conversation_with_chatgpt(
        topic,
        context=context,
        conversation_details=conversation_details,
        source_language=source_language,
        target_language=target_language,
        call_openai_json_fn=call_openai_json,
        choice_fn=choice,
    )


def generate_keywords_for_phrase_with_chatgpt(
    spanish_phrase: str,
    german_phrase: str,
    source_language: str = "spanish",
    target_language: str = "german",
) -> list[dict[str, str]] | None:
    return _words.generate_keywords_for_phrase_with_chatgpt(
        spanish_phrase,
        german_phrase,
        source_language=source_language,
        target_language=target_language,
        call_openai_json_fn=call_openai_json,
    )


def generate_content_with_chatgpt(
    topic: str,
    context: str = "",
    source_language: str = "spanish",
    target_language: str = "german",
) -> tuple[str, str, str, list[dict[str, str]]] | None:
    conversation = generate_conversation_with_chatgpt(
        topic,
        context=context,
        source_language=source_language,
        target_language=target_language,
    )
    if not conversation:
        return None
    first = conversation[0]
    spanish_text = first["spanish_text"]
    german_text = first["german_text"]
    notes = first.get("notes", "")
    return spanish_text, german_text, notes, []


def extract_json_from_text(content: str) -> dict:
    stripped = content.strip()
    if stripped.startswith("{") and stripped.endswith("}"):
        return json.loads(stripped)

    match = re.search(r"\{.*\}", stripped, flags=re.DOTALL)
    if not match:
        raise json.JSONDecodeError("No JSON object found", content, 0)
    return json.loads(match.group(0))
