from learning.learning_content.patterns.affix import AffixPatternDefinition
from learning.learning_content.patterns.affix.languages.german.keit import KEIT
from learning.word_formation.german import PATTERNS


def test_keit_preserves_existing_identity_and_noun_restriction():
    assert isinstance(KEIT, AffixPatternDefinition)
    assert KEIT.key == "german_suffix_keit"
    assert KEIT.language == "german"
    assert KEIT.affix == "-keit"
    assert KEIT.position == "suffix"
    assert KEIT.word_types == ("noun",)


def test_all_six_examples_preserve_catalog_order_and_include_the_article():
    existing = PATTERNS[KEIT.key]
    assert len(KEIT.examples) == len(existing) == 6
    for example, old in zip(KEIT.examples, existing):
        assert example.base == old.base
        assert example.result == f"die {old.answer}"
        assert example.translations == {
            language: {"base": base, "result": {"spanish": "la ", "english": "the "}[language] + result}
            for language, (base, result) in old.translations.items()
        }


def test_display_has_both_interface_languages():
    assert set(KEIT.display) == {"en", "es"}
    assert KEIT.display["en"] == {
        "title": "-keit",
        "explanation": (
            "Nouns ending in -keit come from adjectives and name a quality or state: "
            "möglich (possible) becomes die Möglichkeit (possibility). These nouns use die."
        ),
    }
    assert KEIT.display["es"] == {
        "title": "-keit",
        "explanation": (
            "Los sustantivos terminados en -keit vienen de adjetivos y nombran una cualidad "
            "o un estado: möglich (posible) se convierte en die Möglichkeit (posibilidad). "
            "Estos sustantivos llevan die."
        ),
    }


def test_hardcoded_examples_and_both_evaluations_are_configured():
    assert KEIT.item_view == "affix_pattern"
    assert KEIT.strategies == ("affix_examples",)
    assert KEIT.exercises == ()
    assert KEIT.evaluations == {"source_to_target": "affix_production", "target_to_source": "affix_recognition"}
