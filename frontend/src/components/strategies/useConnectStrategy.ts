import { useEffect, useMemo, useRef, useState } from "react";

import { generateContentItemConnectWords } from "../../apiStrategies";
import type { ItemExercisePhrases, StudyLanguageCode } from "../../types";

type ConnectEntry = {
  key: string;
  targetWord: string;
  sourceWord: string;
  exampleTarget: string;
  exampleSource: string;
  explanation?: string;
};

function connectEntryKey(group: string, targetWord: string, exampleTarget: string): string {
  return `${group}|||${targetWord}|||${exampleTarget}`;
}

function sanitizeConnectGroup(
  groupKey: string,
  entries: ItemExercisePhrases["connect_groups"] extends infer T
    ? T extends { same_family?: infer U } ? U : never
    : never,
): ConnectEntry[] {
  if (!Array.isArray(entries)) {
    return [];
  }
  return entries
    .map((entry) => {
      const targetWord = String(entry?.target_text || "").trim();
      const sourceWord = String(entry?.source_text || "").trim();
      const exampleTarget = String(entry?.example_target_text || "").trim();
      const exampleSource = String(entry?.example_source_text || "").trim();
      const explanation = String(entry?.explanation_text || "").trim();
      return {
        key: connectEntryKey(groupKey, targetWord, exampleTarget),
        targetWord,
        sourceWord,
        exampleTarget,
        exampleSource,
        explanation,
      };
    })
    .filter((entry) => entry.targetWord && entry.sourceWord && entry.exampleTarget && entry.exampleSource)
    .slice(0, 5);
}

export function useConnectStrategy({
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

  const sameFamily = useMemo(
    () => sanitizeConnectGroup("same_family", exercisePhrases?.connect_groups?.same_family),
    [exercisePhrases],
  );
  const relatedOrConfusing = useMemo(
    () => sanitizeConnectGroup("related_or_confusing", exercisePhrases?.connect_groups?.related_or_confusing),
    [exercisePhrases],
  );
  const allEntries = useMemo(
    () => [...sameFamily, ...relatedOrConfusing],
    [sameFamily, relatedOrConfusing],
  );

  const generate = async (): Promise<void> => {
    if (itemType !== "word" || itemId <= 0 || isLoading) {
      return;
    }
    setIsLoading(true);
    setError("");
    try {
      const payload = await generateContentItemConnectWords(itemId, sourceLanguage, targetLanguage);
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
  }, [itemId, allEntries]);

  useEffect(() => {
    if (!enabled || itemType !== "word" || itemId <= 0 || allEntries.length > 0 || isLoading) {
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
  }, [enabled, itemId, itemType, allEntries.length, isLoading, sourceLanguage, targetLanguage, setExercisePhrases, errorMessage]);

  const toggleEntry = (entry: ConnectEntry): void => {
    setSelectedKeys((current) => (
      current.includes(entry.key)
        ? current.filter((selectedKey) => selectedKey !== entry.key)
        : [...current, entry.key]
    ));
  };

  const unselectAll = (): void => {
    setSelectedKeys([]);
  };

  const selectAll = (): void => {
    setSelectedKeys(allEntries.map((entry) => entry.key));
  };

  const selectRandom = (): void => {
    if (allEntries.length <= 2) {
      setSelectedKeys(allEntries.map((entry) => entry.key));
      return;
    }
    const pool = [...allEntries];
    const selected: string[] = [];
    while (pool.length > 0 && selected.length < 2) {
      const index = Math.floor(Math.random() * pool.length);
      const [entry] = pool.splice(index, 1);
      selected.push(entry.key);
    }
    setSelectedKeys(selected);
  };

  return {
    sameFamily,
    relatedOrConfusing,
    allEntries,
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
