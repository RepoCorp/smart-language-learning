from __future__ import annotations

from ...grammar_features import phrase_grammar_features_for_language
from ...languages import language_display_name
from ...prompts import TOPIC_CONVERSATION_ERROR_ANALYSIS_PROMPT
from .topic_conversation_model_support import (
    call_openai_json_logged,
    render_prompt,
    require_question_model,
)

ENGLISH_FEATURE_TITLES = {
    "english_subject_verb_object": "Subject, verb, object",
    "english_third_person_s": "Third-person -s",
    "english_be_conjugation": "Verb be",
    "english_do_question": "Question with do",
    "english_do_negation": "Negation with do",
    "english_wh_question": "Information question",
    "english_modal_base_verb": "Modal verb + base verb",
    "english_present_continuous": "Present continuous",
    "english_simple_past": "Simple past",
    "english_past_continuous": "Past continuous",
    "english_present_perfect": "Present perfect",
    "english_future_will": "Future with will",
    "english_infinitive_with_to": "Infinitive with to",
    "english_gerund_after_verb": "Gerund after a verb",
    "english_article_a_an": "Articles: a and an",
    "english_subject_pronoun_required": "Explicit subject pronoun",
    "english_countable_uncountable": "Countable and uncountable nouns",
    "english_adjective_noun_order": "Adjective before noun",
    "english_comparative": "Comparative",
    "english_superlative": "Superlative",
    "adjective_ending_gender": "Adjective ending: gender",
    "adjective_ending_case": "Adjective ending: case",
    "verb_position_main_clause": "Verb position: statement",
    "verb_position_yes_no_question": "Verb position: yes/no question",
    "verb_position_w_question": "Verb position: W-question",
    "verb_position_subordinate_clause": "Verb position: subordinate clause",
    "time_expression_position": "Time expression position",
    "separable_verb_main_clause": "Separable verb",
    "modal_verb_with_infinitive": "Modal verb with infinitive",
    "reflexive_verb": "Reflexive verb",
    "auxiliary_verb": "Auxiliary verb",
    "past_participle": "Past participle",
    "perfect_with_haben_or_sein": "Perfect tense",
    "imperative": "Imperative",
    "konjunktiv_ii": "Konjunktiv II",
    "negation_nicht": "Negation: nicht",
    "negation_kein": "Negation: kein",
    "preposition_accusative": "Accusative preposition",
    "preposition_dative": "Dative preposition",
    "two_way_preposition_location": "Two-way preposition: location",
    "two_way_preposition_direction": "Two-way preposition: direction",
}

SPANISH_FEATURE_TITLES = {
    "english_subject_verb_object": "Sujeto, verbo, objeto",
    "english_third_person_s": "Tercera persona: -s",
    "english_be_conjugation": "Verbo be",
    "english_do_question": "Pregunta con do",
    "english_do_negation": "Negación con do",
    "english_wh_question": "Pregunta de información",
    "english_modal_base_verb": "Verbo modal + verbo base",
    "english_present_continuous": "Presente continuo",
    "english_simple_past": "Pasado simple",
    "english_past_continuous": "Pasado continuo",
    "english_present_perfect": "Presente perfecto",
    "english_future_will": "Futuro con will",
    "english_infinitive_with_to": "Infinitivo con to",
    "english_gerund_after_verb": "Gerundio después de un verbo",
    "english_article_a_an": "Artículos: a y an",
    "english_subject_pronoun_required": "Pronombre sujeto explícito",
    "english_countable_uncountable": "Sustantivos contables y no contables",
    "english_adjective_noun_order": "Adjetivo antes del sustantivo",
    "english_comparative": "Comparativo",
    "english_superlative": "Superlativo",
    "adjective_ending_gender": "Terminación del adjetivo: género",
    "adjective_ending_case": "Terminación del adjetivo: caso",
    "verb_position_main_clause": "Posición del verbo: enunciado",
    "verb_position_yes_no_question": "Posición del verbo: pregunta de sí/no",
    "verb_position_w_question": "Posición del verbo: pregunta con W",
    "verb_position_subordinate_clause": "Posición del verbo: oración subordinada",
    "time_expression_position": "Posición de la expresión temporal",
    "separable_verb_main_clause": "Verbo separable",
    "modal_verb_with_infinitive": "Verbo modal con infinitivo",
    "reflexive_verb": "Verbo reflexivo",
    "auxiliary_verb": "Verbo auxiliar",
    "past_participle": "Participio pasado",
    "perfect_with_haben_or_sein": "Tiempo perfecto",
    "imperative": "Imperativo",
    "konjunktiv_ii": "Konjunktiv II",
    "negation_nicht": "Negación: nicht",
    "negation_kein": "Negación: kein",
    "preposition_accusative": "Preposición con acusativo",
    "preposition_dative": "Preposición con dativo",
    "two_way_preposition_location": "Preposición de dos vías: ubicación",
    "two_way_preposition_direction": "Preposición de dos vías: dirección",
}


