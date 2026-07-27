from __future__ import annotations

import logging

from ...languages import language_display_name
from ...prompts import (
    WORD_EXERCISES_NOUN_GERMAN_ACCUSATIVE_PROMPT,
    WORD_EXERCISES_NOUN_GERMAN_COMMON_PROMPT,
    WORD_EXERCISES_NOUN_GERMAN_DATIVE_PROMPT,
    WORD_EXERCISES_NOUN_GERMAN_GENITIVE_PROMPT,
    WORD_EXERCISES_NOUN_GERMAN_NOMINATIVE_PROMPT,
    WORD_EXERCISES_NOUN_PROMPT,
)

logger = logging.getLogger(__name__)

GERMAN_NOUN_CASE_PROMPTS = {
    "nominative": WORD_EXERCISES_NOUN_GERMAN_NOMINATIVE_PROMPT,
    "accusative": WORD_EXERCISES_NOUN_GERMAN_ACCUSATIVE_PROMPT,
    "dative": WORD_EXERCISES_NOUN_GERMAN_DATIVE_PROMPT,
    "genitive": WORD_EXERCISES_NOUN_GERMAN_GENITIVE_PROMPT,
}
GERMAN_NOUN_CASE_ORDER = ["nominative", "accusative", "dative", "genitive"]
GERMAN_NOUN_GENERATION_MODE = "noun_cases_german_v1"


def _placeholder_question_source_text(case_key: str, source_language: str) -> str:
    normalized_source = (source_language or "").strip().lower()
    if normalized_source == "spanish":
        if case_key == "accusative":
            return "¿A quién...? / ¿Qué...?"
        if case_key == "dative":
            return "¿A quién...? / ¿Para quién...?"
        if case_key == "genitive":
            return "¿De quién...?"
    if case_key == "accusative":
        return "Whom or what?"
    if case_key == "dative":
        return "To whom or for whom?"
    if case_key == "genitive":
        return "Whose?"
    return ""


def _placeholder_question_target_text(case_key: str) -> str:
    if case_key == "accusative":
        return "Wen oder was?"
    if case_key == "dative":
        return "Wem oder fuer wen?"
    if case_key == "genitive":
        return "Wessen?"
    return ""


def _german_noun_section_prompt(*, target_word: str, source_language: str, case_prompt: str) -> str:
    common_prompt = WORD_EXERCISES_NOUN_GERMAN_COMMON_PROMPT.format(
        word_in_german=target_word,
        source_language=language_display_name(source_language),
    )
    return f"""
{common_prompt}

Return strict JSON with this exact shape:
{{
  "question_target_text": "string",
  "question_source_text": "string",
  "phrases": [
    {{"label": "definite", "source_text": "string", "target_text": "string"}},
    {{"label": "indefinite", "source_text": "string", "target_text": "string"}},
    {{"label": "negative", "source_text": "string", "target_text": "string"}},
    {{"label": "possessive", "source_text": "string", "target_text": "string"}},
    {{"label": "demonstrative", "source_text": "string", "target_text": "string"}}
  ]
}}

Case-specific requirements:
{case_prompt}

Output requirements:
- Return exactly 5 phrases, one for each listed determiner family, in the listed order.
- `question_target_text` must be in German.
- `question_source_text` must be the translation of that question in the source language.
- Keep source_text and target_text equivalent in meaning.
- Use the language mapping provided by the user input.
- If a target-language context example is provided, use it only to infer the intended meaning of the target word.
- Return JSON only, no markdown and no extra text.
""".strip()


def _generate_german_noun_section(
    *,
    case_key: str,
    prompt: str,
    user_input: str,
    source_word: str,
    target_word: str,
    source_language: str,
    call_openai_json_fn,
    clean_exercise_section_fn,
) -> dict:
    logger.info(
        "content.generate.noun_case_request case_key=%s prompt=%s user_input=%s",
        case_key,
        prompt,
        user_input,
    )
    parsed = call_openai_json_fn(
        prompt,
        user_input,
        timeout_seconds=12,
        temperature=0.8,
        top_p=0.9,
        presence_penalty=0.6,
    )
    if parsed is None or not isinstance(parsed, dict):
        return {}
    question_target_text = str(parsed.get("question_target_text", "")).strip()
    question_source_text = str(parsed.get("question_source_text", "")).strip()
    cleaned = clean_exercise_section_fn(parsed.get("phrases"), source_word=source_word, target_word=target_word)
    phrases = [
        {
            "label": f"{case_key}-{entry.get('label', '').strip()}",
            "source_text": entry["source_text"],
            "target_text": entry["target_text"],
        }
        for entry in cleaned
    ]
    if not phrases:
        return {}
    section = {
        "key": case_key,
        "phrases": phrases,
    }
    if question_target_text:
        section["question_target_text"] = question_target_text
    if question_source_text:
        section["question_source_text"] = question_source_text
    return section


def placeholder_german_noun_section(*, case_key: str, source_language: str) -> dict:
    section = {
        "key": case_key,
        "phrases": [],
    }
    question_target_text = _placeholder_question_target_text(case_key)
    question_source_text = _placeholder_question_source_text(case_key, source_language)
    if question_target_text:
        section["question_target_text"] = question_target_text
    if question_source_text:
        section["question_source_text"] = question_source_text
    return section


def generate_german_noun_case_section(
    *,
    case_key: str,
    source_word: str,
    target_word: str,
    source_language: str,
    user_input: str,
    call_openai_json_fn,
    clean_exercise_section_fn,
) -> dict:
    case_prompt = GERMAN_NOUN_CASE_PROMPTS.get(case_key)
    if not case_prompt:
        return {}
    return _generate_german_noun_section(
        case_key=case_key,
        prompt=_german_noun_section_prompt(
            target_word=target_word,
            source_language=source_language,
            case_prompt=case_prompt,
        ),
        user_input=user_input,
        source_word=source_word,
        target_word=target_word,
        source_language=source_language,
        call_openai_json_fn=call_openai_json_fn,
        clean_exercise_section_fn=clean_exercise_section_fn,
    )


def generate_noun_exercise_phrases(
    *,
    user_input: str,
    source_word: str,
    target_word: str,
    source_language: str,
    target_language: str,
    call_openai_json_fn,
    generate_exercise_phrases_fn,
    clean_exercise_section_fn,
) -> dict:
    if target_language == "german":
        sections: list[dict] = []
        for case_key in GERMAN_NOUN_CASE_ORDER:
            if case_key != "nominative":
                sections.append(placeholder_german_noun_section(case_key=case_key, source_language=source_language))
                continue
            section = generate_german_noun_case_section(
                case_key=case_key,
                source_word=source_word,
                target_word=target_word,
                source_language=source_language,
                user_input=user_input,
                call_openai_json_fn=call_openai_json_fn,
                clean_exercise_section_fn=clean_exercise_section_fn,
            )
            if section:
                sections.append(section)
        return {
            "phrases": [phrase for section in sections for phrase in section["phrases"]],
            "sections": sections,
            "generation_mode": GERMAN_NOUN_GENERATION_MODE,
        }

    del source_language
    phrases = generate_exercise_phrases_fn(
        prompt=WORD_EXERCISES_NOUN_PROMPT,
        user_input=user_input,
        source_word=source_word,
        target_word=target_word,
        call_openai_json_fn=call_openai_json_fn,
    )
    return {"phrases": phrases}
