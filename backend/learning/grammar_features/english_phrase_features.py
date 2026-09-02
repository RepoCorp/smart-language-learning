SUBJECT_VERB_OBJECT = "english_subject_verb_object"
THIRD_PERSON_S = "english_third_person_s"
BE_CONJUGATION = "english_be_conjugation"
DO_QUESTION = "english_do_question"
DO_NEGATION = "english_do_negation"
WH_QUESTION = "english_wh_question"
MODAL_BASE_VERB = "english_modal_base_verb"
PRESENT_CONTINUOUS = "english_present_continuous"
SIMPLE_PAST = "english_simple_past"
PAST_CONTINUOUS = "english_past_continuous"
PRESENT_PERFECT = "english_present_perfect"
FUTURE_WILL = "english_future_will"
INFINITIVE_WITH_TO = "english_infinitive_with_to"
GERUND_AFTER_VERB = "english_gerund_after_verb"
ARTICLE_A_AN = "english_article_a_an"
SUBJECT_PRONOUN_REQUIRED = "english_subject_pronoun_required"
COUNTABLE_UNCOUNTABLE = "english_countable_uncountable"
ADJECTIVE_NOUN_ORDER = "english_adjective_noun_order"
COMPARATIVE = "english_comparative"
SUPERLATIVE = "english_superlative"

ENGLISH_PHRASE_GRAMMAR_FEATURES = {
    SUBJECT_VERB_OBJECT: (
        "The sentence contains a declarative clause in which the subject appears before the verb "
        "and the verb appears before its direct object."
    ),
    THIRD_PERSON_S: (
        "The sentence contains a present simple verb with the third-person singular ending -s or -es, "
        "used with he, she, it, or an equivalent singular subject."
    ),
    BE_CONJUGATION: (
        "The sentence contains a conjugated form of the verb be whose form changes according to the "
        "subject or tense, such as am, is, are, was, or were."
    ),
    DO_QUESTION: (
        "The sentence uses do, does, or did as an auxiliary verb to form a question with another verb."
    ),
    DO_NEGATION: (
        "The sentence uses do, does, or did together with not to negate another verb."
    ),
    WH_QUESTION: (
        "The sentence is a question introduced by a question word such as what, where, when, why, who, "
        "which, or how."
    ),
    MODAL_BASE_VERB: (
        "The sentence contains a modal verb such as can, could, should, must, may, might, or will "
        "followed by another verb in its base form without to."
    ),
    PRESENT_CONTINUOUS: (
        "The sentence uses a present form of be (am, is, or are) followed by an -ing verb form to "
        "form the present continuous."
    ),
    SIMPLE_PAST: (
        "The sentence contains a verb in the simple past, whether the verb has a regular -ed form "
        "or an irregular past form."
    ),
    PAST_CONTINUOUS: (
        "The sentence uses was or were followed by an -ing verb form to form the past continuous."
    ),
    PRESENT_PERFECT: (
        "The sentence uses have or has followed by a past participle to form the present perfect."
    ),
    FUTURE_WILL: (
        "The sentence uses will followed by a verb in its base form to express a future action, prediction, "
        "decision, or other future meaning."
    ),
    INFINITIVE_WITH_TO: (
        "The sentence contains to followed by the base form of a verb as an infinitive."
    ),
    GERUND_AFTER_VERB: (
        "The sentence contains a verb followed by an -ing form functioning as its complement, as in enjoy reading, "
        "avoid driving, or keep working."
    ),
    ARTICLE_A_AN: (
        "The sentence uses the indefinite article a or an before a singular countable noun."
    ),
    SUBJECT_PRONOUN_REQUIRED: (
        "The sentence contains an explicit subject pronoun in a construction where English requires the "
        "subject to be expressed, including dummy subjects such as it."
    ),
    COUNTABLE_UNCOUNTABLE: (
        "The sentence clearly demonstrates the distinction between countable and uncountable nouns through an "
        "article, number, determiner, or quantity expression."
    ),
    ADJECTIVE_NOUN_ORDER: (
        "The sentence contains an adjective used before the noun it describes."
    ),
    COMPARATIVE: (
        "The sentence contains a comparative adjective or adverb formed with -er, more, or an irregular "
        "comparative form such as better or worse."
    ),
    SUPERLATIVE: (
        "The sentence contains a superlative adjective or adverb formed with -est, most, or an irregular "
        "superlative form such as best or worst."
    ),
}
