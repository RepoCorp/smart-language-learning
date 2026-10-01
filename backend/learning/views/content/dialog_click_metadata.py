from dataclasses import replace

from ...construction_patterns import ConstructionMatch


def normalize_click_metadata(value, *, normalizer, source_language, target_language, source_line, target_line):
    construction = value if isinstance(value, ConstructionMatch) else None
    if construction:
        if construction.word is None:
            return construction
        value = construction.word
    source_text, target_text, word_type, *rest = value
    note = str(rest[0] if rest else "").strip()
    source_text, target_text, word_type = normalizer(
        source_text=source_text,
        target_text=target_text,
        word_type=word_type,
        source_language=source_language,
        target_language=target_language,
        source_line=source_line,
        target_line=target_line,
    )
    word = (source_text, target_text, word_type, note)
    return replace(construction, word=word) if construction else word
