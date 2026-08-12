import type { ItemExercisePhrases, StudyLanguageCode } from "../../types";
import {
  ACT_STRATEGY,
  COMPARE_STRATEGY,
  DECODE_STRATEGY,
  ENCOUNTER_STRATEGY,
  EXAMPLES_STRATEGY,
  CREATE_STRATEGY,
  RELATED_STRATEGY,
  VISUALIZE_STRATEGY,
  WALK_STRATEGY,
  GRAMMAR_STRATEGY,
} from "./strategyConstants";
import { useActStrategy } from "./useActStrategy";
import { useCompareStrategy } from "./useCompareStrategy";
import { useDecodeStrategy } from "./useDecodeStrategy";
import { useEncounterStrategy } from "./useEncounterStrategy";
import { useCreateStrategy } from "./useCreateStrategy";
import { useExamplesStrategy } from "./useExamplesStrategy";
import { useRelatedStrategy } from "./useRelatedStrategy";
import { useVisualizeStrategy } from "./useVisualizeStrategy";
import { useWalkStrategy } from "./useWalkStrategy";
import { useGrammarExamples } from "./useGrammarExamples";

type StrategyErrors = {
  create: string;
  examples: string;
  related: string;
  visualize: string;
  act: string;
  walk: string;
  decode: string;
  encounter: string;
  compare: string;
};

export function useItemStrategies({
  itemId,
  itemType,
  exercisePhrases,
  sourceLanguage,
  targetLanguage,
  wordType,
  setExercisePhrases,
  modalOpen,
  selectedStrategy,
  initialStrategy,
  suppressInitialAutogeneration,
  errors,
}: {
  itemId: number;
  itemType: "word" | "phrase";
  exercisePhrases: ItemExercisePhrases | undefined;
  sourceLanguage: StudyLanguageCode;
  targetLanguage: StudyLanguageCode;
  wordType: string;
  setExercisePhrases: (value: ItemExercisePhrases) => void;
  modalOpen: boolean;
  selectedStrategy: string;
  initialStrategy: string;
  suppressInitialAutogeneration: boolean;
  errors: StrategyErrors;
}) {
  const autoGenerate = (strategy: string): boolean =>
    modalOpen &&
    selectedStrategy === strategy &&
    !(suppressInitialAutogeneration && selectedStrategy === initialStrategy);
  const common = {
    itemId,
    itemType,
    exercisePhrases,
    sourceLanguage,
    targetLanguage,
    setExercisePhrases,
  };

  const createStrategy = useCreateStrategy({
    ...common,
    errorMessage: errors.create,
  });
  const examplesStrategy = useExamplesStrategy({
    ...common,
    errorMessage: errors.examples,
    enabled: autoGenerate(EXAMPLES_STRATEGY),
  });
  const relatedStrategy = useRelatedStrategy({
    ...common,
    errorMessage: errors.related,
    enabled: autoGenerate(RELATED_STRATEGY),
  });
  const visualizeStrategy = useVisualizeStrategy({
    ...common,
    errorMessage: errors.visualize,
    enabled: autoGenerate(VISUALIZE_STRATEGY),
  });
  const actStrategy = useActStrategy({
    ...common,
    errorMessage: errors.act,
    enabled: autoGenerate(ACT_STRATEGY),
  });
  const walkStrategy = useWalkStrategy({
    ...common,
    errorMessage: errors.walk,
    enabled: autoGenerate(WALK_STRATEGY),
  });
  const decodeStrategy = useDecodeStrategy({
    ...common,
    errorMessage: errors.decode,
    enabled: autoGenerate(DECODE_STRATEGY),
  });
  const encounterStrategy = useEncounterStrategy({
    ...common,
    errorMessage: errors.encounter,
    enabled: autoGenerate(ENCOUNTER_STRATEGY),
  });
  const compareStrategy = useCompareStrategy({
    ...common,
    errorMessage: errors.compare,
    enabled: autoGenerate(COMPARE_STRATEGY),
  });
  const grammarStrategy = useGrammarExamples({
    enabled: modalOpen && selectedStrategy === GRAMMAR_STRATEGY && itemType === "word" && wordType.trim().toLowerCase() === "noun",
    itemId,
    sourceLanguage,
    targetLanguage,
  });

  return {
    createStrategy,
    examplesStrategy,
    relatedStrategy,
    visualizeStrategy,
    actStrategy,
    walkStrategy,
    decodeStrategy,
    encounterStrategy,
    compareStrategy,
    grammarStrategy,
  };
}
