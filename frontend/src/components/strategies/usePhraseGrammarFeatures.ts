import { useEffect, useState } from "react";

import { analyzeContentItemPhraseGrammarFeatures, fetchContentItemPhraseGrammarExamples } from "../../apiStrategies";
import type { StudyLanguageCode } from "../../types";

export function usePhraseGrammarFeatures({
  itemId,
  sourceLanguage,
  targetLanguage,
}: {
  itemId: number;
  sourceLanguage: StudyLanguageCode;
  targetLanguage: StudyLanguageCode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [featurePresent, setFeaturePresent] = useState<boolean | null>(null);
  const [error, setError] = useState("");
  const [examples, setExamples] = useState<Array<{ target_text: string; source_text: string }>>([]);
  const [examplesVisible, setExamplesVisible] = useState(false);
  const [isLoadingExamples, setIsLoadingExamples] = useState(false);

  useEffect(() => {
    setIsOpen(false);
    setIsLoading(false);
    setFeaturePresent(null);
    setError("");
    setExamples([]);
    setExamplesVisible(false);
    setIsLoadingExamples(false);
  }, [itemId]);

  const toggleVerbPosition = (): void => {
    const nextOpen = !isOpen;
    setIsOpen(nextOpen);
    if (!nextOpen || featurePresent !== null || isLoading || itemId <= 0) return;
    setIsLoading(true);
    setError("");
    void analyzeContentItemPhraseGrammarFeatures(itemId, sourceLanguage, targetLanguage)
      .then((response) => setFeaturePresent(response.feature_present))
      .catch((requestError) => setError(requestError instanceof Error ? requestError.message : "Failed to analyze phrase grammar"))
      .finally(() => setIsLoading(false));
  };

  const showExamples = (): void => {
    setExamplesVisible(true);
    if (examples.length || isLoadingExamples || itemId <= 0) return;
    setIsLoadingExamples(true);
    setError("");
    void fetchContentItemPhraseGrammarExamples(itemId, sourceLanguage, targetLanguage)
      .then((response) => setExamples(response.examples || []))
      .catch((requestError) => setError(requestError instanceof Error ? requestError.message : "Failed to load phrase grammar examples"))
      .finally(() => setIsLoadingExamples(false));
  };

  return { isOpen, isLoading, featurePresent, error, toggleVerbPosition, examples, examplesVisible, isLoadingExamples, showExamples };
}
