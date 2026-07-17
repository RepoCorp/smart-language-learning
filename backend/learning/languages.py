from __future__ import annotations


STUDY_LANGUAGE_LABELS = {
    "spanish": "Spanish",
    "english": "English",
    "german": "German",
    "french": "French",
    "italian": "Italian",
    "portuguese": "Portuguese",
    "dutch": "Dutch",
}

STUDY_LANGUAGE_CHOICES = tuple((code, label) for code, label in STUDY_LANGUAGE_LABELS.items())

DEFAULT_CONVERSATION_GOAL_BY_LANGUAGE = {
    "spanish": "Saluda.",
    "english": "Say hello.",
    "german": "Begruesse die andere Person.",
    "french": "Dis bonjour.",
    "italian": "Saluta.",
    "portuguese": "Cumprimente.",
    "dutch": "Zeg hallo.",
}

OPENAI_TTS_ITEM_VOICE_BY_STUDY_LANGUAGE = {
    "spanish": "nova",
    "english": "alloy",
    "german": "onyx",
    "french": "shimmer",
    "italian": "echo",
    "portuguese": "fable",
    "dutch": "ash",
}

TTS_LANGUAGE_CODE_BY_STUDY_LANGUAGE = {
    "spanish": "es",
    "english": "en",
    "german": "de",
    "french": "fr",
    "italian": "it",
    "portuguese": "pt",
    "dutch": "nl",
}


def language_display_name(language_code: str) -> str:
    normalized = str(language_code or "").strip().lower()
    return STUDY_LANGUAGE_LABELS.get(normalized, normalized.capitalize())
