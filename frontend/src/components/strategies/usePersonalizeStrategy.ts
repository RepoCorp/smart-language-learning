import { useEffect, useMemo, useState } from "react";

import { personalizeContentItemPhrase } from "../../apiStrategies";
import type { ItemExercisePhrases, StudyLanguageCode } from "../../types";

type PersonalizeEntry = {
  label: string;
  source: string;
  target: string;
};

function personalizeEntryKey(entry: PersonalizeEntry): string {
  return `${entry.label || ""}|||${entry.source}|||${entry.target}`;
}

function sanitizePersonalizeEntries(
  exercisePhrases: ItemExercisePhrases | undefined,
): PersonalizeEntry[] {
  const entries = exercisePhrases?.personalize_phrases;
  if (!Array.isArray(entries)) {
    return [];
  }
  return entries
    .map((entry) => ({
      label: String(entry?.label || "personalize").trim() || "personalize",
      source: String(entry?.source_text || "").trim(),
      target: String(entry?.target_text || "").trim(),
    }))
    .filter((entry) => entry.source && entry.target)
    .slice(-30);
}

export function usePersonalizeStrategy({
  itemId,
  itemType,
  exercisePhrases,
  sourceLanguage,
  targetLanguage,
  setExercisePhrases,
  errorMessage,
}: {
  itemId: number;
  itemType: "word" | "phrase";
  exercisePhrases: ItemExercisePhrases | undefined;
  sourceLanguage: StudyLanguageCode;
  targetLanguage: StudyLanguageCode;
  setExercisePhrases: (value: ItemExercisePhrases) => void;
  errorMessage: string;
}) {
  const [inputValue, setInputValue] = useState<string>("");
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [error, setError] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState<boolean>(false);

  const entries = useMemo(
    () => sanitizePersonalizeEntries(exercisePhrases),
    [exercisePhrases],
  );

  useEffect(() => {
    setInputValue("");
    setSelectedKeys(entries.map(personalizeEntryKey));
    setError("");
    setIsGenerating(false);
  }, [itemId, entries]);

  const toggleEntry = (entry: PersonalizeEntry): void => {
    const key = personalizeEntryKey(entry);
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
    setSelectedKeys(entries.map(personalizeEntryKey));
  };

  const selectRandom = (): void => {
    if (entries.length <= 2) {
      setSelectedKeys(entries.map(personalizeEntryKey));
      return;
    }
    const pool = [...entries];
    const selected: string[] = [];
    while (pool.length > 0 && selected.length < 2) {
      const index = Math.floor(Math.random() * pool.length);
      const [entry] = pool.splice(index, 1);
      selected.push(personalizeEntryKey(entry));
    }
    setSelectedKeys(selected);
  };

  const generatePhrase = async (): Promise<void> => {
    if (isGenerating || itemType !== "word" || itemId <= 0) {
      return;
    }
    const sourceText = inputValue.trim();
    if (!sourceText) {
      return;
    }
    setIsGenerating(true);
    setError("");
    try {
      const payload = await personalizeContentItemPhrase(itemId, sourceText, sourceLanguage, targetLanguage);
      setExercisePhrases(payload.exercise_phrases || {});
      setInputValue("");
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : errorMessage);
    } finally {
      setIsGenerating(false);
    }
  };

  return {
    inputValue,
    setInputValue,
    entries,
    selectedKeys,
    error,
    isGenerating,
    toggleEntry,
    unselectAll,
    selectAll,
    selectRandom,
    generatePhrase,
  };
}
