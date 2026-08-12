import { useEffect, useMemo, useRef, useState } from "react";

import { generateContentItemRelatedWords } from "../../apiStrategies";
import type { ItemExercisePhrases, StudyLanguageCode } from "../../types";

type RelatedEntry = {
  key: string;
  targetWord: string;
  sourceWord: string;
  exampleTarget: string;
  exampleSource: string;
  explanation?: string;
};

function relatedEntryKey(
  group: string,
  targetWord: string,
  exampleTarget: string,
): string {
  return `${group}|||${targetWord}|||${exampleTarget}`;
}

function sanitizeRelatedGroup(
  groupKey: string,
  entries: ItemExercisePhrases["related_groups"] extends infer T
    ? T extends { same_family?: infer U }
      ? U
      : never
    : never,
): RelatedEntry[] {
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
        key: relatedEntryKey(groupKey, targetWord, exampleTarget),
        targetWord,
        sourceWord,
        exampleTarget,
        exampleSource,
        explanation,
      };
    })
    .filter(
      (entry) =>
        entry.targetWord &&
        entry.sourceWord &&
        entry.exampleTarget &&
        entry.exampleSource,
    )
    .slice(0, 5);
}

function legacyRelatedGroups(
  exercisePhrases: ItemExercisePhrases | undefined,
): { same_family?: unknown } | undefined {
  // Existing saved exercises used the old storage key before this strategy was renamed.
  const legacyPayload = exercisePhrases as Record<string, unknown> | undefined;
  const groups = legacyPayload?.connect_groups;
  return groups && typeof groups === "object"
    ? (groups as { same_family?: unknown })
    : undefined;
}

export function useRelatedStrategy({
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
    () =>
      sanitizeRelatedGroup(
        "same_family",
        exercisePhrases?.related_groups?.same_family ??
          legacyRelatedGroups(exercisePhrases)?.same_family,
      ),
    [exercisePhrases],
  );
  const allEntries = sameFamily;

  const generate = async (): Promise<void> => {
    if (itemType !== "word" || itemId <= 0 || isLoading) {
      return;
    }
    setIsLoading(true);
    setError("");
    try {
      const payload = await generateContentItemRelatedWords(
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
  }, [itemId, allEntries]);

  useEffect(() => {
    if (
      !enabled ||
      itemType !== "word" ||
      itemId <= 0 ||
      allEntries.length > 0 ||
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
    allEntries.length,
    isLoading,
    sourceLanguage,
    targetLanguage,
    setExercisePhrases,
    errorMessage,
  ]);

  const toggleEntry = (entry: RelatedEntry): void => {
    setSelectedKeys((current) =>
      current.includes(entry.key)
        ? current.filter((selectedKey) => selectedKey !== entry.key)
        : [...current, entry.key],
    );
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
