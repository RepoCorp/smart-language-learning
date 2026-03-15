from __future__ import annotations

import json
import logging
import re
from urllib.error import HTTPError, URLError
from urllib.request import Request as UrlRequest, urlopen

from django.conf import settings

from ...prompts import CONVERSATION_GENERATION_PROMPT, PHRASE_KEYWORDS_PROMPT

logger = logging.getLogger(__name__)


def call_openai_json(system_prompt: str, user_input: str, timeout_seconds: int = 10) -> dict | None:
    api_key = settings.OPENAI_API_KEY
    if not api_key:
        logger.warning("content.generate.chatgpt.skipped reason=missing_api_key")
        return None

    body = {
        "model": settings.OPENAI_MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_input},
        ],
        "temperature": 0.2,
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
        with urlopen(request, timeout=timeout_seconds) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError) as exc:
        logger.warning("content.generate.chatgpt.request_failed error=%s", exc.__class__.__name__)
        return None

    try:
        content = payload["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError, json.JSONDecodeError) as exc:
        logger.warning("content.generate.chatgpt.parse_failed error=%s", exc.__class__.__name__)
        return None

    try:
        return extract_json_from_text(content)
    except json.JSONDecodeError:
        logger.warning("content.generate.chatgpt.invalid_json")
        return None


def generate_conversation_with_chatgpt(topic: str, context: str = "") -> list[dict[str, str]] | None:
    user_input = f"Topic: {topic}"
    if context:
        user_input = f"{user_input}\nContext: {context}"
    parsed = call_openai_json(
        CONVERSATION_GENERATION_PROMPT,
        user_input,
        timeout_seconds=15,
    )
    if parsed is None:
        return None

    conversation = parsed.get("conversation", [])
    if not isinstance(conversation, list) or not conversation:
        logger.warning("content.generate.conversation.invalid_payload topic=%s", topic)
        return None

    phrases: list[dict[str, str]] = []
    for phrase in conversation:
        if not isinstance(phrase, dict):
            continue
        spanish_text = str(phrase.get("spanish_text", "")).strip()
        german_text = str(phrase.get("german_text", "")).strip()
        notes = str(phrase.get("notes", "")).strip()
        if not spanish_text or not german_text:
            continue
        phrases.append(
            {
                "spanish_text": spanish_text,
                "german_text": german_text,
                "notes": notes,
            }
        )

    if not phrases:
        logger.warning("content.generate.conversation.empty_after_clean topic=%s", topic)
        return None

    logger.info(
        "content.generate.conversation.received topic=%s conversation=%s",
        topic,
        json.dumps(phrases, ensure_ascii=False),
    )
    logger.info("content.generate.conversation.success topic=%s phrases=%d", topic, len(phrases))
    return phrases


def generate_keywords_for_phrase_with_chatgpt(spanish_phrase: str, german_phrase: str) -> list[dict[str, str]] | None:
    parsed = call_openai_json(
        PHRASE_KEYWORDS_PROMPT,
        f"Spanish phrase: {spanish_phrase}\nGerman phrase: {german_phrase}",
    )
    if parsed is None:
        return None

    keywords = parsed.get("keywords", [])
    if not isinstance(keywords, list):
        logger.warning("content.generate.keywords.invalid_payload spanish=%s", spanish_phrase)
        return None

    cleaned_keywords: list[dict[str, str]] = []
    for keyword in keywords:
        if not isinstance(keyword, dict):
            continue
        spanish_word = str(keyword.get("spanish_text", "")).strip()
        german_word = str(keyword.get("german_text", "")).strip()
        keyword_notes = str(keyword.get("notes", "")).strip()
        plural_german = str(keyword.get("plural_german", "")).strip()
        if not spanish_word or not german_word:
            continue
        cleaned_keywords.append(
            {
                "spanish_text": spanish_word,
                "german_text": german_word,
                "notes": keyword_notes,
                "plural_german": plural_german,
            }
        )

    logger.info(
        "content.generate.keywords.success spanish=%s keywords=%d",
        spanish_phrase,
        len(cleaned_keywords),
    )
    return cleaned_keywords


def generate_content_with_chatgpt(topic: str, context: str = "") -> tuple[str, str, str, list[dict[str, str]]] | None:
    conversation = generate_conversation_with_chatgpt(topic, context=context)
    if not conversation:
        return None
    first = conversation[0]
    spanish_text = first["spanish_text"]
    german_text = first["german_text"]
    notes = first.get("notes", "")
    keywords = generate_keywords_for_phrase_with_chatgpt(spanish_text, german_text) or []
    return spanish_text, german_text, notes, keywords


def extract_json_from_text(content: str) -> dict:
    stripped = content.strip()
    if stripped.startswith("{") and stripped.endswith("}"):
        return json.loads(stripped)

    match = re.search(r"\{.*\}", stripped, flags=re.DOTALL)
    if not match:
        raise json.JSONDecodeError("No JSON object found", content, 0)
    return json.loads(match.group(0))
