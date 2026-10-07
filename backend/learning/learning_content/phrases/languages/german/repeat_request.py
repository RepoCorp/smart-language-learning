from ...definition import PhraseDefinition


REPEAT_REQUEST = PhraseDefinition(
    key="german_phrase_repeat_request",
    language="german",
    text="Könnten Sie das bitte wiederholen?",
    translations={
        "english": "Could you please repeat that?",
        "spanish": "¿Podría repetir eso, por favor?",
    },
    display={
        "en": {
            "title": "Könnten Sie das bitte wiederholen?",
            "explanation": "Sie is the formal way to address someone.",
        },
        "es": {
            "title": "Könnten Sie das bitte wiederholen?",
            "explanation": "Sie se usa para dirigirse a alguien de usted.",
        },
    },
    item_view="phrase",
    strategies=(),
    exercises=(),
    evaluations={},
)
