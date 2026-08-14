export const PHRASE_GRAMMAR_FEATURE_KEYS = [
  "verb_position_main_clause",
  "verb_position_yes_no_question",
  "verb_position_w_question",
  "verb_position_subordinate_clause",
  "separable_verb_main_clause",
  "modal_verb_with_infinitive",
  "reflexive_verb",
] as const;

export type PhraseGrammarFeatureKey = (typeof PHRASE_GRAMMAR_FEATURE_KEYS)[number];

export type PhraseGrammarFeatureState = {
  isOpen: boolean;
  error: string;
  examples: Array<{ target_text: string; source_text: string }>;
  isLoadingExamples: boolean;
};

export type PhraseGrammarStrategy = {
  featureKeys: PhraseGrammarFeatureKey[];
  features: Record<PhraseGrammarFeatureKey, PhraseGrammarFeatureState>;
  isLoading: boolean;
  error: string;
  refresh: () => void;
  toggleFeature: (featureKey: PhraseGrammarFeatureKey) => void;
};
