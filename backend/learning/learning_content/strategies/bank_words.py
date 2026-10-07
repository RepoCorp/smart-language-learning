from django.db.models.functions import Length

from ..catalog import DEFINITIONS
from ..patterns.affix.bank_words import matching_words


MATCHERS = {"affix_bank_words": matching_words}
DEFINITIONS_BY_KEY = {definition.key: definition for definition in DEFINITIONS}
PAGE_SIZE = 20


def word_page(items, definition, matcher, offset):
    matches = matcher(items, definition).order_by(Length("german_text"), "pk")
    rows = list(matches.values("id", "german_text", "spanish_text")[offset:offset + PAGE_SIZE + 1])
    return {
        "words": [{"id": row["id"], "text": row["german_text"], "translation": row["spanish_text"]}
                  for row in rows[:PAGE_SIZE]],
        "next_offset": offset + PAGE_SIZE if len(rows) > PAGE_SIZE else None,
    }
