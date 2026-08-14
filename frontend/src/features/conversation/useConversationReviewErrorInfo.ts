import { useState } from "react";
import { requestConversationTurnErrorInfo } from "../../apiConversationErrors";
import type { StudyLanguageCode } from "../../types";

export type ConversationReviewErrorInfo = {
  loading: boolean;
  text: string;
  error: string;
};

type Args = {
  sourceLanguage: StudyLanguageCode;
  targetLanguage: StudyLanguageCode;
};

const EMPTY_INFO: ConversationReviewErrorInfo = { loading: false, text: "", error: "" };

export function useConversationReviewErrorInfo({ sourceLanguage, targetLanguage }: Args) {
  const [byTurn, setByTurn] = useState<Record<number, ConversationReviewErrorInfo>>({});

  const requestErrorInfo = async (turnIndex: number, originalText: string, correctedText: string): Promise<void> => {
    if (byTurn[turnIndex]?.loading) {
      return;
    }
    setByTurn((current) => ({
      ...current,
      [turnIndex]: { loading: true, text: current[turnIndex]?.text || "", error: "" },
    }));
    try {
      const text = await requestConversationTurnErrorInfo(
        originalText,
        correctedText,
        sourceLanguage,
        targetLanguage,
      );
      setByTurn((current) => ({ ...current, [turnIndex]: { loading: false, text, error: "" } }));
    } catch (requestError) {
      setByTurn((current) => ({
        ...current,
        [turnIndex]: {
          loading: false,
          text: current[turnIndex]?.text || "",
          error: requestError instanceof Error ? requestError.message : "Failed to analyze the correction",
        },
      }));
    }
  };

  return { byTurn, requestErrorInfo, emptyInfo: EMPTY_INFO };
}
