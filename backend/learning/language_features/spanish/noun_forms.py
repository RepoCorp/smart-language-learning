from __future__ import annotations

from ...languages import language_display_name
from ...prompts import WORD_EXERCISES_NOUN_SPANISH_FORMS_PROMPT

SPANISH_NOUN_GENERATION_MODE = "noun_forms_spanish_v1"
SPANISH_NOUN_FORM_FAMILIES = ("definite", "indefinite", "negative", "this", "that", "possessive")


def generate_spanish_noun_exercise_phrases(*, user_input: str, source_word: str, target_word: str, source_language: str, call_openai_json_fn, clean_exercise_section_fn) -> dict:
    prompt = WORD_EXERCISES_NOUN_SPANISH_FORMS_PROMPT.replace("{word}", target_word).replace(
        "{source_language}", language_display_name(source_language),
    )
    parsed = call_openai_json_fn(prompt, user_input, timeout_seconds=12, temperature=0.8, top_p=0.9, presence_penalty=0.6)
    if not isinstance(parsed, dict) or not isinstance(parsed.get("forms"), list):
        return {}
    forms_by_family = {str(entry.get("family", "")).strip().lower(): entry for entry in parsed["forms"] if isinstance(entry, dict)}
    sections = []
    for number in ("singular", "plural"):
        raw_phrases = []
        for family in SPANISH_NOUN_FORM_FAMILIES:
            if family == "negative" and number == "plural":
                continue
            entry = forms_by_family.get(family, {})
            target_text = str(entry.get(f"{number}_target_text", "")).strip()
            source_text = str(entry.get(f"{number}_source_text", "")).strip()
            form = str(entry.get(f"{number}_form", "")).strip()
            if target_text and source_text and form and target_text.casefold().startswith(form.casefold()):
                raw_phrases.append({"label": family, "source_text": source_text, "target_text": target_text})
        sections.append({"key": number, "phrases": clean_exercise_section_fn(raw_phrases, source_word=source_word, target_word=target_word)})
    phrases = [phrase for section in sections for phrase in section["phrases"]]
    return {"phrases": phrases, "sections": sections, "generation_mode": SPANISH_NOUN_GENERATION_MODE} if phrases else {}
