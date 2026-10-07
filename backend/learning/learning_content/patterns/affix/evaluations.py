from .definition import AffixPatternDefinition


def prepare_recognition(definition: AffixPatternDefinition, source_language: str, version: int):
    if not definition.examples:
        return None
    example = definition.examples[version % len(definition.examples)]
    translation = example.translations.get(source_language)
    if not translation:
        return None
    return {
        "base": example.base,
        "base_translation": translation["base"],
        "word": example.result,
        "answer": translation["result"],
    }


def prepare_production(definition: AffixPatternDefinition, source_language: str, version: int):
    if not definition.examples:
        return None
    example = definition.examples[version % len(definition.examples)]
    translation = example.translations.get(source_language)
    if not translation:
        return None
    affix = definition.affix.strip("-")
    start = {"prefix": 0, "suffix": len(example.result) - len(affix)}[definition.position]
    if not affix or example.result[start:start + len(affix)].casefold() != affix.casefold():
        return None
    return {
        "base": example.base,
        "base_translation": translation["base"],
        "meaning": translation["result"],
        "answer": example.result,
        "highlight": [start, start + len(affix)],
    }
