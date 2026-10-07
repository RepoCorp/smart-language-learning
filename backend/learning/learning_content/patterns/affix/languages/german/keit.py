from ...definition import AffixExample, AffixPatternDefinition


KEIT = AffixPatternDefinition(
    key="german_suffix_keit",
    language="german",
    affix="-keit",
    position="suffix",
    word_types=("noun",),
    display={
        "en": {
            "title": "-keit",
            "explanation": (
                "Nouns ending in -keit come from adjectives and name a quality or state: "
                "möglich (possible) becomes die Möglichkeit (possibility). These nouns use die."
            ),
        },
        "es": {
            "title": "-keit",
            "explanation": (
                "Los sustantivos terminados en -keit vienen de adjetivos y nombran una cualidad "
                "o un estado: möglich (posible) se convierte en die Möglichkeit (posibilidad). "
                "Estos sustantivos llevan die."
            ),
        },
    },
    item_view="affix_pattern",
    strategies=("affix_examples", "affix_bank_words"),
    exercises=(),
    evaluations={"source_to_target": "affix_production", "target_to_source": "affix_recognition"},
    examples=(
        AffixExample(
            base="möglich",
            result="die Möglichkeit",
            translations={
                "english": {"base": "possible", "result": "the possibility"},
                "spanish": {"base": "posible", "result": "la posibilidad"},
            },
        ),
        AffixExample(
            base="sauber",
            result="die Sauberkeit",
            translations={
                "english": {"base": "clean", "result": "the cleanliness"},
                "spanish": {"base": "limpio", "result": "la limpieza"},
            },
        ),
        AffixExample(
            base="freundlich",
            result="die Freundlichkeit",
            translations={
                "english": {"base": "friendly", "result": "the friendliness"},
                "spanish": {"base": "amable", "result": "la amabilidad"},
            },
        ),
        AffixExample(
            base="traurig",
            result="die Traurigkeit",
            translations={
                "english": {"base": "sad", "result": "the sadness"},
                "spanish": {"base": "triste", "result": "la tristeza"},
            },
        ),
        AffixExample(
            base="höflich",
            result="die Höflichkeit",
            translations={
                "english": {"base": "polite", "result": "the politeness"},
                "spanish": {"base": "cortés", "result": "la cortesía"},
            },
        ),
        AffixExample(
            base="einsam",
            result="die Einsamkeit",
            translations={
                "english": {"base": "lonely", "result": "the loneliness"},
                "spanish": {"base": "solitario", "result": "la soledad"},
            },
        ),
    ),
)
