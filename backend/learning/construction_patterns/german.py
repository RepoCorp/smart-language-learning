"""Closed catalog for contextual word-click resolution, not exercise content."""

PATTERNS = {
    "future_with_werden": {
        "form": "werden + Infinitiv",
        "definition": "A form of werden introduces a future action with an infinitive. Only selecting the auxiliary triggers this pattern, never selecting the infinitive. Er wird kommen: wird triggers it, kommen stays a word. Er wird müde does not match.",
    },
    "conditional_with_wuerde": {
        "form": "würde + Infinitiv",
        "definition": "A form of würde with an infinitive expresses a hypothetical action or polite proposal. Only selecting the auxiliary triggers it. Ich würde kommen: würde triggers it, kommen stays a word. Do not label this future_with_werden.",
    },
    "passive_with_werden": {
        "form": "werden + Partizip II",
        "definition": "A form of werden with a past participle forms the passive. Only selecting the passive auxiliary triggers it. Das Essen wird gekocht: wird triggers it, gekocht stays a word. Do not label lexical werden or future werden as passive.",
    },
    "perfect_with_haben": {
        "form": "haben + Partizip II",
        "definition": "A form of haben with a past participle forms the Perfekt. Only selecting the auxiliary triggers it. Ich habe gegessen: habe triggers it, gegessen stays a word. Ich habe Hunger does not match.",
    },
    "perfect_with_sein": {
        "form": "sein + Partizip II",
        "definition": "A form of sein with a past participle forms the Perfekt. Only selecting the auxiliary triggers it. Ich bin gegangen: bin triggers it, gegangen stays a word. Ich bin müde and adjectival/passive states do not match.",
    },
    "separable_verb": {
        "form": "aufstehen → Ich stehe auf",
        "definition": "The clicked token is either component of a separable verb split in this clause. Ich stehe auf: either stehe or auf identifies the word aufstehen, not stehen or the preposition auf. Return the complete lexical infinitive as target_text and verb as word_type. Auf dem Tisch does not match. This pattern accompanies the word; it never replaces it.",
        "replaces_word": False,
    },
}
