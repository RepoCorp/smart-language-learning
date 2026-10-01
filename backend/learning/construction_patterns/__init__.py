import json
import re
from dataclasses import dataclass

from .german import PATTERNS as GERMAN_PATTERNS

CATALOGS = {"german": GERMAN_PATTERNS}


def prompt_catalog(language):
    catalog = CATALOGS.get(language, {})
    return json.dumps({key: entry["definition"] for key, entry in catalog.items()}, ensure_ascii=False)


@dataclass(frozen=True)
class ConstructionMatch:
    preview: dict
    word: tuple[str, str, str, str] | None = None


def parse_construction(parsed, *, language, clicked_word, context, enabled):
    if not isinstance(parsed, dict):
        raise RuntimeError("Dialog word resolution failed")
    if enabled and language in CATALOGS and "construction_pattern_key" not in parsed:
        raise RuntimeError("Missing construction classification")
    key = parsed.get("construction_pattern_key")
    if key is None:
        if parsed.get("construction_evidence") not in (None, []):
            raise RuntimeError("Construction evidence without a pattern")
        return None
    catalog = CATALOGS.get(language, {}) if enabled else {}
    if not isinstance(key, str) or key not in catalog:
        raise RuntimeError("Unknown construction pattern")
    evidence = parsed.get("construction_evidence")
    if (not isinstance(evidence, list) or len(evidence) < 2
            or any(not isinstance(part, str) or not part.strip()
                   or not re.search(r"(?<!\w)" + re.escape(part) + r"(?!\w)", context)
                   for part in evidence)
            or clicked_word not in evidence or len(set(evidence)) != len(evidence)):
        raise RuntimeError("Invalid construction evidence")
    source = parsed.get("source_text")
    note = parsed.get("note")
    if not isinstance(source, str) or not source.strip() or not isinstance(note, str) or not note.strip():
        raise RuntimeError("Missing construction explanation")
    definition = catalog[key]
    return {
        "key": key,
        "form": definition["form"],
        "meaning": source.strip(),
        "explanation": note.strip(),
        "example": context,
        "matched_parts": evidence,
        "replaces_word": definition.get("replaces_word", True),
    }
