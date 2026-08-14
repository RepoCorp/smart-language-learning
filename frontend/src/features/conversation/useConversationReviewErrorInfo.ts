import { useState } from "react";
import {
  addConversationErrorExercises,
  requestConversationTurnErrorInfo,
  type ConversationTurnErrorAnalysis,
} from "../../apiConversationErrors";
import type { StudyLanguageCode } from "../../types";

export type ConversationReviewErrorInfo = {
  loading: boolean;
  text: string;
  error: string;
  analysis: ConversationTurnErrorAnalysis | null;
  addingExercises: boolean;
  exercisesAdded: boolean;
};

type Args = {
  sourceLanguage: StudyLanguageCode;
  targetLanguage: StudyLanguageCode;
};

const EMPTY_INFO: ConversationReviewErrorInfo = {
  loading: false,
  text: "",
  error: "",
  analysis: null,
  addingExercises: false,
  exercisesAdded: false,
};

export function useConversationReviewErrorInfo({ sourceLanguage, targetLanguage }: Args) {
  const [byTurn, setByTurn] = useState<Record<number, ConversationReviewErrorInfo>>({});

  const requestErrorInfo = async (turnIndex: number, originalText: string, correctedText: string): Promise<void> => {
    if (byTurn[turnIndex]?.loading) {
      return;
    }
    setByTurn((current) => ({
      ...current,
      [turnIndex]: {
        ...EMPTY_INFO,
        loading: true,
        text: current[turnIndex]?.text || "",
        analysis: current[turnIndex]?.analysis || null,
      },
    }));
    try {
      const analysis = await requestConversationTurnErrorInfo(
        originalText,
        correctedText,
        sourceLanguage,
        targetLanguage,
      );
      setByTurn((current) => ({
        ...current,
        [turnIndex]: { ...EMPTY_INFO, text: analysis.errorText, analysis },
      }));
    } catch (requestError) {
      setByTurn((current) => ({
        ...current,
        [turnIndex]: {
          loading: false,
          ...EMPTY_INFO,
          text: current[turnIndex]?.text || "",
          error: requestError instanceof Error ? requestError.message : "Failed to analyze the correction",
        },
      }));
    }
  };

  const addExercises = async (turnIndex: number): Promise<void> => {
    const analysis = byTurn[turnIndex]?.analysis;
    if (!analysis || byTurn[turnIndex]?.addingExercises || byTurn[turnIndex]?.exercisesAdded) {
      return;
    }
    setByTurn((current) => ({
      ...current,
      [turnIndex]: { ...current[turnIndex], addingExercises: true, error: "" },
    }));
    try {
      const addedItemIds = await addConversationErrorExercises(analysis, sourceLanguage, targetLanguage);
      if (!addedItemIds.length) {
        throw new Error("No matching practice item was found");
      }
      setByTurn((current) => ({
        ...current,
        [turnIndex]: { ...current[turnIndex], addingExercises: false, exercisesAdded: true },
      }));
    } catch (requestError) {
      setByTurn((current) => ({
        ...current,
        [turnIndex]: {
          ...current[turnIndex],
          addingExercises: false,
          error: requestError instanceof Error ? requestError.message : "Failed to add exercises",
        },
      }));
    }
  };

  return { byTurn, requestErrorInfo, addExercises, emptyInfo: EMPTY_INFO };
}
