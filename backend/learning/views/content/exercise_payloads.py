from __future__ import annotations

MAX_EXERCISE_PHRASES = 30


def sanitize_exercise_entries(value) -> list[dict[str, str]]:
    if not isinstance(value, list):
        return []
    entries: list[dict[str, str]] = []
    for entry in value:
        if not isinstance(entry, dict):
            continue
        source_text = str(entry.get("source_text", "")).strip()
        target_text = str(entry.get("target_text", "")).strip()
        label = str(entry.get("label", "")).strip()
        if not source_text or not target_text:
            continue
        entries.append({"label": label, "source_text": source_text, "target_text": target_text})
        if len(entries) >= MAX_EXERCISE_PHRASES:
            break
    return entries


def sanitize_exercise_sections(value) -> list[dict]:
    if not isinstance(value, list):
        return []
    sections: list[dict] = []
    for entry in value:
        if not isinstance(entry, dict):
            continue
        key = str(entry.get("key", "")).strip()
        question_target_text = str(entry.get("question_target_text", "")).strip()
        question_source_text = str(entry.get("question_source_text", "")).strip()
        phrases = sanitize_exercise_entries(entry.get("phrases"))
        if not key or (not phrases and not question_target_text and not question_source_text):
            continue
        cleaned_section = {
            "key": key,
            "phrases": phrases[:MAX_EXERCISE_PHRASES],
        }
        if question_target_text:
            cleaned_section["question_target_text"] = question_target_text
        if question_source_text:
            cleaned_section["question_source_text"] = question_source_text
        sections.append(cleaned_section)
    return sections


def sanitize_exercise_payload(payload) -> dict:
    if not isinstance(payload, dict):
        return {"phrases": []}

    sections = sanitize_exercise_sections(payload.get("sections"))
    phrases = sanitize_exercise_entries(payload.get("phrases"))
    if not phrases and sections:
        phrases = [phrase for section in sections for phrase in section["phrases"]]
    if not phrases:
        phrases = [
            *sanitize_exercise_entries(payload.get("first_section")),
            *sanitize_exercise_entries(payload.get("second_section")),
        ]

    cleaned = {"phrases": phrases[:MAX_EXERCISE_PHRASES]}
    if sections:
        cleaned["sections"] = sections
    generation_mode = str(payload.get("generation_mode", "")).strip()
    if generation_mode:
        cleaned["generation_mode"] = generation_mode
    return cleaned
