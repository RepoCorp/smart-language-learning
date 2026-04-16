from __future__ import annotations

import logging
import re

from ...prompts import (
    PHRASE_KEYWORDS_PROMPT,
    WORD_EXERCISES_FIRST_SECTION_PROMPT,
    WORD_EXERCISES_SECOND_SECTION_PROMPT,
)

logger = logging.getLogger(__name__)
STUDY_LANGUAGE_LABELS = {
    "spanish": "Spanish",
    "english": "English",
    "german": "German",
    "french": "French",
    "italian": "Italian",
    "portuguese": "Portuguese",
}
MAX_EXERCISE_WORDS_PER_PHRASE = 4


def _language_label(code: str) -> str:
    return STUDY_LANGUAGE_LABELS.get(code, code.capitalize())


def _fallback_word_exercise_phrases(
    spanish_word: str,
    german_word: str,
    target_language: str,
) -> dict:
    source = spanish_word.strip()
    target = german_word.strip()
    if target_language == "german":
        first_section = [
            {"source_text": f"Yo uso {source}.", "target_text": f"Ich nutze {target}."},
            {"source_text": f"Aquí está {source}.", "target_text": f"Hier ist {target}."},
        ]
        second_section = [
            {"source_text": f"Yo veo {source}.", "target_text": f"Ich sehe {target}."},
            {"source_text": f"{source.capitalize()} está aquí.", "target_text": f"{target} ist da."},
        ]
        return {"first_section": first_section, "second_section": second_section}

    first_section = [
        {"source_text": f"Yo uso {source}.", "target_text": f"I use {target}."},
        {"source_text": f"Aquí está {source}.", "target_text": f"Here is {target}."},
    ]
    second_section = [
        {"source_text": f"Yo veo {source}.", "target_text": f"I see {target}."},
        {"source_text": f"{source.capitalize()} está aquí.", "target_text": f"{target} is here."},
    ]
    return {"first_section": first_section, "second_section": second_section}


def _word_count(value: str) -> int:
    return len([token for token in value.split() if token.strip()])


def _clean_exercise_section(value) -> list[dict[str, str]]:
    if not isinstance(value, list):
        return []
    result: list[dict[str, str]] = []
    for entry in value:
        if not isinstance(entry, dict):
            continue
        source_text = str(entry.get("source_text", "")).strip()
        target_text = str(entry.get("target_text", "")).strip()
        if not source_text or not target_text:
            continue
        if _word_count(source_text) > MAX_EXERCISE_WORDS_PER_PHRASE or _word_count(target_text) > MAX_EXERCISE_WORDS_PER_PHRASE:
            continue
        result.append({"source_text": source_text, "target_text": target_text})
        if len(result) >= 2:
            break
    return result


def _exercise_generation_input(
    *,
    spanish_word: str,
    german_word: str,
    notes: str,
    source_language: str,
    target_language: str,
) -> str:
    return (
        f"Word source_text ({_language_label(source_language)}): {spanish_word}\n"
        f"Word target_text ({_language_label(target_language)}): {german_word}\n"
        f"Optional notes: {notes}\n"
        f"Language mapping: source_text={_language_label(source_language)}, target_text={_language_label(target_language)}"
    )


def _generate_exercise_section(
    *,
    prompt: str,
    user_input: str,
    call_openai_json_fn,
) -> list[dict[str, str]]:
    parsed = call_openai_json_fn(
        prompt,
        user_input,
        timeout_seconds=12,
        temperature=0.8,
        top_p=0.9,
        presence_penalty=0.6,
    )
    if parsed is None or not isinstance(parsed, dict):
        return []
    return _clean_exercise_section(parsed.get("phrases"))


def _contains_exact_target_form(target_text: str, target_word: str) -> bool:
    text = target_text.strip()
    word = target_word.strip()
    if not text or not word:
        return False
    escaped = re.escape(word)
    pattern = re.compile(rf"(?<!\w){escaped}(?!\w)", re.IGNORECASE)
    return bool(pattern.search(text))


def generate_word_exercise_phrases_with_chatgpt(
    spanish_word: str,
    german_word: str,
    notes: str = "",
    source_language: str = "spanish",
    target_language: str = "german",
    *,
    call_openai_json_fn,
) -> dict:
    user_input = _exercise_generation_input(
        spanish_word=spanish_word,
        german_word=german_word,
        notes=notes,
        source_language=source_language,
        target_language=target_language,
    )
    first_section = _generate_exercise_section(
        prompt=WORD_EXERCISES_FIRST_SECTION_PROMPT,
        user_input=user_input,
        call_openai_json_fn=call_openai_json_fn,
    )
    second_section = _generate_exercise_section(
        prompt=WORD_EXERCISES_SECOND_SECTION_PROMPT,
        user_input=user_input,
        call_openai_json_fn=call_openai_json_fn,
    )

    fallback = _fallback_word_exercise_phrases(spanish_word, german_word, target_language)
    first_section = [entry for entry in first_section if _contains_exact_target_form(entry["target_text"], german_word)]
    if len(first_section) < 2:
        first_section = fallback["first_section"]
    if len(second_section) < 2:
        second_section = fallback["second_section"]

    return {"first_section": first_section, "second_section": second_section}


def generate_keywords_for_phrase_with_chatgpt(
    spanish_phrase: str,
    german_phrase: str,
    source_language: str = "spanish",
    target_language: str = "german",
    *,
    call_openai_json_fn,
) -> list[dict[str, str]] | None:
    article_requirement = (
        "For german_text, include article and singular form (e.g., 'der Park')."
        if target_language == "german"
        else "Do not force articles in german_text unless natural for the selected target language."
    )
    parsed = call_openai_json_fn(
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
