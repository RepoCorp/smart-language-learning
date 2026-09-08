export const PHRASE_GRAMMAR_FEATURE_KEYS = [
  "verb_position_main_clause",
  "verb_position_yes_no_question",
  "verb_position_w_question",
  "verb_position_subordinate_clause",
  "time_expression_position",
  "separable_verb_main_clause",
  "modal_verb_with_infinitive",
  "reflexive_verb",
  "auxiliary_verb",
  "past_participle",
  "perfect_with_haben_or_sein",
  "imperative",
  "konjunktiv_ii",
  "negation_nicht",
  "negation_kein",
  "preposition_accusative",
  "preposition_dative",
  "two_way_preposition_location",
  "two_way_preposition_direction",
  "adjective_ending_gender",
  "adjective_ending_case",
  "english_subject_verb_object",
  "english_third_person_s",
  "english_be_conjugation",
  "english_do_question",
  "english_do_negation",
  "english_wh_question",
  "english_modal_base_verb",
  "english_present_continuous",
  "english_simple_past",
  "english_past_continuous",
  "english_present_perfect",
  "english_future_will",
  "english_infinitive_with_to",
  "english_gerund_after_verb",
  "english_article_a_an",
  "english_subject_pronoun_required",
  "english_countable_uncountable",
  "english_adjective_noun_order",
  "english_comparative",
  "english_superlative",
  "spanish_subject_verb_agreement",
  "spanish_omitted_subject",
  "spanish_adjective_gender_agreement",
  "spanish_adjective_number_agreement",
  "spanish_adjective_after_noun",
  "spanish_ser_usage",
  "spanish_estar_usage",
  "spanish_hay_usage",
  "spanish_direct_object_pronoun",
  "spanish_indirect_object_pronoun",
  "spanish_object_pronoun_before_verb",
  "spanish_reflexive_verb",
  "spanish_gustar_type_construction",
  "spanish_negation_no",
  "spanish_personal_a",
  "spanish_preposition_a_destination",
  "spanish_por_usage",
  "spanish_para_usage",
  "spanish_estar_with_gerund",
] as const;

export type PhraseGrammarFeatureKey = (typeof PHRASE_GRAMMAR_FEATURE_KEYS)[number];

export type PhraseGrammarFeatureState = {
  isOpen: boolean;
  error: string;
  examples: Array<{ item_id: number; target_text: string; source_text: string; audio_url: string }>;
  isLoadingExamples: boolean;
};

export type PhraseGrammarStrategy = {
  featureKeys: PhraseGrammarFeatureKey[];
  features: Record<PhraseGrammarFeatureKey, PhraseGrammarFeatureState>;
  isLoading: boolean;
  error: string;
  toggleFeature: (featureKey: PhraseGrammarFeatureKey) => void;
};
