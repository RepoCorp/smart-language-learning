from __future__ import annotations

import json
import logging
import re
from difflib import SequenceMatcher
from uuid import uuid4

from ...models import ConversationFingerprint
from ...prompts import CONVERSATION_GENERATION_PROMPT

logger = logging.getLogger(__name__)
STYLE_SEEDS = ("casual", "polite", "urgent", "friendly", "problem-solving", "small-talk")
MAX_RECENT_FINGERPRINTS = 10
SIMILARITY_THRESHOLD = 0.75
COMMON_WORDS = {
    "a", "al", "algo", "all", "are", "con", "como", "das", "de", "del", "der", "die", "el", "en", "es",
    "esta", "estoy", "etwas", "for", "hay", "ich", "la", "las", "los", "mein", "meine", "mi", "mis", "no",
    "por", "que", "se", "si", "sie", "the", "to", "tu", "und", "una", "uno", "wir", "y", "yo",
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


def _normalize_text(value: str) -> str:
    lowered = value.lower()
    cleaned = re.sub(r"[^\w\s]", " ", lowered, flags=re.UNICODE)
    return " ".join(cleaned.split())


def _normalize_speaker(value, default_index: int) -> str:
    raw = str(value or "").strip().lower()
    if raw in {"a", "speaker_a", "person_a", "1", "first"}:
        return "a"
    if raw in {"b", "speaker_b", "person_b", "2", "second"}:
        return "b"
    return "a" if default_index % 2 == 0 else "b"


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
    except Exception as exc:  # pragma: no cover
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
    except Exception as exc:  # pragma: no cover
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


def _recent_keyword_counts(recent: list[dict[str, object]]) -> dict[str, int]:
    counts: dict[str, int] = {}
    for sample in recent:
        for token in sample.get("keywords", []):
            word = str(token).strip().lower()
            if not word:
                continue
            counts[word] = counts.get(word, 0) + 1
    return counts


def _select_overused_anchors(
    *,
    topic: str,
    context: str,
    recent: list[dict[str, object]],
    max_terms: int = 8,
) -> list[str]:
    counts = _recent_keyword_counts(recent)
    if not counts:
        return []

    topic_words = set(_extract_keywords(f"{topic} {context}"))
    ranked = sorted(counts.items(), key=lambda item: (-item[1], item[0]))
    selected: list[str] = []
    for word, count in ranked:
        if count < 2:
            continue
        if word in topic_words:
            continue
        selected.append(word)
        if len(selected) >= max_terms:
            break
    return selected


def _scenario_novelty_score(scenario: str, recent: list[dict[str, object]]) -> float:
    scenario_keywords = set(_extract_keywords(scenario))
    if not scenario_keywords:
        return 0.0
    max_overlap = 0.0
    for sample in recent:
        sample_keywords = {str(token).strip().lower() for token in sample.get("keywords", []) if str(token).strip()}
        if not sample_keywords:
            continue
        overlap = len(scenario_keywords.intersection(sample_keywords))
        union = len(scenario_keywords.union(sample_keywords))
        overlap_ratio = (overlap / union) if union else 0.0
        if overlap_ratio > max_overlap:
            max_overlap = overlap_ratio
    # Higher is better; maximize novelty by minimizing overlap.
    return 1.0 - max_overlap


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
    conversation_details: str,
    scenario_description: str,
    source_language: str,
    target_language: str,
    style_seed: str,
    creativity_seed: str,
    recent_patterns: list[dict[str, object]],
    overused_anchors: list[str],
    retry_hint: str = "",
) -> str:
    normalized_context = " ".join(context.split()).strip()
    normalized_details = " ".join(conversation_details.split()).strip()
    context_value = normalized_context or "not provided"
    situation_detail = normalized_context or "not provided"
    parts = [
        f"Topic: {topic}",
        f"Context: {context_value}",
        f"Selected scenario: {scenario_description}",
        f"Situation detail: {situation_detail}",
        f"Extra user details (temporary, do not treat as saved context): {normalized_details or 'not provided'}",
        (
            "Language mapping: use 'source_text' for "
            f"{_language_label(source_language)} and 'target_text' for {_language_label(target_language)}."
        ),
        f"Style seed: {style_seed}",
        f"Variation seed: {creativity_seed}",
        "Conversation style: practical, common real-life wording first; add light variation without unusual twists.",
        "If extra user details are provided, they must be clearly reflected in at least two turns.",
        "Variety constraints: avoid overused templates and avoid reusing the same key verb/noun in consecutive turns unless necessary.",
        "Recent conversation fingerprints to avoid:",
        _build_recent_patterns_block(recent_patterns),
    ]
    if overused_anchors:
        parts.append(
            "Avoid reusing these overused concrete anchors unless strictly required by the topic/context: "
            + ", ".join(overused_anchors)
        )
    if retry_hint:
        parts.append(f"Retry instruction: {retry_hint}")
    return "\n".join(parts)


