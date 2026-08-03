from __future__ import annotations

import re

from ...languages import language_display_name


def required_word_terms(required_words: str) -> list[str]:
    raw_terms = re.split(r"[,;\n]+", required_words or "")
    terms: list[str] = []
    seen: set[str] = set()
    for raw_term in raw_terms:
        term = " ".join(str(raw_term or "").split()).strip()
        if not term or term.casefold() in seen:
            continue
        seen.add(term.casefold())
        terms.append(term)
    return terms


def required_words_instruction(required_words: str, target_language: str) -> str:
    terms = required_word_terms(required_words)
    if not terms:
        return "Required target-language words/phrases: none."
    return (
        f"Required {language_display_name(target_language)} words/phrases: {'; '.join(terms)}. "
        "Include every listed item in target_text at least once, using it exactly as written unless a tiny natural inflection is required."
    )


def translate_required_words_to_target(
    *,
    required_words: str,
    required_words_language: str,
    source_language: str,
    target_language: str,
    call_openai_json_fn,
) -> str | None:
    terms = required_word_terms(required_words)
    if not terms:
        return ""
    if required_words_language != "source":
        return "; ".join(terms)
    source_name = language_display_name(source_language)
    target_name = language_display_name(target_language)
    parsed = call_openai_json_fn(
        f"""
Translate required language-learning vocabulary from {source_name} into {target_name}.

Return strict JSON:
{{
  "target_words": ["string"]
}}

Rules:
- Return exactly one target_words entry for each source word or phrase, in the same order.
- Each target_words entry must be only the translated vocabulary item, not a sentence.
- Use the natural dictionary or phrase translation that would fit a beginner dialog.
- Include articles for nouns when that is natural in {target_name}.
- JSON only.
""".strip(),
        f"Source language: {source_name}\nTarget language: {target_name}\nSource words/phrases: {'; '.join(terms)}",
        timeout_seconds=10,
        temperature=0.2,
        top_p=1.0,
    )
    if not isinstance(parsed, dict) or not isinstance(parsed.get("target_words"), list):
        return None
    translations = [" ".join(str(value or "").split()).strip() for value in parsed["target_words"]]
    if len(translations) != len(terms) or not all(translations):
        return None
    return "; ".join(translations)
