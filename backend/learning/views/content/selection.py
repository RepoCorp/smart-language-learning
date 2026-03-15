from __future__ import annotations

from .types import ContentCandidate

GERMAN_ARTICLES = {
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
}


def normalize_topic(topic: str) -> str:
    cleaned = " ".join(topic.split()).strip()
    if not cleaned:
        return "un tema"
    return cleaned


def normalize_word_key(word: str) -> str:
    return " ".join(word.split()).strip().lower()


def normalize_word_pair(spanish_word: str, german_word: str) -> tuple[str, str]:
    return normalize_word_key(spanish_word), normalize_word_key(german_word)


def word_selection_id(candidate: ContentCandidate) -> str:
    spanish, german = normalize_word_pair(candidate.spanish_text, candidate.german_text)
    return f"{spanish}|||{german}"


def is_word_selected(candidate: ContentCandidate, selected_values: set[str]) -> bool:
    if word_selection_id(candidate) in selected_values:
        return True
    # Backward compatibility with previous frontend payloads.
    return normalize_word_key(candidate.spanish_text) in selected_values


def is_candidate_selected(candidate: ContentCandidate, selected_values: set[str]) -> bool:
    return is_word_selected(candidate, selected_values)


def german_word_has_article(german_word: str) -> bool:
    normalized = normalize_word_key(german_word)
    if not normalized:
        return False
    first_token = normalized.split(" ", 1)[0]
    return first_token in GERMAN_ARTICLES