def _generate_scenario_pool_with_chatgpt(
    *,
    topic: str,
    context: str,
    conversation_details: str,
    source_language: str,
    target_language: str,
    call_openai_json_fn,
) -> list[str]:
    source_name = _language_label(source_language)
    target_name = _language_label(target_language)
    parsed = call_openai_json_fn(
        """
Create five distinct conversation scenarios for language learning.

Return strict JSON:
{
  "scenarios": [
    "string"
  ]
}

Rules:
- Return exactly 5 scenarios.
- Each scenario must be one sentence only.
- Keep each scenario concrete, realistic, and common in daily life.
- Scenarios must be meaningfully different from each other.
- Keep scenario text in SOURCE language only.
- The scenario should naturally lead to a short dialogue in TARGET language.
- If extra user details are provided, make them influence every scenario.
- Avoid generic scenarios like "talk about the topic".
- JSON only.
""".strip(),
        (
            f"Topic: {topic}\n"
            f"Context: {context or 'not provided'}\n"
            f"Extra user details: {conversation_details or 'not provided'}\n"
            f"Source language: {source_name}\n"
            f"Target language: {target_name}\n"
            "Generate varied but practical options with different concrete constraints."
        ),
        timeout_seconds=10,
        temperature=0.8,
        top_p=1.0,
        presence_penalty=0.2,
    )
    if not isinstance(parsed, dict):
        return []
    raw_scenarios = parsed.get("scenarios")
    if not isinstance(raw_scenarios, list):
        return []
    scenarios: list[str] = []
    seen: set[str] = set()
    for value in raw_scenarios:
        scenario = str(value or "").strip()
        if not scenario:
            continue
        normalized = _normalize_text(scenario)
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        scenarios.append(scenario[:260])
        if len(scenarios) >= 5:
            break
    return scenarios


def generate_conversation_with_chatgpt(
    topic: str,
    context: str = "",
    conversation_details: str = "",
    source_language: str = "spanish",
    target_language: str = "german",
    *,
    call_openai_json_fn,
    choice_fn,
) -> list[dict[str, str]] | None:
    style_seed = choice_fn(STYLE_SEEDS)
    creativity_seed = uuid4().hex[:8]
    recent_patterns = _load_recent_fingerprints()
    scenario_pool = _generate_scenario_pool_with_chatgpt(
        topic=topic,
        context=context,
        conversation_details=conversation_details,
        source_language=source_language,
        target_language=target_language,
        call_openai_json_fn=call_openai_json_fn,
    )
    if scenario_pool:
        novelty_by_scenario = {scenario: _scenario_novelty_score(scenario, recent_patterns) for scenario in scenario_pool}
        best_score = max(novelty_by_scenario.values())
        best_scenarios = [scenario for scenario, score in novelty_by_scenario.items() if score == best_score]
        selected_scenario = choice_fn(best_scenarios)
    else:
        selected_scenario = (
        f"Create a practical, common scenario about {topic} ({context or 'general context'})."
        )
    overused_anchors = _select_overused_anchors(topic=topic, context=context, recent=recent_patterns)
    logger.info(
        "content.generate.conversation.scenario_pool topic=%s details=%s selected=%s pool=%s",
        topic,
        conversation_details,
        selected_scenario,
        json.dumps(scenario_pool, ensure_ascii=False),
    )
    retry_hint = "more variation, same topic and level"

    for attempt in range(2):
        parsed = call_openai_json_fn(
            CONVERSATION_GENERATION_PROMPT,
            _build_conversation_prompt(
                topic=topic,
                context=context,
                conversation_details=conversation_details,
                scenario_description=selected_scenario,
                source_language=source_language,
                target_language=target_language,
                style_seed=style_seed,
                creativity_seed=creativity_seed,
                recent_patterns=recent_patterns,
                overused_anchors=overused_anchors,
                retry_hint=retry_hint if attempt == 1 else "",
            ),
            timeout_seconds=15,
            temperature=0.75,
            top_p=1.0,
            presence_penalty=0.2,
        )
        if parsed is None:
            continue

        conversation = parsed.get("conversation", [])
        if not isinstance(conversation, list) or not conversation:
            logger.warning("content.generate.conversation.invalid_payload topic=%s", topic)
            continue

        phrases: list[dict[str, str]] = []
        for index, phrase in enumerate(conversation):
            if not isinstance(phrase, dict):
                continue
            source_text = str(phrase.get("source_text", phrase.get("spanish_text", ""))).strip()
            target_text = str(phrase.get("target_text", phrase.get("german_text", ""))).strip()
            notes = str(phrase.get("notes", "")).strip()
            speaker = _normalize_speaker(
                phrase.get("speaker", phrase.get("speaker_role", phrase.get("person", ""))),
                index,
            )
            if not source_text or not target_text:
                continue
            phrases.append(
                {
                    "spanish_text": source_text,
                    "german_text": target_text,
                    "speaker": speaker,
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
