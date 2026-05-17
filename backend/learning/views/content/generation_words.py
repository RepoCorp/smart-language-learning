from __future__ import annotations

import logging
import re

from ...prompts import (
    PHRASE_KEYWORDS_PROMPT,
    WORD_EXERCISES_ADJECTIVE_PROMPT,
    WORD_EXERCISES_ADVERB_PROMPT,
    WORD_EXERCISES_EXPRESSION_PROMPT,
    WORD_EXERCISES_HELPER_PROMPT,
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
MAX_EXERCISE_WORDS_PER_PHRASE = 8
MAX_EXERCISE_PHRASES = 30
VERB_BY_TENSE_GENERATION_MODE = "verb_by_tense_v1"
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
    "helper": WORD_EXERCISES_HELPER_PROMPT,
    "expression": WORD_EXERCISES_EXPRESSION_PROMPT,
    "other": WORD_EXERCISES_OTHER_PROMPT,
}
VERB_PERSON_SPECS = [
    ("1s", "1st person singular"),
    ("2s", "2nd person singular"),
    ("3s", "3rd person singular"),
    ("1p", "1st person plural"),
    ("2p", "2nd person plural"),
    ("3p", "3rd person plural"),
]
VERB_TENSE_SPECS = [
    ("present", "Present"),
    ("perfect", "Perfect"),
    ("simple-past", "Simple past"),
    ("future", "Future"),
]
FUNNY_IMAGE_INSTRUCTIONS_BY_WORD_TYPE = {
    "noun": (
        "- The target word itself must be the grammatical subject of the sentence.\n"
        "- The sentence should preferably begin with the target noun and its article."
    ),
    "verb": "- The target verb must describe the main visible action.",
    "adjective": "- The target adjective must describe a clearly visible property.",
    "preposition": "- The scene must make the spatial relationship visually obvious.",
    "adverb": "- The adverb must visibly affect the action.",
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


def _funny_image_phrase_input(
    *,
    source_word: str,
    target_word: str,
    notes: str,
    word_type: str,
    source_language: str,
    target_language: str,
) -> str:
    return (
        f"Word source_text ({_language_label(source_language)}): {source_word}\n"
        f"Word target_text ({_language_label(target_language)}): {target_word}\n"
        f"Word type: {word_type or 'unknown'}\n"
        f"Optional notes: {notes}\n"
        f"Language mapping: source_text={_language_label(source_language)}, target_text={_language_label(target_language)}"
    )


def _funny_image_prompt_for_word_type(word_type: str) -> str:
    normalized = (word_type or "").strip().lower()
    word_type_instructions = FUNNY_IMAGE_INSTRUCTIONS_BY_WORD_TYPE.get(normalized, "")
    if word_type_instructions:
        word_type_instructions = f"\n{word_type_instructions}"
    return f"""
Generate one simple visual exercise phrase for a vocabulary item.

Return strict JSON with this exact shape:
{{
  "source_text": "string",
  "target_text": "string"
}}

Rules:
- target_text must be in the target language.
- source_text must be the natural translation in the source language.
- The phrase must center around the target word.
- The target word must play the central visual role in the scene.{word_type_instructions}
- Use very simple vocabulary and grammar.
- The phrase must describe ONE concrete visual scene that can be illustrated instantly.
- Prefer slightly unusual, playful, or emotionally distinctive scenes that improve memorability.
- The scene should still feel plausible and easy to understand for a beginner.
- Prefer a small funny scene over a neutral object-location sentence.
- Avoid the most typical textbook examples.
- Keep target_text short (3–7 words preferred).
- Avoid abstract concepts, opinions, generic descriptions, or invisible actions.
- Avoid filler phrases like “is good,” “is important,” etc.
- Prefer strong visual nouns, colors, clothing, food, vehicles, animals, or locations.
- The sentence should sound natural when repeated aloud many times.
- Return JSON only, no markdown and no extra text.
""".strip()


def generate_funny_image_exercise_phrase_with_chatgpt(
    source_word: str,
    target_word: str,
    notes: str = "",
    word_type: str = "",
    source_language: str = "spanish",
    target_language: str = "german",
    *,
    call_openai_json_fn,
) -> dict:
    parsed = call_openai_json_fn(
        _funny_image_prompt_for_word_type(word_type),
        _funny_image_phrase_input(
            source_word=source_word,
            target_word=target_word,
            notes=notes,
            word_type=word_type,
            source_language=source_language,
            target_language=target_language,
        ),
        timeout_seconds=12,
        temperature=0.9,
        top_p=0.9,
        presence_penalty=0.2,
    )
    if not isinstance(parsed, dict):
        return {}
    source_text = str(parsed.get("source_text", "")).strip()
    target_text = str(parsed.get("target_text", "")).strip()
    if not source_text or not target_text:
        return {}
    if _word_count(target_text) < 3 or _is_bare_vocabulary_entry(target_text, target_word):
        logger.warning("content.generate.funny_image_phrase.bare_target target=%s word=%s", target_text, target_word)
        return {}
    if _word_count(source_text) < 3 or _is_bare_vocabulary_entry(source_text, source_word):
        logger.warning("content.generate.funny_image_phrase.bare_source source=%s word=%s", source_text, source_word)
        return {}
    return {
        "label": "funny image",
        "source_text": source_text,
        "target_text": target_text,
    }


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


def _verb_tense_prompt(*, tense_key: str, tense_label: str) -> str:
    phrase_shape = ",\n    ".join(
        f'{{"label": "{tense_key}-{person_key}", "source_text": "string", "target_text": "string"}}'
        for person_key, _person_label in VERB_PERSON_SPECS
    )
    person_list = "\n".join(f"- {tense_key}-{person_key}: {person_label}" for person_key, person_label in VERB_PERSON_SPECS)
    return f"""
Generate verb exercise phrases for one vocabulary item in one tense.

Return strict JSON with this exact shape:
{{
  "phrases": [
    {phrase_shape}
  ]
}}

Rules:
- Return exactly 6 phrases, one for each listed label, in the listed order.
- Tense: {tense_label}.
- Persons:
{person_list}
- First choose one short useful context for this tense, such as one time, place, object, manner, or reason.
- Use that same context in all six phrases; only change the person and the verb conjugation.
- Each target_text must include the correct {tense_label} conjugated form for its label.
- Do not return only a subject/pronoun plus the verb, such as "ich gehe" or "wir lernen".
- Use simple declarative phrases with a pronoun or natural subject, not questions or commands.
- Keep every phrase short (max 7 words), practical, and beginner-friendly (A1-A2).
- Besides the target verb, necessary auxiliaries, and the shared context, use only very basic high-frequency words.
- Keep source_text and target_text equivalent in meaning.
- Use the language mapping provided by the user input.
- Return JSON only, no markdown and no extra text.
""".strip()


def _generate_verb_exercise_phrases_by_tense(
    *,
    user_input: str,
    source_word: str,
    target_word: str,
    call_openai_json_fn,
) -> list[dict[str, str]]:
    phrases: list[dict[str, str]] = []
    for tense_key, tense_label in VERB_TENSE_SPECS:
        tense_phrases = _generate_exercise_phrases(
            prompt=_verb_tense_prompt(tense_key=tense_key, tense_label=tense_label),
            user_input=f"{user_input}\nRequested tense: {tense_label}\nUse labels prefixed with: {tense_key}-",
            source_word=source_word,
            target_word=target_word,
            call_openai_json_fn=call_openai_json_fn,
        )
        phrases.extend(tense_phrases)
    return phrases[:MAX_EXERCISE_PHRASES]


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
    if (word_type or "").strip().lower() == "verb":
        phrases = _generate_verb_exercise_phrases_by_tense(
            user_input=user_input,
            source_word=spanish_word,
            target_word=german_word,
            call_openai_json_fn=call_openai_json_fn,
        )
        return {"phrases": phrases, "generation_mode": VERB_BY_TENSE_GENERATION_MODE}

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
            return None
        spanish_word = str(keyword.get("source_text", "")).strip()
        german_word = str(keyword.get("target_text", "")).strip()
        word_type = str(keyword.get("word_type", "")).strip().lower()
        keyword_notes = str(keyword.get("notes", "")).strip()
        plural_german = str(keyword.get("plural_target", "")).strip()
        if not spanish_word or not german_word or not word_type:
            return None
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
