import { useEffect, useMemo, useRef, useState } from "react";

import { generateContentItemDecodeAnalysis } from "../../apiStrategies";
import type { ItemExercisePhrases, StudyLanguageCode } from "../../types";

type DecodeRelatedEntry = {
  key: string;
  targetWord: string;
  sourceWord: string;
  why: string;
  exampleTarget: string;
  exampleSource: string;
};

type DecodeAnalysis = {
  linguistic: {
    prefix?: string;
    root?: string;
    suffix?: string;
    lemma?: string;
    explanation?: string;
  } | null;
  memory: {
    decomposition?: string;
    explanation?: string;
  } | null;
  related: DecodeRelatedEntry[];
};

function relatedEntryKey(targetWord: string, exampleTarget: string): string {
  return `decode|||${targetWord}|||${exampleTarget}`;
}

function sanitizeDecodeAnalysis(exercisePhrases: ItemExercisePhrases | undefined): DecodeAnalysis {
  const raw = exercisePhrases?.decode_analysis;
  const related = Array.isArray(raw?.related)
    ? raw.related.map((entry) => ({
      key: relatedEntryKey(String(entry?.target || "").trim(), String(entry?.sentence || "").trim()),
      targetWord: String(entry?.target || "").trim(),
      sourceWord: String(entry?.source || "").trim(),
      why: String(entry?.why || "").trim(),
      exampleTarget: String(entry?.sentence || "").trim(),
      exampleSource: String(entry?.translation || "").trim(),
    })).filter((entry) => entry.targetWord && entry.sourceWord && entry.why && entry.exampleTarget && entry.exampleSource).slice(0, 5)
    : [];
  return {
    linguistic: raw?.linguistic || null,
    memory: raw?.memory || null,
    related,
  };
}

export function useDecodeStrategy({
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

  const analysis = useMemo(
    () => sanitizeDecodeAnalysis(exercisePhrases),
    [exercisePhrases],
  );

  const generate = async (): Promise<void> => {
    if (itemType !== "word" || itemId <= 0 || isLoading) {
      return;
    }
    setIsLoading(true);
    setError("");
    try {
      const payload = await generateContentItemDecodeAnalysis(itemId, sourceLanguage, targetLanguage);
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
  }, [itemId, analysis]);

  useEffect(() => {
    const hasContent = Boolean(analysis.linguistic || analysis.memory || analysis.related.length > 0);
    if (!enabled || itemType !== "word" || itemId <= 0 || hasContent || isLoading) {
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
  }, [enabled, itemId, itemType, analysis, isLoading, sourceLanguage, targetLanguage, setExercisePhrases, errorMessage]);

  const toggleEntry = (entry: DecodeRelatedEntry): void => {
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
    setSelectedKeys(analysis.related.map((entry) => entry.key));
  };

  const selectRandom = (): void => {
    if (analysis.related.length <= 2) {
      setSelectedKeys(analysis.related.map((entry) => entry.key));
      return;
    }
    const pool = [...analysis.related];
    const selected: string[] = [];
    while (pool.length > 0 && selected.length < 2) {
      const index = Math.floor(Math.random() * pool.length);
      const [entry] = pool.splice(index, 1);
      selected.push(entry.key);
    }
    setSelectedKeys(selected);
  };

  return {
    analysis,
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
