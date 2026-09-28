from dataclasses import dataclass


@dataclass(frozen=True)
class Example:
    base: str
    answer: str
    affix: str
    translations: dict[str, tuple[str, str]]
    prefix: bool = False

    def exercise(self, source, question):
        base_translation, meaning = self.translations[source]
        start = 0 if self.prefix else len(self.answer) - len(self.affix)
        return {
            "base": self.base,
            "base_translation": base_translation,
            "meaning": meaning,
            "question": question.format(meaning=meaning),
            "answer": self.answer,
            "highlight": [start, start + len(self.affix)],
        }
