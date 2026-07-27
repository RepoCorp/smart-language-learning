import { useEffect, useMemo, useRef, useState } from "react";

import { generateContentItemEncounterSituations } from "../../apiStrategies";
import type { ItemExercisePhrases, StudyLanguageCode } from "../../types";

type EncounterEntry = {
  key: string;
  label: string;
  title: string;
  description: string;
  source: string;
  target: string;
};

function encounterEntryKey(entry: EncounterEntry): string {
  return `${entry.label || ""}|||${entry.title}|||${entry.target}`;
}

function sanitizeEncounterEntries(exercisePhrases: ItemExercisePhrases | undefined): EncounterEntry[] {
  const entries = exercisePhrases?.encounter_situations;
  if (!Array.isArray(entries)) {
    return [];
  }
  return entries
    .map((entry) => ({
      key: `${String(entry?.label || "").trim() || "encounter"}|||${String(entry?.title || "").trim()}|||${String(entry?.target_text || "").trim()}`,
      label: String(entry?.label || "").trim() || "encounter",
      title: String(entry?.title || "").trim(),
      description: String(entry?.description || "").trim(),
      source: String(entry?.source_text || "").trim(),
      target: String(entry?.target_text || "").trim(),
    }))
    .filter((entry) => entry.title && entry.description && entry.source && entry.target)
    .slice(0, 8);
}

export function useEncounterStrategy({
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
    () => sanitizeEncounterEntries(exercisePhrases),
    [exercisePhrases],
  );

  const generate = async (): Promise<void> => {
    if (itemType !== "word" || itemId <= 0 || isLoading) {
      return;
    }
    setIsLoading(true);
    setError("");
    try {
      const payload = await generateContentItemEncounterSituations(itemId, sourceLanguage, targetLanguage);
      setExercisePhrases(payload.exercise_phrases || {});
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : errorMessage);
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

  const toggleEntry = (entry: EncounterEntry): void => {
    const key = encounterEntryKey(entry);
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
    setSelectedKeys(entries.map(encounterEntryKey));
  };

  const selectRandom = (): void => {
    if (entries.length <= 2) {
      setSelectedKeys(entries.map(encounterEntryKey));
      return;
    }
    const pool = [...entries];
    const selected: string[] = [];
    while (pool.length > 0 && selected.length < 2) {
      const index = Math.floor(Math.random() * pool.length);
      const [entry] = pool.splice(index, 1);
      selected.push(encounterEntryKey(entry));
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
