from __future__ import annotations

from ...language_features.noun_forms import generate_language_noun_forms
from ...prompts import WORD_EXERCISES_NOUN_PROMPT


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
    language_payload = generate_language_noun_forms(
        target_language=target_language,
        user_input=user_input,
        source_word=source_word,
        target_word=target_word,
        source_language=source_language,
        call_openai_json_fn=call_openai_json_fn,
        clean_exercise_section_fn=clean_exercise_section_fn,
    )
    if language_payload is not None:
        return language_payload
    return {
        "phrases": generate_exercise_phrases_fn(
            prompt=WORD_EXERCISES_NOUN_PROMPT,
            user_input=user_input,
            source_word=source_word,
            target_word=target_word,
            call_openai_json_fn=call_openai_json_fn,
        ),
    }