def _feature_catalog(source_language: str, target_language: str) -> str:
    titles = _feature_titles(source_language)
    return "\n".join(
        f"- ID: {feature_key}\n  Title: {titles[feature_key]}\n  Definition: {description}"
        for feature_key, description in phrase_grammar_features_for_language(target_language).items()
    )


def _feature_titles(source_language: str) -> dict[str, str]:
    return SPANISH_FEATURE_TITLES if source_language == "spanish" else ENGLISH_FEATURE_TITLES


def analyze_conversation_turn_error(
    *,
    original_text: str,
    corrected_text: str,
    source_language: str,
    target_language: str,
) -> dict[str, object]:
    original_clean = str(original_text).strip()
    corrected_clean = str(corrected_text).strip()
    if not original_clean or not corrected_clean:
        raise RuntimeError("Both the original and corrected texts are required")

    source_name = language_display_name(source_language)
    target_name = language_display_name(target_language)
    grammar_features = phrase_grammar_features_for_language(target_language)
    feature_catalog = _feature_catalog(source_language, target_language)
    parsed = call_openai_json_logged(
        label="analyze_topic_conversation_turn_error",
        system_prompt=render_prompt(
            TOPIC_CONVERSATION_ERROR_ANALYSIS_PROMPT,
            source_name=source_name,
        ),
        user_input=(
            f"Source language: {source_name}\n"
            f"Target language: {target_name}\n"
            f"Learner original message ({target_name}): {original_clean}\n"
            f"Corrected message ({target_name}): {corrected_clean}\n"
            f"Known grammar features:\n{feature_catalog}\n"
        ),
        timeout_seconds=10,
        model=require_question_model(),
        temperature=0.0,
        top_p=1.0,
        presence_penalty=0.0,
        json_mode=True,
    )
    raw_errors = parsed.get("errors") if isinstance(parsed, dict) else None
    if not isinstance(raw_errors, list) or not raw_errors:
        raise RuntimeError("Question model request failed")
    explanations: list[str] = []
    grammar_feature_keys: set[str] = set()
    word_item_targets: list[str] = []
    for raw_error in raw_errors:
        if not isinstance(raw_error, dict):
            raise RuntimeError("Question model request failed")
        explanation = str(raw_error.get("explanation", "")).strip()
        if not explanation:
            raise RuntimeError("Question model request failed")
        explanations.append(explanation)
        feature_key = raw_error.get("grammar_feature_key")
        if feature_key is not None:
            if not isinstance(feature_key, str) or feature_key not in grammar_features:
                raise RuntimeError("Question model request failed")
            grammar_feature_keys.add(feature_key)
        word_target = raw_error.get("word_item_target")
        if isinstance(word_target, str) and word_target.strip():
            word_item_targets.append(word_target.strip())
    error_text = "\n".join(f"- {explanation.lstrip('- ').strip()}" for explanation in explanations)
    return {
        "error_text": error_text[:1600],
        "grammar_feature_keys": sorted(grammar_feature_keys),
        "word_item_targets": word_item_targets[:8],
    }
