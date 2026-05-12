from __future__ import annotations

import logging
import re

from ...prompts import (
    PHRASE_KEYWORDS_PROMPT,
    WORD_EXERCISES_ADJECTIVE_PROMPT,
    WORD_EXERCISES_ADVERB_PROMPT,
    WORD_EXERCISES_EXPRESSION_PROMPT,
    WORD_EXERCISES_NOUN_PROMPT,
    WORD_EXERCISES_OTHER_PROMPT,
    WORD_EXERCISES_VERB_PROMPT,
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
MAX_EXERCISE_WORDS_PER_PHRASE = 6
MAX_EXERCISE_PHRASES = 12
VOCAB_ENTRY_ARTICLES = {
    "der",
    "die",
    "das",
    "den",
    "dem",
    "des",
    "ein",
    "eine",
    "einen",
    "einem",
    "einer",
    "eines",
    "el",
    "la",
    "los",
    "las",
    "un",
    "una",
    "unos",
    "unas",
}
WORD_EXERCISE_PROMPTS_BY_TYPE = {
    "noun": WORD_EXERCISES_NOUN_PROMPT,
    "verb": WORD_EXERCISES_VERB_PROMPT,
    "adjective": WORD_EXERCISES_ADJECTIVE_PROMPT,
    "adverb": WORD_EXERCISES_ADVERB_PROMPT,
    "expression": WORD_EXERCISES_EXPRESSION_PROMPT,
    "other": WORD_EXERCISES_OTHER_PROMPT,
}


def _language_label(code: str) -> str:
    return STUDY_LANGUAGE_LABELS.get(code, code.capitalize())


def _word_count(value: str) -> int:
    return len([token for token in value.split() if token.strip()])


def _normalize_exercise_text(value: str) -> str:
    normalized = re.sub(r"[^\w\s]", " ", value.lower(), flags=re.UNICODE)
    return " ".join(normalized.split())


def _is_bare_vocabulary_entry(text: str, base_word: str) -> bool:
    normalized = _normalize_exercise_text(text)
    normalized_base = _normalize_exercise_text(base_word)
    if not normalized:
        return False
    if normalized_base and normalized == normalized_base:
        return True
    parts = normalized.split()
    return len(parts) <= 2 and parts[0] in VOCAB_ENTRY_ARTICLES


def _clean_exercise_section(value, *, source_word: str = "", target_word: str = "") -> list[dict[str, str]]:
    if not isinstance(value, list):
        return []
    result: list[dict[str, str]] = []
    for entry in value:
        if not isinstance(entry, dict):
            continue
        source_text = str(entry.get("source_text", "")).strip()
        target_text = str(entry.get("target_text", "")).strip()
        label = str(entry.get("label", "")).strip()
        if not source_text or not target_text:
            continue
        if _is_bare_vocabulary_entry(source_text, source_word) or _is_bare_vocabulary_entry(target_text, target_word):
            continue
        if _word_count(source_text) > MAX_EXERCISE_WORDS_PER_PHRASE or _word_count(target_text) > MAX_EXERCISE_WORDS_PER_PHRASE:
            continue
        result.append({"label": label, "source_text": source_text, "target_text": target_text})
        if len(result) >= MAX_EXERCISE_PHRASES:
            break
    return result


def _exercise_generation_input(
    *,
    spanish_word: str,
    german_word: str,
    notes: str,
    word_type: str,
    source_language: str,
    target_language: str,
) -> str:
    return (
        f"Word source_text ({_language_label(source_language)}): {spanish_word}\n"
        f"Word target_text ({_language_label(target_language)}): {german_word}\n"
        f"Word type: {word_type or 'unknown'}\n"
        f"Optional notes: {notes}\n"
        f"Language mapping: source_text={_language_label(source_language)}, target_text={_language_label(target_language)}"
    )


def _generate_exercise_phrases(
    *,
    prompt: str,
    user_input: str,
    source_word: str,
    target_word: str,
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
    return _clean_exercise_section(parsed.get("phrases"), source_word=source_word, target_word=target_word)


def _exercise_prompt_for_word_type(word_type: str) -> str:
    normalized = (word_type or "").strip().lower()
    return WORD_EXERCISE_PROMPTS_BY_TYPE.get(normalized, WORD_EXERCISES_OTHER_PROMPT)


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
    word_type: str = "",
    source_language: str = "spanish",
    target_language: str = "german",
    *,
    call_openai_json_fn,
) -> dict:
    user_input = _exercise_generation_input(
        spanish_word=spanish_word,
        german_word=german_word,
        notes=notes,
        word_type=word_type,
        source_language=source_language,
        target_language=target_language,
    )
    phrases = _generate_exercise_phrases(
        prompt=_exercise_prompt_for_word_type(word_type),
        user_input=user_input,
        source_word=spanish_word,
        target_word=german_word,
        call_openai_json_fn=call_openai_json_fn,
    )

    return {"phrases": phrases}


def generate_keywords_for_phrase_with_chatgpt(
    spanish_phrase: str,
    german_phrase: str,
    source_language: str = "spanish",
    target_language: str = "german",
    *,
    call_openai_json_fn,
) -> list[dict[str, str]] | None:
    article_requirement = (
        "For german_text nouns, include article and singular form (e.g., 'der Park')."
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
        word_type = str(keyword.get("word_type", "")).strip().lower()
        keyword_notes = str(keyword.get("notes", "")).strip()
        plural_german = str(keyword.get("plural_target", keyword.get("plural_german", ""))).strip()
        if not spanish_word or not german_word:
            continue
        cleaned_keywords.append(
            {
                "spanish_text": spanish_word,
                "german_text": german_word,
                "word_type": word_type,
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
