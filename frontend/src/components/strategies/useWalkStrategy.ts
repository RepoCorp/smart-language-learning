import { useEffect, useMemo, useRef, useState } from "react";

import { generateContentItemWalkSentences } from "../../apiStrategies";
import type { ItemExercisePhrases, StudyLanguageCode } from "../../types";

type WalkEntry = {
  key: string;
  label: string;
  source: string;
  target: string;
};

function walkEntryKey(entry: WalkEntry): string {
  return `${entry.label || ""}|||${entry.source}|||${entry.target}`;
}

function sanitizeWalkChallenge(exercisePhrases: ItemExercisePhrases | undefined): { instruction: string; entry: WalkEntry } | null {
  const challenge = exercisePhrases?.walk_challenge;
  const instruction = String(challenge?.instruction || "").trim();
  const source = String(challenge?.source_text || "").trim();
  const target = String(challenge?.target_text || "").trim();
  if (!instruction || !source || !target) {
    return null;
  }
  return {
    instruction,
    entry: {
      label: instruction,
      source,
      target,
      key: "",
    },
  };
}

export function useWalkStrategy({
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

  const challenge = useMemo(
    () => sanitizeWalkChallenge(exercisePhrases),
    [exercisePhrases],
  );
  const entries = useMemo(() => (challenge ? [challenge.entry] : []), [challenge]);

  const generate = async (): Promise<void> => {
    if (itemType !== "word" || itemId <= 0 || isLoading) {
      return;
    }
    setIsLoading(true);
    setError("");
    try {
      const payload = await generateContentItemWalkSentences(itemId, sourceLanguage, targetLanguage);
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

  const toggleEntry = (entry: WalkEntry): void => {
    const key = walkEntryKey(entry);
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
    setSelectedKeys(entries.map(walkEntryKey));
  };

  const selectRandom = (): void => {
    if (entries.length <= 2) {
      setSelectedKeys(entries.map(walkEntryKey));
      return;
    }
    const pool = [...entries];
    const selected: string[] = [];
    while (pool.length > 0 && selected.length < 2) {
      const index = Math.floor(Math.random() * pool.length);
      const [entry] = pool.splice(index, 1);
      selected.push(walkEntryKey(entry));
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
