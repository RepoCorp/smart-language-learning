from __future__ import annotations


def normalize_text_for_matching(value: str) -> str:
    lowered = str(value or "").lower()
    return " ".join("".join(ch if ch.isalnum() or ch.isspace() else " " for ch in lowered).split())
