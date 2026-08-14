import { useEffect, useState } from "react";

import { analyzeContentItemPhraseGrammarFeatures, fetchContentItemPhraseGrammarExamples } from "../../apiStrategies";
import type { StudyLanguageCode } from "../../types";
import {
  PHRASE_GRAMMAR_FEATURE_KEYS,
  type PhraseGrammarFeatureKey,
  type PhraseGrammarFeatureState,
} from "./phraseGrammarTypes";

function initialFeatureState(): PhraseGrammarFeatureState {
  return {
    isOpen: false,
    isLoading: false,
    featurePresent: null,
    error: "",
    examples: [],
    examplesVisible: false,
    isLoadingExamples: false,
  };
}

function initialFeatures(): Record<PhraseGrammarFeatureKey, PhraseGrammarFeatureState> {
  return Object.fromEntries(
    PHRASE_GRAMMAR_FEATURE_KEYS.map((key) => [key, initialFeatureState()]),
  ) as Record<PhraseGrammarFeatureKey, PhraseGrammarFeatureState>;
}

export function usePhraseGrammarFeatures({
  itemId,
  sourceLanguage,
  targetLanguage,
}: {
  itemId: number;
  sourceLanguage: StudyLanguageCode;
  targetLanguage: StudyLanguageCode;
}) {
  const [features, setFeatures] = useState(initialFeatures);

  useEffect(() => {
    setFeatures(initialFeatures());
  }, [itemId]);

  const toggleFeature = (featureKey: PhraseGrammarFeatureKey): void => {
    const feature = features[featureKey];
    const nextOpen = !feature.isOpen;
    setFeatures((current) => ({
      ...current,
      [featureKey]: { ...current[featureKey], isOpen: nextOpen },
    }));
    if (!nextOpen || feature.featurePresent !== null || feature.isLoading || itemId <= 0) return;
    setFeatures((current) => ({
      ...current,
      [featureKey]: { ...current[featureKey], isLoading: true, error: "" },
    }));
    void analyzeContentItemPhraseGrammarFeatures(itemId, featureKey, sourceLanguage, targetLanguage)
      .then((response) => setFeatures((current) => ({
        ...current,
        [featureKey]: { ...current[featureKey], featurePresent: response.feature_present },
      })))
      .catch((requestError) => setFeatures((current) => ({
        ...current,
        [featureKey]: { ...current[featureKey], error: requestError instanceof Error ? requestError.message : "Failed to analyze phrase grammar" },
      })))
      .finally(() => setFeatures((current) => ({
        ...current,
        [featureKey]: { ...current[featureKey], isLoading: false },
      })));
  };

  const showExamples = (featureKey: PhraseGrammarFeatureKey): void => {
    const feature = features[featureKey];
    setFeatures((current) => ({
      ...current,
      [featureKey]: { ...current[featureKey], examplesVisible: true },
    }));
    if (feature.examples.length || feature.isLoadingExamples || itemId <= 0) return;
    setFeatures((current) => ({
      ...current,
      [featureKey]: { ...current[featureKey], isLoadingExamples: true, error: "" },
    }));
    void fetchContentItemPhraseGrammarExamples(itemId, featureKey, sourceLanguage, targetLanguage)
      .then((response) => setFeatures((current) => ({
        ...current,
        [featureKey]: { ...current[featureKey], examples: response.examples || [] },
      })))
      .catch((requestError) => setFeatures((current) => ({
        ...current,
        [featureKey]: { ...current[featureKey], error: requestError instanceof Error ? requestError.message : "Failed to load phrase grammar examples" },
      })))
      .finally(() => setFeatures((current) => ({
        ...current,
        [featureKey]: { ...current[featureKey], isLoadingExamples: false },
      })));
  };

  return { features, toggleFeature, showExamples };
}
