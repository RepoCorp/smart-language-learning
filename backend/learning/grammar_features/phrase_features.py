VERB_POSITION_MAIN_CLAUSE = "verb_position_main_clause"
VERB_POSITION_YES_NO_QUESTION = "verb_position_yes_no_question"
VERB_POSITION_W_QUESTION = "verb_position_w_question"
VERB_POSITION_SUBORDINATE_CLAUSE = "verb_position_subordinate_clause"
SEPARABLE_VERB_MAIN_CLAUSE = "separable_verb_main_clause"
MODAL_VERB_WITH_INFINITIVE = "modal_verb_with_infinitive"
REFLEXIVE_VERB = "reflexive_verb"

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
}
