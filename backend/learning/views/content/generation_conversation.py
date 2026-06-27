from __future__ import annotations

import json
import logging
import re
from uuid import uuid4

from ...languages import language_display_name
from ...prompts import CONVERSATION_GENERATION_PROMPT
from ...text import normalize_text_for_matching

logger = logging.getLogger(__name__)
STYLE_SEEDS = ("casual", "polite", "urgent", "friendly", "problem-solving", "small-talk")
COMMON_WORDS = {
    "a", "al", "algo", "all", "are", "con", "como", "das", "de", "del", "der", "die", "el", "en", "es",
    "esta", "estoy", "etwas", "for", "hay", "ich", "la", "las", "los", "mein", "meine", "mi", "mis", "no",
    "por", "que", "se", "si", "sie", "the", "to", "tu", "und", "una", "uno", "wir", "y", "yo",
}
GREETING_HINTS = {"greeting", "greetings", "saludo", "saludos", "hello", "hola", "reunion", "reunión"}


def _normalize_speaker(value) -> str:
    raw = str(value or "").strip().lower()
    if raw in {"a", "speaker_a", "person_a", "1", "first"}:
        return "a"
    if raw in {"b", "speaker_b", "person_b", "2", "second"}:
        return "b"
    return ""


def _language_label(code: str) -> str:
    return language_display_name(code)


def _extract_keywords(text: str) -> list[str]:
    normalized = normalize_text_for_matching(text)
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


def _required_word_terms(required_words: str) -> list[str]:
    raw_terms = re.split(r"[,;\n]+", required_words or "")
    terms: list[str] = []
    seen: set[str] = set()
    for raw_term in raw_terms:
        term = " ".join(str(raw_term or "").split()).strip()
        if not term:
            continue
        normalized = term.casefold()
        if normalized in seen:
            continue
        seen.add(normalized)
        terms.append(term)
    return terms


def _required_words_instruction(required_words: str, target_language: str) -> str:
    terms = _required_word_terms(required_words)
    if not terms:
        return "Required target-language words/phrases: none."
    target_name = _language_label(target_language)
    return (
        f"Required {target_name} words/phrases: {'; '.join(terms)}. "
        "Include every listed item in target_text at least once, using it exactly as written unless a tiny natural inflection is required."
    )


def _translate_required_words_to_target(
    *,
    required_words: str,
    required_words_language: str,
    source_language: str,
    target_language: str,
    call_openai_json_fn,
) -> str | None:
    terms = _required_word_terms(required_words)
    if not terms:
        return ""
    if required_words_language != "source":
        return "; ".join(terms)
    source_name = _language_label(source_language)
    target_name = _language_label(target_language)
    parsed = call_openai_json_fn(
        f"""
Translate required language-learning vocabulary from {source_name} into {target_name}.

Return strict JSON:
{{
  "target_words": [
    "string"
  ]
}}

Rules:
- Return exactly one target_words entry for each source word or phrase, in the same order.
- Each target_words entry must be only the translated vocabulary item, not a sentence.
- Use the natural dictionary or phrase translation that would fit a beginner dialog.
- Include articles for nouns when that is natural in {target_name}.
- JSON only.
""".strip(),
        (
            f"Source language: {source_name}\n"
            f"Target language: {target_name}\n"
            f"Source words/phrases: {'; '.join(terms)}"
        ),
        timeout_seconds=10,
        temperature=0.2,
        top_p=1.0,
    )
    if not isinstance(parsed, dict):
        return None
    raw_translations = parsed.get("target_words")
    if not isinstance(raw_translations, list):
        return None
    translated_terms = []
    for raw_translation in raw_translations:
        translation = " ".join(str(raw_translation or "").split()).strip()
        if translation:
            translated_terms.append(translation)
    if len(translated_terms) != len(terms):
        return None
    return "; ".join(translated_terms)


def _allows_greeting(topic: str, context: str) -> bool:
    merged = normalize_text_for_matching(f"{topic} {context}")
    words = set(merged.split())
    return bool(words.intersection(GREETING_HINTS))


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
        normalized = normalize_text_for_matching(phrase["spanish_text"])
        starters.append(" ".join(normalized.split()[:2]))
    repeated = len(starters) - len(set(starters))
    return repeated >= len(phrases) // 2


def _validate_conversation(
    phrases: list[dict[str, str]],
    topic: str,
    context: str,
) -> tuple[bool, str]:
    if not phrases:
        return False, "empty"
    first_line = normalize_text_for_matching(phrases[0]["spanish_text"]) if phrases else ""
    if first_line.startswith("hola como estas") and not _allows_greeting(topic, context):
        return False, "overused_greeting_start"
    if _has_consecutive_lexical_repetition(phrases):
        return False, "consecutive_lexical_repetition"
    if _is_monotonous(phrases):
        return False, "monotonous_turn_starters"
    return True, "ok"


