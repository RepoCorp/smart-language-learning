import re

from django.db.models.functions import Trim


def matching_words(items, definition):
    affix = re.escape(definition.affix.strip("-"))
    patterns = {
        "prefix": rf"(^|\s){affix}\S{{2,}}$",
        "suffix": rf"(^|\s)\S{{2,}}{affix}$",
    }
    return items.alias(match_text=Trim("german_text")).filter(
        word_type__in=definition.word_types,
        match_text__iregex=patterns[definition.position],
    )
