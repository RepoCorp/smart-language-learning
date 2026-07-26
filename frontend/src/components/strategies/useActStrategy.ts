import { useEffect, useMemo, useRef, useState } from "react";

import { generateContentItemActExercise } from "../../apiStrategies";
import type { ItemExercisePhrases, StudyLanguageCode } from "../../types";

type ActEntry = {
  key: string;
  label: string;
  source: string;
  target: string;
  actions: string[];
};

function sanitizeActEntry(exercisePhrases: ItemExercisePhrases | undefined): ActEntry | null {
  const entry = exercisePhrases?.act_exercise;
  if (!entry) {
    return null;
  }
  const source = String(entry.source_text || "").trim();
  const target = String(entry.target_text || "").trim();
  const actions = Array.isArray(entry.actions)
    ? entry.actions.map((action) => String(action || "").trim()).filter(Boolean).slice(0, 5)
    : [];
  if (!source || !target || actions.length === 0) {
    return null;
  }
  return {
    key: `act|||${source}|||${target}`,
    label: String(entry.label || "").trim() || "act",
    source,
    target,
    actions,
  };
}

export function useActStrategy({
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

  const entry = useMemo(
    () => sanitizeActEntry(exercisePhrases),
    [exercisePhrases],
  );

  const generate = async (): Promise<void> => {
    if (itemType !== "word" || itemId <= 0 || isLoading) {
      return;
    }
    setIsLoading(true);
    setError("");
    try {
      const payload = await generateContentItemActExercise(itemId, sourceLanguage, targetLanguage);
      setExercisePhrases(payload.exercise_phrases || {});
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setSelectedKeys(entry ? [entry.key] : []);
    setError("");
    setIsLoading(false);
    attemptedGenerationRef.current = "";
  }, [itemId, entry]);

  useEffect(() => {
    if (!enabled || itemType !== "word" || itemId <= 0 || entry || isLoading) {
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
  }, [enabled, itemId, itemType, entry, isLoading, sourceLanguage, targetLanguage, setExercisePhrases, errorMessage]);

  const toggleEntry = (nextEntry: ActEntry): void => {
    setSelectedKeys((current) => (current.includes(nextEntry.key) ? [] : [nextEntry.key]));
  };

  const unselectAll = (): void => {
    setSelectedKeys([]);
  };

  const selectAll = (): void => {
    setSelectedKeys(entry ? [entry.key] : []);
  };

  const selectRandom = (): void => {
    setSelectedKeys(entry ? [entry.key] : []);
  };

  return {
    entry,
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
