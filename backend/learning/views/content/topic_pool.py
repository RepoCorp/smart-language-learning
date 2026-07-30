from __future__ import annotations

from random import choice

RANDOM_TOPIC_OPTION = "__random_topic__"

DEFAULT_TOPIC_POOL = [
    "At the supermarket",
    "At a cafe",
    "At the train station",
    "Meeting a new neighbor",
    "At the pharmacy",
    "At the bakery",
    "Talking about weekend plans",
    "At the airport",
    "At work",
    "At the doctor's office",
    "At the gym",
    "At the hotel",
    "Asking for directions",
    "Shopping for clothes",
    "At the hairdresser",
    "Talking about the weather",
    "At the post office",
    "Ordering food",
    "At the library",
    "Planning a trip",
]


def resolve_topic_choice(
    *,
    user,
    topic: str,
    source_language: str,
    target_language: str,
    choice_fn=choice,
) -> str:
    normalized = " ".join((topic or "").split()).strip()
    if normalized and normalized != RANDOM_TOPIC_OPTION:
        return normalized

    return str(choice_fn(DEFAULT_TOPIC_POOL)).strip()
