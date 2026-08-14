from __future__ import annotations

from ...grammar_features import PHRASE_GRAMMAR_FEATURES
from ...languages import language_display_name
from ...prompts import TOPIC_CONVERSATION_ERROR_ANALYSIS_PROMPT
from .topic_conversation_model_support import (
    call_openai_json_logged,
    render_prompt,
    require_question_model,
)

ENGLISH_FEATURE_TITLES = {
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


def _feature_catalog(source_language: str) -> str:
    titles = SPANISH_FEATURE_TITLES if source_language == "spanish" else ENGLISH_FEATURE_TITLES
    return "\n".join(
        f"- Title: {titles[feature_key]}\n  Definition: {description}"
        for feature_key, description in PHRASE_GRAMMAR_FEATURES.items()
    )


def analyze_conversation_turn_error(
    *,
    original_text: str,
    corrected_text: str,
    source_language: str,
    target_language: str,
) -> str:
    original_clean = str(original_text).strip()
    corrected_clean = str(corrected_text).strip()
    if not original_clean or not corrected_clean:
        raise RuntimeError("Both the original and corrected texts are required")

    source_name = language_display_name(source_language)
    target_name = language_display_name(target_language)
    feature_catalog = _feature_catalog(source_language)
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
    error_text = str(parsed.get("error_text", "")).strip() if isinstance(parsed, dict) else ""
    if not error_text:
        raise RuntimeError("Question model request failed")
    return error_text[:1600]
