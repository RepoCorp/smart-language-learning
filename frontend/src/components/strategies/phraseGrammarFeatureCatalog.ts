import type { StudyLanguageCode } from "../../types";
import { ENGLISH_PHRASE_GRAMMAR_FEATURE_PRESENTATION } from "./englishPhraseGrammarFeaturePresentation";
import { GERMAN_PHRASE_GRAMMAR_FEATURE_PRESENTATION } from "./germanPhraseGrammarFeaturePresentation";
import type { PhraseGrammarFeaturePresentation } from "./phraseGrammarFeaturePresentationTypes";
import type { PhraseGrammarFeatureKey } from "./phraseGrammarTypes";

export function phraseGrammarFeaturePresentationFor(
  targetLanguage: StudyLanguageCode,
  featureKey: PhraseGrammarFeatureKey,
): PhraseGrammarFeaturePresentation | undefined {
  if (targetLanguage === "german") return GERMAN_PHRASE_GRAMMAR_FEATURE_PRESENTATION[featureKey];
  if (targetLanguage === "english") return ENGLISH_PHRASE_GRAMMAR_FEATURE_PRESENTATION[featureKey];
  return undefined;
}

export function supportsPhraseGrammar(targetLanguage: StudyLanguageCode): boolean {
  return targetLanguage === "german" || targetLanguage === "english";
}
