from __future__ import annotations

import json
import logging
import re
from difflib import SequenceMatcher
from random import choice
from urllib.error import HTTPError, URLError
from urllib.request import Request as UrlRequest, urlopen

from django.conf import settings

from ...models import ConversationFingerprint
from ...prompts import CONVERSATION_GENERATION_PROMPT, PHRASE_KEYWORDS_PROMPT

logger = logging.getLogger(__name__)
STYLE_SEEDS = ("casual", "polite", "urgent", "friendly", "problem-solving", "small-talk")
MAX_RECENT_FINGERPRINTS = 10
SIMILARITY_THRESHOLD = 0.75
COMMON_WORDS = {
    "a",
    "al",
    "algo",
    "all",
    "are",
    "con",
    "como",
    "das",
    "de",
    "del",
    "der",
    "die",
    "el",
    "en",
    "es",
    "esta",
    "estoy",
    "etwas",
    "for",
    "hay",
    "ich",
    "la",
    "las",
    "los",
    "mein",
    "meine",
    "mi",
    "mis",
    "no",
    "por",
    "que",
    "se",
    "si",
    "sie",
    "the",
    "to",
    "tu",
    "und",
    "una",
    "uno",
    "wir",
    "y",
    "yo",
}
GREETING_HINTS = {"greeting", "greetings", "saludo", "saludos", "hello", "hola", "reunion", "reunión"}
STUDY_LANGUAGE_LABELS = {
    "spanish": "Spanish",
    "english": "English",
    "german": "German",
    "french": "French",
    "italian": "Italian",
    "portuguese": "Portuguese",
}


def call_openai_json(
    system_prompt: str,
    user_input: str,
    timeout_seconds: int = 10,
    *,
    temperature: float = 0.2,
    top_p: float = 1.0,
    presence_penalty: float = 0.0,
) -> dict | None:
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


def _normalize_text(value: str) -> str:
    lowered = value.lower()
    cleaned = re.sub(r"[^\w\s]", " ", lowered, flags=re.UNICODE)
    return " ".join(cleaned.split())


def _language_label(code: str) -> str:
    return STUDY_LANGUAGE_LABELS.get(code, code.capitalize())


def _extract_keywords(text: str) -> list[str]:
    normalized = _normalize_text(text)
    if not normalized:
        return []
    words = [token for token in normalized.split() if len(token) > 2 and token not in COMMON_WORDS]
    ordered_unique: list[str] = []
    seen: set[str] = set()
    for word in words:
        if word in seen:
            continue
        seen.add(word)
        ordered_unique.append(word)
    return ordered_unique


def _conversation_fingerprint(phrases: list[dict[str, str]]) -> tuple[str, list[str], str]:
    first_line = _normalize_text(phrases[0]["spanish_text"]) if phrases else ""
    merged = " ".join(phrase["spanish_text"] for phrase in phrases)
    keywords = _extract_keywords(merged)[:14]
    serialized = f"{first_line} || {' '.join(keywords)}".strip()
    return first_line, keywords, serialized


def _load_recent_fingerprints(limit: int = MAX_RECENT_FINGERPRINTS) -> list[dict[str, object]]:
    try:
        records = ConversationFingerprint.objects.order_by("-created_at")[:limit]
    except Exception as exc:  # pragma: no cover - defensive for migration drift
        logger.warning("content.generate.fingerprint.load_failed error=%s", exc.__class__.__name__)
        return []
    result: list[dict[str, object]] = []
    for record in records:
        keywords = [word for word in record.keywords.split(",") if word]
        result.append({"first_line": record.first_line, "keywords": keywords, "fingerprint": record.fingerprint})
    return result


def _save_fingerprint(first_line: str, keywords: list[str], fingerprint: str) -> None:
    if not fingerprint:
        return
    try:
        ConversationFingerprint.objects.create(
            first_line=first_line[:255],
            keywords=",".join(keywords)[:500],
            fingerprint=fingerprint,
        )
        stale_ids = list(
            ConversationFingerprint.objects.order_by("-created_at").values_list("id", flat=True)[MAX_RECENT_FINGERPRINTS:]
        )
        if stale_ids:
            ConversationFingerprint.objects.filter(id__in=stale_ids).delete()
    except Exception as exc:  # pragma: no cover - defensive for migration drift
        logger.warning("content.generate.fingerprint.save_failed error=%s", exc.__class__.__name__)


