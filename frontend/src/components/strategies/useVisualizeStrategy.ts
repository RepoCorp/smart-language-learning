import { useEffect, useMemo, useRef, useState } from "react";

import { generateContentItemVisualizePhrase } from "../../apiStrategies";
import type { ItemExercisePhrases, StudyLanguageCode } from "../../types";

type VisualizeEntry = {
  key: string;
  label: string;
  source: string;
  target: string;
  imageUrl?: string;
  imagePrompt?: string;
};

function sanitizeVisualizeEntry(exercisePhrases: ItemExercisePhrases | undefined): VisualizeEntry | null {
  const entry = exercisePhrases?.visualize_phrase;
  if (!entry) {
    return null;
  }
  const source = String(entry.source_text || "").trim();
  const target = String(entry.target_text || "").trim();
  if (!source || !target) {
    return null;
  }
  return {
    key: `visualize|||${source}|||${target}`,
    label: String(entry.label || "").trim() || "visualize",
    source,
    target,
    imageUrl: String(entry.image_url || "").trim() || undefined,
    imagePrompt: String(entry.image_prompt || "").trim() || undefined,
  };
}

export function useVisualizeStrategy({
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
  const [isGeneratingImage, setIsGeneratingImage] = useState<boolean>(false);
  const attemptedGenerationRef = useRef<string>("");
  const imageRequestIdRef = useRef<number>(0);

  const entry = useMemo(
    () => sanitizeVisualizeEntry(exercisePhrases),
    [exercisePhrases],
  );

  const generateImage = async (): Promise<void> => {
    if (itemId <= 0 || isGeneratingImage) {
      return;
    }
    const requestId = imageRequestIdRef.current + 1;
    imageRequestIdRef.current = requestId;
    setIsGeneratingImage(true);
    setError("");
    try {
      const imagePayload = await generateContentItemVisualizePhrase(itemId, sourceLanguage, targetLanguage, "image_only");
      if (imageRequestIdRef.current !== requestId) {
        return;
      }
      setExercisePhrases(imagePayload.exercise_phrases || exercisePhrases || {});
    } catch (generationError) {
      if (imageRequestIdRef.current !== requestId) {
        return;
      }
      setError(generationError instanceof Error ? generationError.message : errorMessage);
    } finally {
      if (imageRequestIdRef.current === requestId) {
        setIsGeneratingImage(false);
      }
    }
  };

  const generate = async (): Promise<void> => {
    if (itemType !== "word" || itemId <= 0 || isLoading) {
      return;
    }
    setIsLoading(true);
    setError("");
    setSelectedKeys([]);
    try {
      const payload = await generateContentItemVisualizePhrase(itemId, sourceLanguage, targetLanguage, "phrase_only");
      const phrasePayload = payload.exercise_phrases || {};
      setExercisePhrases(phrasePayload);
      const visualizePhrase = phrasePayload.visualize_phrase;
      const hasPhrase = Boolean(
        visualizePhrase
        && String(visualizePhrase.source_text || "").trim()
        && String(visualizePhrase.target_text || "").trim(),
      );
      if (hasPhrase) {
        void generateImage();
      }
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
    setIsGeneratingImage(false);
    attemptedGenerationRef.current = "";
    imageRequestIdRef.current += 1;
  }, [itemId]);

  useEffect(() => {
    if (!enabled || itemType !== "word" || itemId <= 0 || isLoading || isGeneratingImage) {
      return;
    }
    if (entry?.imageUrl) {
      return;
    }
    const attemptKey = `${itemId}:${sourceLanguage}:${targetLanguage}:${entry ? "image" : "phrase"}`;
    if (attemptedGenerationRef.current === attemptKey) {
      return;
    }
    attemptedGenerationRef.current = attemptKey;

    void (async () => {
      if (entry) {
        await generateImage();
        return;
      }
      await generate();
    })();
  }, [enabled, itemId, itemType, entry, isLoading, isGeneratingImage, sourceLanguage, targetLanguage, setExercisePhrases, errorMessage]);

  const toggleEntry = (nextEntry: VisualizeEntry): void => {
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
    isGeneratingImage,
    generate,
    toggleEntry,
    unselectAll,
    selectAll,
    selectRandom,
  };
}
