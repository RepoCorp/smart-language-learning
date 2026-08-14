export const PHRASE_GRAMMAR_FEATURE_KEYS = [
  "verb_position_main_clause",
  "verb_position_yes_no_question",
] as const;

export type PhraseGrammarFeatureKey = (typeof PHRASE_GRAMMAR_FEATURE_KEYS)[number];

export type PhraseGrammarFeatureState = {
  isOpen: boolean;
  isLoading: boolean;
  featurePresent: boolean | null;
  error: string;
  examples: Array<{ target_text: string; source_text: string }>;
  examplesVisible: boolean;
  isLoadingExamples: boolean;
};

export type PhraseGrammarStrategy = {
  features: Record<PhraseGrammarFeatureKey, PhraseGrammarFeatureState>;
  toggleFeature: (featureKey: PhraseGrammarFeatureKey) => void;
  showExamples: (featureKey: PhraseGrammarFeatureKey) => void;
};
