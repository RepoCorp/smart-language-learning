from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class ContentCandidate:
    spanish_text: str
    german_text: str
    exists: bool
    notes: str = ""
    source_phrase_german: str = ""
    word_type: str = ""


@dataclass(frozen=True)
class ContentPlan:
    phrases: list[ContentCandidate]
    words: list[ContentCandidate]