def _build_recent_patterns_block(recent: list[dict[str, object]]) -> str:
    if not recent:
        return "No recent examples."
    lines: list[str] = []
    for index, sample in enumerate(recent, start=1):
        first_line = str(sample.get("first_line", "")).strip()
        keywords = " ".join(str(token) for token in sample.get("keywords", []))
        lines.append(f"{index}. {first_line} | {keywords}".strip())
    return "\n".join(lines)


def _allows_greeting(topic: str, context: str) -> bool:
    merged = _normalize_text(f"{topic} {context}")
    words = set(merged.split())
    return bool(words.intersection(GREETING_HINTS))


def _similarity_against_recent(first_line: str, keywords: list[str], recent: list[dict[str, object]]) -> float:
    if not recent:
        return 0.0
    keyword_set = set(keywords)
    max_score = 0.0
    for sample in recent:
        sample_first = _normalize_text(str(sample.get("first_line", "")))
        sample_keywords = {str(word).strip() for word in sample.get("keywords", []) if str(word).strip()}
        line_score = SequenceMatcher(None, first_line, sample_first).ratio() if first_line and sample_first else 0.0
        if keyword_set and sample_keywords:
            overlap = len(keyword_set.intersection(sample_keywords))
            keyword_score = overlap / len(keyword_set.union(sample_keywords))
        else:
            keyword_score = 0.0
        score = (line_score * 0.6) + (keyword_score * 0.4)
        if score > max_score:
            max_score = score
    return max_score


def _has_consecutive_lexical_repetition(phrases: list[dict[str, str]]) -> bool:
    previous_terms: set[str] = set()
    for phrase in phrases:
        current_terms = set(_extract_keywords(phrase["spanish_text"]))
        if previous_terms and current_terms and len(previous_terms.intersection(current_terms)) >= 2:
            return True
        previous_terms = current_terms
    return False


def _is_monotonous(phrases: list[dict[str, str]]) -> bool:
    if len(phrases) < 4:
        return False
    starters = []
    for phrase in phrases:
        normalized = _normalize_text(phrase["spanish_text"])
        starters.append(" ".join(normalized.split()[:2]))
    repeated = len(starters) - len(set(starters))
    return repeated >= len(phrases) // 2


def _validate_conversation(
    phrases: list[dict[str, str]],
    topic: str,
    context: str,
    recent: list[dict[str, object]],
) -> tuple[bool, str]:
    if not phrases:
        return False, "empty"
    first_line, keywords, _ = _conversation_fingerprint(phrases)
    if first_line.startswith("hola como estas") and not _allows_greeting(topic, context):
        return False, "overused_greeting_start"
    if _has_consecutive_lexical_repetition(phrases):
        return False, "consecutive_lexical_repetition"
    if _is_monotonous(phrases):
        return False, "monotonous_turn_starters"
    similarity = _similarity_against_recent(first_line, keywords, recent)
    if similarity >= SIMILARITY_THRESHOLD:
        return False, "too_similar_to_recent"
    return True, "ok"


def _build_conversation_prompt(
    topic: str,
    context: str,
    source_language: str,
    target_language: str,
    style_seed: str,
    recent_patterns: list[dict[str, object]],
    retry_hint: str = "",
) -> str:
    normalized_context = " ".join(context.split()).strip()
    context_value = normalized_context or "not provided"
    situation_detail = normalized_context or "not provided"
    parts = [
        f"Topic: {topic}",
        f"Context: {context_value}",
        f"Situation detail: {situation_detail}",
        (
            "Language mapping: use 'source_text' for "
            f"{_language_label(source_language)} and 'target_text' for {_language_label(target_language)}."
        ),
        f"Style seed: {style_seed}",
        "Variety constraints: avoid overused templates and avoid reusing the same key verb/noun in consecutive turns unless necessary.",
        "Recent conversation fingerprints to avoid:",
        _build_recent_patterns_block(recent_patterns),
    ]
    if retry_hint:
        parts.append(f"Retry instruction: {retry_hint}")
    return "\n".join(parts)


