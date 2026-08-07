from __future__ import annotations

from ...languages import language_display_name


def openai_tts_language_instruction(target_language: str) -> str:
    language_label = language_display_name(target_language)
    return (
        f"Speak only in {language_label}. "
        f"Every word, syllable, abbreviation, article, and phrase must be pronounced with {language_label} phonetics and accent. "
        "Pronounce every word clearly and distinctly. Do not swallow, merge, rush, or skip words. "
        "If a token looks like English or another language, still pronounce it as the requested language text. "
        "Do not translate, switch languages, infer an English pronunciation, or reinterpret words as another language."
    )
