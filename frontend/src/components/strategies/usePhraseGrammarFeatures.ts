import { useEffect, useState } from "react";

import { analyzeContentItemPhraseGrammarFeatures, fetchContentItemPhraseGrammarExamples } from "../../apiStrategies";
import type { StudyLanguageCode } from "../../types";
import {
  PHRASE_GRAMMAR_FEATURE_KEYS,
  type PhraseGrammarFeatureKey,
  type PhraseGrammarFeatureState,
} from "./phraseGrammarTypes";

const analysisCache = new Map<string, PhraseGrammarFeatureKey[]>();
const pendingAnalyses = new Map<string, Promise<PhraseGrammarFeatureKey[]>>();

function initialFeatureState(): PhraseGrammarFeatureState {
  return {
    isOpen: false,
    error: "",
    examples: [],
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
  enabled,
}: {
  itemId: number;
  sourceLanguage: StudyLanguageCode;
  targetLanguage: StudyLanguageCode;
  enabled: boolean;
}) {
  const [features, setFeatures] = useState(initialFeatures);
  const [featureKeys, setFeatureKeys] = useState<PhraseGrammarFeatureKey[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const analyze = (force = false): void => {
    const analysisKey = `${itemId}:${sourceLanguage}:${targetLanguage}`;
    if (itemId <= 0 || isLoading) {
      return;
    }
    if (!force && analysisCache.has(analysisKey)) {
      setFeatureKeys(analysisCache.get(analysisKey) || []);
      return;
    }
    setIsLoading(true);
    setError("");
    const pendingAnalysis = force
      ? createAnalysis(itemId, sourceLanguage, targetLanguage)
      : pendingAnalyses.get(analysisKey) || createAnalysis(itemId, sourceLanguage, targetLanguage);
    if (!force && !pendingAnalyses.has(analysisKey)) {
      pendingAnalyses.set(analysisKey, pendingAnalysis);
    }
    void pendingAnalysis
      .then((detected) => {
        analysisCache.set(analysisKey, detected);
        setFeatureKeys(detected);
      })
      .catch((requestError) => {
        setError(requestError instanceof Error ? requestError.message : "Failed to analyze phrase grammar");
      })
      .finally(() => {
        pendingAnalyses.delete(analysisKey);
        setIsLoading(false);
      });
  };

  useEffect(() => {
    setFeatures(initialFeatures());
    setFeatureKeys([]);
    setIsLoading(false);
    setError("");
  }, [itemId]);

  useEffect(() => {
    if (enabled) analyze();
  }, [enabled, itemId, sourceLanguage, targetLanguage]);

  const loadExamples = (featureKey: PhraseGrammarFeatureKey): void => {
    const feature = features[featureKey];
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

  const toggleFeature = (featureKey: PhraseGrammarFeatureKey): void => {
    const willOpen = !features[featureKey].isOpen;
    setFeatures((current) => ({
      ...current,
      [featureKey]: { ...current[featureKey], isOpen: willOpen },
    }));
    if (willOpen) loadExamples(featureKey);
  };

  return { featureKeys, features, isLoading, error, refresh: () => analyze(true), toggleFeature };
}

function createAnalysis(
  itemId: number,
  sourceLanguage: StudyLanguageCode,
  targetLanguage: StudyLanguageCode,
): Promise<PhraseGrammarFeatureKey[]> {
  return analyzeContentItemPhraseGrammarFeatures(itemId, sourceLanguage, targetLanguage)
    .then((response) => response.feature_keys.filter(
      (key): key is PhraseGrammarFeatureKey => PHRASE_GRAMMAR_FEATURE_KEYS.includes(key as PhraseGrammarFeatureKey),
    ));
}
