from __future__ import annotations

import json


def parse_item_conversation_history(raw_value) -> list[dict[str, str]]:
    if raw_value is None:
        return []
    if isinstance(raw_value, str):
        try:
            parsed = json.loads(raw_value)
        except json.JSONDecodeError:
            return []
    elif isinstance(raw_value, list):
        parsed = raw_value
    else:
        return []

    cleaned: list[dict[str, str]] = []
    for entry in parsed:
        if not isinstance(entry, dict):
            continue
        user_text = str(entry.get("user_text", "")).strip()
        assistant_text = str(entry.get("assistant_text", "")).strip()
        if not user_text and not assistant_text:
            continue
        cleaned.append({"user_text": user_text[:500], "assistant_text": assistant_text[:800]})
    return cleaned[-8:]