def generate_conversation_with_chatgpt(
    topic: str,
    context: str = "",
    source_language: str = "spanish",
    target_language: str = "german",
) -> list[dict[str, str]] | None:
    style_seed = choice(STYLE_SEEDS)
    recent_patterns = _load_recent_fingerprints()
    retry_hint = "more variation, same topic and level"

    for attempt in range(2):
        parsed = call_openai_json(
            CONVERSATION_GENERATION_PROMPT,
            _build_conversation_prompt(
                topic=topic,
                context=context,
                source_language=source_language,
                target_language=target_language,
                style_seed=style_seed,
                recent_patterns=recent_patterns,
                retry_hint=retry_hint if attempt == 1 else "",
            ),
            timeout_seconds=15,
            temperature=0.9,
            top_p=0.9,
            presence_penalty=0.6,
        )
        if parsed is None:
            continue

        conversation = parsed.get("conversation", [])
        if not isinstance(conversation, list) or not conversation:
            logger.warning("content.generate.conversation.invalid_payload topic=%s", topic)
            continue

        phrases: list[dict[str, str]] = []
        for phrase in conversation:
            if not isinstance(phrase, dict):
                continue
            source_text = str(phrase.get("source_text", phrase.get("spanish_text", ""))).strip()
            target_text = str(phrase.get("target_text", phrase.get("german_text", ""))).strip()
            notes = str(phrase.get("notes", "")).strip()
            if not source_text or not target_text:
                continue
            phrases.append(
                {
                    "spanish_text": source_text,
                    "german_text": target_text,
                    "notes": notes,
                }
            )

        if not phrases:
            logger.warning("content.generate.conversation.empty_after_clean topic=%s", topic)
            continue

        is_valid, reason = _validate_conversation(phrases, topic=topic, context=context, recent=recent_patterns)
        if not is_valid:
            logger.info(
                "content.generate.conversation.validation_failed topic=%s attempt=%d reason=%s",
                topic,
                attempt + 1,
                reason,
            )
            continue

        first_line, keywords, serialized = _conversation_fingerprint(phrases)
        _save_fingerprint(first_line=first_line, keywords=keywords, fingerprint=serialized)
        logger.info(
            "content.generate.conversation.received topic=%s style=%s conversation=%s",
            topic,
            style_seed,
            json.dumps(phrases, ensure_ascii=False),
        )
        logger.info("content.generate.conversation.success topic=%s phrases=%d", topic, len(phrases))
        return phrases

    logger.warning("content.generate.conversation.exhausted_retries topic=%s", topic)
    return None


def generate_keywords_for_phrase_with_chatgpt(
    spanish_phrase: str,
    german_phrase: str,
    source_language: str = "spanish",
    target_language: str = "german",
) -> list[dict[str, str]] | None:
    article_requirement = (
        "For german_text, include article and singular form (e.g., 'der Park')."
        if target_language == "german"
        else "Do not force articles in german_text unless natural for the selected target language."
    )
    parsed = call_openai_json(
        PHRASE_KEYWORDS_PROMPT,
        (
            f"Source language ({_language_label(source_language)}) phrase in source_text: {spanish_phrase}\n"
            f"Target language ({_language_label(target_language)}) phrase in target_text: {german_phrase}\n"
            f"{article_requirement}"
        ),
        temperature=0.5,
        top_p=0.9,
        presence_penalty=0.2,
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
        spanish_word = str(keyword.get("source_text", keyword.get("spanish_text", ""))).strip()
        german_word = str(keyword.get("target_text", keyword.get("german_text", ""))).strip()
        keyword_notes = str(keyword.get("notes", "")).strip()
        plural_german = str(keyword.get("plural_target", keyword.get("plural_german", ""))).strip()
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
    keywords = (
        generate_keywords_for_phrase_with_chatgpt(
            spanish_text,
            german_text,
            source_language=source_language,
            target_language=target_language,
        )
        or []
    )
    return spanish_text, german_text, notes, keywords


def extract_json_from_text(content: str) -> dict:
    stripped = content.strip()
    if stripped.startswith("{") and stripped.endswith("}"):
        return json.loads(stripped)

    match = re.search(r"\{.*\}", stripped, flags=re.DOTALL)
    if not match:
        raise json.JSONDecodeError("No JSON object found", content, 0)
    return json.loads(match.group(0))