def _build_conversation_prompt(
    topic: str,
    context: str,
    conversation_details: str,
    required_words: str,
    dialog_length: str,
    scenario_description: str,
    source_language: str,
    target_language: str,
    style_seed: str,
    creativity_seed: str
) -> str:
    normalized_context = " ".join(context.split()).strip()
    normalized_details = " ".join(conversation_details.split()).strip()
    context_value = normalized_context or "not provided"
    situation_detail = normalized_context or "not provided"
    length_requirement = (
        "Exactly 3 very short dialogue turns/phrases total."
        if dialog_length == "short_three"
        else "6 to 12 very simple dialogue turns/phrases total."
    )
    parts = [
        f"Topic: {topic}",
        f"Context: {context_value}",
        f"Selected scenario: {scenario_description}",
        f"Situation detail: {situation_detail}",
        f"Length requirement: {length_requirement}",
        _required_words_instruction(required_words, target_language),
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
    ]
    return "\n".join(parts)


def _generate_scenario_pool_with_chatgpt(
    *,
    topic: str,
    context: str,
    conversation_details: str,
    required_words: str,
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
            f"Required target-language words/phrases for final dialog: {required_words or 'not provided'}\n"
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
        raise RuntimeError("Scenario generation failed")
    raw_scenarios = parsed.get("scenarios")
    if not isinstance(raw_scenarios, list):
        raise RuntimeError("Scenario generation failed")
    scenarios: list[str] = []
    seen: set[str] = set()
    for value in raw_scenarios:
        scenario = str(value or "").strip()
        if not scenario:
            continue
        normalized = normalize_text_for_matching(scenario)
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        scenarios.append(scenario[:260])
        if len(scenarios) >= 5:
            break
    if len(scenarios) != 5:
        raise RuntimeError("Scenario generation failed")
    return scenarios


def generate_conversation_with_chatgpt(
    topic: str,
    context: str = "",
    conversation_details: str = "",
    required_words: str = "",
    required_words_language: str = "target",
    dialog_length: str = "standard",
    source_language: str = "spanish",
    target_language: str = "german",
    *,
    call_openai_json_fn,
    choice_fn,
) -> list[dict[str, str]] | None:
    style_seed = choice_fn(STYLE_SEEDS)
    creativity_seed = uuid4().hex[:8]
    target_required_words = _translate_required_words_to_target(
        required_words=required_words,
        required_words_language=required_words_language,
        source_language=source_language,
        target_language=target_language,
        call_openai_json_fn=call_openai_json_fn,
    )
    if target_required_words is None:
        return None
    try:
        scenario_pool = _generate_scenario_pool_with_chatgpt(
            topic=topic,
            context=context,
            conversation_details=conversation_details,
            required_words=target_required_words,
            source_language=source_language,
            target_language=target_language,
            call_openai_json_fn=call_openai_json_fn,
        )
    except RuntimeError:
        return None
    selected_scenario = choice_fn(scenario_pool)
    logger.info(
        "content.generate.conversation.scenario_pool topic=%s details=%s selected=%s pool=%s",
        topic,
        conversation_details,
        selected_scenario,
        json.dumps(scenario_pool, ensure_ascii=False),
    )

    parsed = call_openai_json_fn(
        CONVERSATION_GENERATION_PROMPT,
        _build_conversation_prompt(
            topic=topic,
            context=context,
            conversation_details=conversation_details,
            required_words=target_required_words,
            dialog_length=dialog_length,
            scenario_description=selected_scenario,
            source_language=source_language,
            target_language=target_language,
            style_seed=style_seed,
            creativity_seed=creativity_seed,
        ),
        timeout_seconds=15,
        temperature=0.75,
        top_p=1.0,
        presence_penalty=0.2,
    )
    if parsed is None or not isinstance(parsed, dict):
        return None

    conversation = parsed.get("conversation", [])
    if not isinstance(conversation, list) or not conversation:
        logger.warning("content.generate.conversation.invalid_payload topic=%s", topic)
        return None

    phrases: list[dict[str, str]] = []
    for index, phrase in enumerate(conversation):
        if not isinstance(phrase, dict):
            continue
        source_text = str(phrase.get("source_text", "")).strip()
        target_text = str(phrase.get("target_text", "")).strip()
        notes = str(phrase.get("notes", "")).strip()
        speaker = _normalize_speaker(phrase.get("speaker", ""))
        if not source_text or not target_text or not speaker:
            return None
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
        return None

    logger.info(
        "content.generate.conversation.received topic=%s style=%s conversation=%s",
        topic,
        style_seed,
        json.dumps(phrases, ensure_ascii=False),
    )
    logger.info("content.generate.conversation.success topic=%s phrases=%d", topic, len(phrases))
    return phrases
