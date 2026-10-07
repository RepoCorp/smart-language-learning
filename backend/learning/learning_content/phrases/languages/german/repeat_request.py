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
            "explanation": "A polite way to ask someone to repeat what they said. Sie is the formal way to address them.",
        },
        "es": {
            "title": "Könnten Sie das bitte wiederholen?",
            "explanation": "Una forma cortés de pedir que alguien repita lo que dijo. Sie se usa para dirigirse a esa persona de usted.",
        },
    },
    item_view="phrase",
    strategies=(),
    exercises=(),
    evaluations={},
)
