from __future__ import annotations


STUDY_LANGUAGE_LABELS = {
    "spanish": "Spanish",
    "english": "English",
    "german": "German",
    "french": "French",
    "italian": "Italian",
    "portuguese": "Portuguese",
}


def language_display_name(language_code: str) -> str:
    normalized = str(language_code or "").strip().lower()
    return STUDY_LANGUAGE_LABELS.get(normalized, normalized.capitalize())
