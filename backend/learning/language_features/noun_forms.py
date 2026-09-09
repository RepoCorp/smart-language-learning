from __future__ import annotations

from .german.noun_forms import generate_german_noun_exercise_phrases
from .spanish.noun_forms import generate_spanish_noun_exercise_phrases

NOUN_FORM_GENERATORS = {
    "german": generate_german_noun_exercise_phrases,
    "spanish": generate_spanish_noun_exercise_phrases,
}


def generate_language_noun_forms(*, target_language: str, **kwargs) -> dict | None:
    generator = NOUN_FORM_GENERATORS.get(target_language)
    return generator(**kwargs) if generator else None
