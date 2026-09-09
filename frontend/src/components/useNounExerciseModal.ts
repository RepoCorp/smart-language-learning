import { useMemo } from "react";

import type { ItemExercisePhrases, ItemType } from "../types";
import { supportsNounFormsGenerationMode } from "./strategies/forms/nounFormsStrategyRegistry";

interface UseNounExerciseModalArgs {
  itemType: ItemType;
  wordType: string;
  exercisePhrases?: ItemExercisePhrases;
}

export function useNounExerciseModal({
  itemType,
  wordType,
  exercisePhrases,
}: UseNounExerciseModalArgs): {
  nounExerciseSections: NonNullable<ItemExercisePhrases["sections"]>;
  isNounSectionedExercise: boolean;
  nounFormsGenerationMode?: string;
} {
  const nounExerciseSections = useMemo(
    () => (exercisePhrases?.sections || []).filter((section) => (
      String(section?.key || "").trim()
        && (
          (Array.isArray(section?.phrases) && section.phrases.length > 0)
          || Boolean(String(section?.question_target_text || "").trim())
          || Boolean(String(section?.question_source_text || "").trim())
        )
    )),
    [exercisePhrases],
  );

  const isNounSectionedExercise = itemType === "word"
    && String(wordType || "").trim().toLowerCase() === "noun"
    && nounExerciseSections.length > 0;
  const nounFormsGenerationMode = isNounSectionedExercise
    && supportsNounFormsGenerationMode(exercisePhrases?.generation_mode)
    ? exercisePhrases?.generation_mode
    : undefined;

  return {
    nounExerciseSections,
    isNounSectionedExercise,
    nounFormsGenerationMode,
  };
}
