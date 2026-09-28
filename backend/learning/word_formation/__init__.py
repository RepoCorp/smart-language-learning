from . import english, german, spanish

CATALOGS = {"english": english.PATTERNS, "german": german.PATTERNS}
QUESTIONS = {"english": english.QUESTION, "spanish": spanish.QUESTION}
SOURCE_LABELS = {"english": english.PATTERN_LABEL, "spanish": spanish.PATTERN_LABEL}
MEANING_QUESTIONS = {"english": english.MEANING_QUESTION, "spanish": spanish.MEANING_QUESTION}


def supports_pair(source, target):
    return source in QUESTIONS and target in CATALOGS and source != target


def exercise_for(target, key, source, review_count, direction="es_to_de"):
    examples = CATALOGS[target][key]
    exercise = examples[review_count % len(examples)].exercise(source, QUESTIONS[source])
    if direction == "de_to_es":
        exercise["question"] = MEANING_QUESTIONS[source].format(word=exercise["answer"])
    return exercise


def item_defaults(source, target, key):
    examples = CATALOGS[target][key]
    labels = dict.fromkeys(f"{e.affix}-" if e.prefix else f"-{e.affix}" for e in examples)
    return {"spanish_text": SOURCE_LABELS[source], "german_text": " / ".join(labels)}


def item_payload(item, direction=None, version=None):
    examples = CATALOGS[item.target_language][item.pattern_key]
    count = version if version is not None else getattr(item, f"review_count_{direction or 'es_to_de'}")
    return {
        "pattern_key": item.pattern_key,
        "review_version": count,
        "pattern_exercise": exercise_for(item.target_language, item.pattern_key, item.source_language, count, direction),
        "pattern_examples": [e.exercise(item.source_language, QUESTIONS[item.source_language]) for e in examples],
    }
