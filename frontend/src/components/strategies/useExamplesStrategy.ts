import { useEffect, useMemo, useRef, useState } from "react";

import { generateContentItemPracticePhrases } from "../../apiStrategies";
import type { ItemExercisePhrases, StudyLanguageCode } from "../../types";

type ExamplesEntry = {
  label: string;
  source: string;
  target: string;
};

function examplesEntryKey(entry: ExamplesEntry): string {
  return `${entry.label || ""}|||${entry.source}|||${entry.target}`;
}

function sanitizeExamplesEntries(
  exercisePhrases: ItemExercisePhrases | undefined,
): ExamplesEntry[] {
  const entries = exercisePhrases?.practice_phrases;
  if (!Array.isArray(entries)) {
    return [];
  }
  return entries
    .map((entry) => ({
      label: String(entry?.label || "").trim() || "practice",
      source: String(entry?.source_text || "").trim(),
      target: String(entry?.target_text || "").trim(),
    }))
    .filter((entry) => entry.source && entry.target)
    .slice(0, 8);
}

export function useExamplesStrategy({
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
    () => sanitizeExamplesEntries(exercisePhrases),
    [exercisePhrases],
  );

  const generate = async (): Promise<void> => {
    if (itemType !== "word" || itemId <= 0 || isLoading) {
      return;
    }
    setIsLoading(true);
    setError("");
    try {
      const payload = await generateContentItemPracticePhrases(
        itemId,
        sourceLanguage,
        targetLanguage,
      );
      setExercisePhrases(payload.exercise_phrases || {});
    } catch (generationError) {
      setError(
        generationError instanceof Error
          ? generationError.message
          : errorMessage,
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setSelectedKeys([]);
    setError("");
    setIsLoading(false);
    attemptedGenerationRef.current = "";
  }, [itemId, entries]);

  useEffect(() => {
    if (
      !enabled ||
      itemType !== "word" ||
      itemId <= 0 ||
      entries.length > 0 ||
      isLoading
    ) {
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
  }, [
    enabled,
    itemId,
    itemType,
    entries.length,
    isLoading,
    sourceLanguage,
    targetLanguage,
    setExercisePhrases,
    errorMessage,
  ]);

  const toggleEntry = (entry: ExamplesEntry): void => {
    const key = examplesEntryKey(entry);
    setSelectedKeys((current) =>
      current.includes(key)
        ? current.filter((selectedKey) => selectedKey !== key)
        : [...current, key],
    );
  };

  const unselectAll = (): void => {
    setSelectedKeys([]);
  };

  const selectAll = (): void => {
    setSelectedKeys(entries.map(examplesEntryKey));
  };

  const selectRandom = (): void => {
    if (entries.length <= 2) {
      setSelectedKeys(entries.map(examplesEntryKey));
      return;
    }
    const pool = [...entries];
    const selected: string[] = [];
    while (pool.length > 0 && selected.length < 2) {
      const index = Math.floor(Math.random() * pool.length);
      const [entry] = pool.splice(index, 1);
      selected.push(examplesEntryKey(entry));
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
