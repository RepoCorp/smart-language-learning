SUBJECT_VERB_AGREEMENT = "spanish_subject_verb_agreement"
OMITTED_SUBJECT = "spanish_omitted_subject"
ADJECTIVE_GENDER_AGREEMENT = "spanish_adjective_gender_agreement"
ADJECTIVE_NUMBER_AGREEMENT = "spanish_adjective_number_agreement"
ADJECTIVE_AFTER_NOUN = "spanish_adjective_after_noun"
SER_USAGE = "spanish_ser_usage"
ESTAR_USAGE = "spanish_estar_usage"
HAY_USAGE = "spanish_hay_usage"
DIRECT_OBJECT_PRONOUN = "spanish_direct_object_pronoun"
INDIRECT_OBJECT_PRONOUN = "spanish_indirect_object_pronoun"
OBJECT_PRONOUN_BEFORE_VERB = "spanish_object_pronoun_before_verb"
REFLEXIVE_VERB = "spanish_reflexive_verb"
GUSTAR_TYPE_CONSTRUCTION = "spanish_gustar_type_construction"
NEGATION_NO = "spanish_negation_no"
PERSONAL_A = "spanish_personal_a"
PREPOSITION_A_DESTINATION = "spanish_preposition_a_destination"
POR_USAGE = "spanish_por_usage"
PARA_USAGE = "spanish_para_usage"
ESTAR_WITH_GERUND = "spanish_estar_with_gerund"

SPANISH_PHRASE_GRAMMAR_FEATURES = {
    SUBJECT_VERB_AGREEMENT: (
        "The subject and a finite verb agree in grammatical person and number."
    ),
    OMITTED_SUBJECT: (
        "The grammatical subject is not explicitly stated because it can be understood from the conjugated verb "
        "or context."
    ),
    ADJECTIVE_GENDER_AGREEMENT: (
        "An adjective agrees in grammatical gender with the noun it describes."
    ),
    ADJECTIVE_NUMBER_AGREEMENT: (
        "An adjective agrees in grammatical number with the noun it describes."
    ),
    ADJECTIVE_AFTER_NOUN: (
        "An adjective appears after the noun it describes, demonstrating the common Spanish noun plus adjective order."
    ),
    SER_USAGE: (
        "A conjugated form of ser is used to express identity, classification, origin, profession, time, or a "
        "characteristic presented as defining the subject."
    ),
    ESTAR_USAGE: (
        "A conjugated form of estar is used to express a state, condition, or location."
    ),
    HAY_USAGE: (
        "Hay is used to express the existence or presence of one or more people or things."
    ),
    DIRECT_OBJECT_PRONOUN: (
        "A direct-object pronoun such as lo, la, los, or las replaces or refers to the direct object of a verb."
    ),
    INDIRECT_OBJECT_PRONOUN: (
        "An indirect-object pronoun such as me, te, le, nos, os, or les represents the recipient, beneficiary, "
        "or other indirect object of the verb."
    ),
    OBJECT_PRONOUN_BEFORE_VERB: (
        "An unstressed object pronoun appears immediately before a conjugated verb."
    ),
    REFLEXIVE_VERB: (
        "A reflexive pronoun is used with a verb and refers back to the verb's subject."
    ),
    GUSTAR_TYPE_CONSTRUCTION: (
        "A verb such as gustar is used in a construction where an indirect-object pronoun identifies the "
        "experiencer and the grammatical subject is the thing that causes the feeling, reaction, or experience."
    ),
    NEGATION_NO: (
        "No appears before a verb or verb phrase to negate it."
    ),
    PERSONAL_A: (
        "The preposition a introduces a specific or identifiable person, or a person-like entity, functioning as "
        "a direct object."
    ),
    PREPOSITION_A_DESTINATION: (
        "The preposition a introduces a destination or endpoint of movement."
    ),
    POR_USAGE: (
        "Por is used in one of its common roles, such as expressing cause, reason, means, exchange, duration, "
        "movement through a place, or something done on behalf of or because of someone."
    ),
    PARA_USAGE: (
        "Para is used in one of its common roles, such as expressing purpose, intended recipient, destination, "
        "deadline, or goal."
    ),
    ESTAR_WITH_GERUND: (
        "A conjugated form of estar is followed by a gerund (-ando or -iendo form) to describe an action in progress."
    ),
}
