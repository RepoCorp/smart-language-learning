VERB_POSITION_MAIN_CLAUSE = "verb_position_main_clause"
VERB_POSITION_YES_NO_QUESTION = "verb_position_yes_no_question"
VERB_POSITION_W_QUESTION = "verb_position_w_question"
VERB_POSITION_SUBORDINATE_CLAUSE = "verb_position_subordinate_clause"
TIME_EXPRESSION_POSITION = "time_expression_position"
SEPARABLE_VERB_MAIN_CLAUSE = "separable_verb_main_clause"
MODAL_VERB_WITH_INFINITIVE = "modal_verb_with_infinitive"
REFLEXIVE_VERB = "reflexive_verb"
AUXILIARY_VERB = "auxiliary_verb"
PAST_PARTICIPLE = "past_participle"
PERFECT_WITH_HABEN_OR_SEIN = "perfect_with_haben_or_sein"
IMPERATIVE = "imperative"
KONJUNKTIV_II = "konjunktiv_ii"
NEGATION_NICHT = "negation_nicht"
NEGATION_KEIN = "negation_kein"
PREPOSITION_ACCUSATIVE = "preposition_accusative"
PREPOSITION_DATIVE = "preposition_dative"
TWO_WAY_PREPOSITION_LOCATION = "two_way_preposition_location"
TWO_WAY_PREPOSITION_DIRECTION = "two_way_preposition_direction"
ADJECTIVE_ENDING_GENDER = "adjective_ending_gender"
ADJECTIVE_ENDING_CASE = "adjective_ending_case"

PHRASE_GRAMMAR_FEATURES = {
    VERB_POSITION_MAIN_CLAUSE: (
        "Finite/conjugated verb is in the second syntactic position of a German main declarative clause."
    ),
    VERB_POSITION_YES_NO_QUESTION: (
        "Finite/conjugated verb is in the first syntactic position of a German yes/no question."
    ),
    VERB_POSITION_W_QUESTION: (
        "Finite/conjugated verb appears immediately after the question word in a German W-question."
    ),
    VERB_POSITION_SUBORDINATE_CLAUSE: (
        "Finite/conjugated verb appears at the end of a subordinate clause introduced by a "
        "subordinating conjunction such as weil, dass, or wenn."
    ),
    TIME_EXPRESSION_POSITION: (
        "Time expressions such as heute, morgen, or am Montag commonly appear early in the sentence; "
        "when placed first, the conjugated verb remains in second position."
    ),
    SEPARABLE_VERB_MAIN_CLAUSE: (
        "A separable verb is split in a main clause, with the conjugated verb stem and its "
        "separable prefix appearing in different positions."
    ),
    MODAL_VERB_WITH_INFINITIVE: (
        "A conjugated modal verb appears with another verb in the infinitive at the end of the clause."
    ),
    REFLEXIVE_VERB: (
        "The sentence contains a reflexive verb used with a reflexive pronoun that refers back to the subject."
    ),
    AUXILIARY_VERB: (
        "The sentence uses haben, sein, or werden as an auxiliary verb to form another grammatical construction."
    ),
    PAST_PARTICIPLE: (
        "The sentence contains a German past participle (Partizip II), such as gemacht, gesehen, or gegangen."
    ),
    PERFECT_WITH_HABEN_OR_SEIN: (
        "The sentence uses haben or sein together with a past participle to form the Perfekt tense."
    ),
    IMPERATIVE: (
        "The sentence contains a verb in the imperative form used to give a direct instruction, request, or command."
    ),
    KONJUNKTIV_II: (
        "The sentence clearly uses Konjunktiv II, such as würde, wäre, hätte, könnte, or möchte, "
        "to express a hypothetical situation, wish, suggestion, or polite request."
    ),
    NEGATION_NICHT: (
        "The sentence uses nicht to negate a verb, adjective, adverb, phrase, or sentence."
    ),
    NEGATION_KEIN: (
        "The sentence uses kein or one of its inflected forms to negate a noun."
    ),
    PREPOSITION_ACCUSATIVE: (
        "The sentence contains a preposition that requires the following noun or pronoun to be in "
        "the accusative case, such as für, ohne, durch, gegen, or um."
    ),
    PREPOSITION_DATIVE: (
        "The sentence contains a preposition that requires the following noun, pronoun, or nominal "
        "expression to be in the dative case, such as mit, nach, aus, zu, von, or bei."
    ),
    TWO_WAY_PREPOSITION_LOCATION: (
        "The sentence uses a two-way preposition (Wechselpräposition) with the dative case to "
        "express location (Wo?)."
    ),
    TWO_WAY_PREPOSITION_DIRECTION: (
        "The sentence uses a two-way preposition (Wechselpräposition) with the accusative case to "
        "express destination or change of location (Wohin?)."
    ),
    ADJECTIVE_ENDING_GENDER: (
        "The sentence contains an adjective before a noun whose ending reflects the noun's grammatical gender."
    ),
    ADJECTIVE_ENDING_CASE: (
        "The sentence contains an adjective before a noun whose ending reflects the noun's grammatical case."
    ),
}
