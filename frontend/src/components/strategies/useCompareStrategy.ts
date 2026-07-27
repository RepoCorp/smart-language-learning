import { useEffect, useMemo, useRef, useState } from "react";

import { generateContentItemCompareWords } from "../../apiStrategies";
import type { ItemExercisePhrases, StudyLanguageCode } from "../../types";

type CompareEntry = {
  key: string;
  label: string;
  targetWord: string;
  sourceWord: string;
  difference: string;
  mistake: string;
  targetExample: string;
  targetTranslation: string;
  comparisonExample: string;
  comparisonTranslation: string;
};

function compareEntryKey(entry: CompareEntry): string {
  return `${entry.label}|||${entry.targetWord}|||${entry.targetExample}|||${entry.comparisonExample}`;
}

function sanitizeCompareEntries(exercisePhrases: ItemExercisePhrases | undefined): CompareEntry[] {
  const entries = exercisePhrases?.compare_strategy;
  if (!Array.isArray(entries)) {
    return [];
  }
  return entries
    .map((entry) => {
      const label = String(entry?.label || "").trim() || "compare";
      const targetWord = String(entry?.target_text || "").trim();
      const sourceWord = String(entry?.source_text || "").trim();
      const difference = String(entry?.difference_text || "").trim();
      const mistake = String(entry?.mistake_text || "").trim();
      const targetExample = String(entry?.target_example_text || "").trim();
      const targetTranslation = String(entry?.target_translation_text || "").trim();
      const comparisonExample = String(entry?.comparison_example_text || "").trim();
      const comparisonTranslation = String(entry?.comparison_translation_text || "").trim();
      return {
        key: `${label}|||${targetWord}|||${targetExample}|||${comparisonExample}`,
        label,
        targetWord,
        sourceWord,
        difference,
        mistake,
        targetExample,
        targetTranslation,
        comparisonExample,
        comparisonTranslation,
      };
    })
    .filter((entry) => (
      entry.targetWord
      && entry.sourceWord
      && entry.difference
      && entry.mistake
      && entry.targetExample
      && entry.targetTranslation
      && entry.comparisonExample
      && entry.comparisonTranslation
    ))
    .slice(0, 5);
}

export function useCompareStrategy({
  itemId,
  itemType,
  exercisePhrases,
  sourceLanguage,
  targetLanguage,
  setExercisePhrases,
  errorMessage,
  enabled,
}: {
  itemId: number;
  itemType: "word" | "phrase";
  exercisePhrases: ItemExercisePhrases | undefined;
  sourceLanguage: StudyLanguageCode;
  targetLanguage: StudyLanguageCode;
  setExercisePhrases: (value: ItemExercisePhrases) => void;
  errorMessage: string;
  enabled: boolean;
}) {
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [error, setError] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const attemptedGenerationRef = useRef<string>("");

  const entries = useMemo(
    () => sanitizeCompareEntries(exercisePhrases),
    [exercisePhrases],
  );

  const generate = async (): Promise<void> => {
    if (itemType !== "word" || itemId <= 0 || isLoading) {
      return;
    }
    setIsLoading(true);
    setError("");
    try {
      const payload = await generateContentItemCompareWords(itemId, sourceLanguage, targetLanguage);
      setExercisePhrases(payload.exercise_phrases || {});
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setSelectedKeys(entries.map(compareEntryKey));
    setError("");
    setIsLoading(false);
    attemptedGenerationRef.current = "";
  }, [itemId, entries]);

  useEffect(() => {
    if (!enabled || itemType !== "word" || itemId <= 0 || entries.length > 0 || isLoading) {
      return;
    }
    const attemptKey = `${itemId}:${sourceLanguage}:${targetLanguage}`;
    if (attemptedGenerationRef.current === attemptKey) {
      return;
    }
    attemptedGenerationRef.current = attemptKey;

    void (async () => {
      await generate();
    })();
  }, [enabled, itemId, itemType, entries.length, isLoading, sourceLanguage, targetLanguage, setExercisePhrases, errorMessage]);

  const toggleEntry = (entry: CompareEntry): void => {
    const key = compareEntryKey(entry);
    setSelectedKeys((current) => (
      current.includes(key)
        ? current.filter((selectedKey) => selectedKey !== key)
        : [...current, key]
    ));
  };

  const unselectAll = (): void => {
    setSelectedKeys([]);
  };

  const selectAll = (): void => {
    setSelectedKeys(entries.map(compareEntryKey));
  };

  const selectRandom = (): void => {
    if (entries.length <= 2) {
      setSelectedKeys(entries.map(compareEntryKey));
      return;
    }
    const pool = [...entries];
    const selected: string[] = [];
    while (pool.length > 0 && selected.length < 2) {
      const index = Math.floor(Math.random() * pool.length);
      const [entry] = pool.splice(index, 1);
      selected.push(compareEntryKey(entry));
    }
    setSelectedKeys(selected);
  };

  return {
    entries,
    selectedKeys,
    error,
    isLoading,
    generate,
    toggleEntry,
    unselectAll,
    selectAll,
    selectRandom,
  };
}
