import type { StudyLanguageCode } from "../../types";
import { ENGLISH_PHRASE_GRAMMAR_FEATURE_PRESENTATION } from "./englishPhraseGrammarFeaturePresentation";
import { GERMAN_PHRASE_GRAMMAR_FEATURE_PRESENTATION } from "./germanPhraseGrammarFeaturePresentation";
import { SPANISH_PHRASE_GRAMMAR_FEATURE_PRESENTATION } from "./spanishPhraseGrammarFeaturePresentation";
import type { PhraseGrammarFeaturePresentation } from "./phraseGrammarFeaturePresentationTypes";
import type { PhraseGrammarFeatureKey } from "./phraseGrammarTypes";

export function phraseGrammarFeaturePresentationFor(
  targetLanguage: StudyLanguageCode,
  featureKey: PhraseGrammarFeatureKey,
): PhraseGrammarFeaturePresentation | undefined {
  if (targetLanguage === "german") {
    return (GERMAN_PHRASE_GRAMMAR_FEATURE_PRESENTATION as Partial<Record<PhraseGrammarFeatureKey, PhraseGrammarFeaturePresentation>>)[featureKey];
  }
  if (targetLanguage === "english") {
    return (ENGLISH_PHRASE_GRAMMAR_FEATURE_PRESENTATION as Partial<Record<PhraseGrammarFeatureKey, PhraseGrammarFeaturePresentation>>)[featureKey];
  }
  if (targetLanguage === "spanish") {
    return (SPANISH_PHRASE_GRAMMAR_FEATURE_PRESENTATION as Partial<Record<PhraseGrammarFeatureKey, PhraseGrammarFeaturePresentation>>)[featureKey];
  }
  return undefined;
}

export function supportsPhraseGrammar(targetLanguage: StudyLanguageCode): boolean {
  return targetLanguage === "german" || targetLanguage === "english" || targetLanguage === "spanish";
}
