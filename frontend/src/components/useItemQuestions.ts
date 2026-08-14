import { useEffect, useState } from "react";

import { askContentItemQuestion, fetchContentItemDetail } from "../api";
import type { ItemQuestionExchange, StudyLanguageCode } from "../types";

export function useItemQuestions({
  itemId,
  initialQuestions,
  sourceLanguage,
  targetLanguage,
  refreshRelatedDialogHistory,
  questionError,
}: {
  itemId: number;
  initialQuestions: ItemQuestionExchange[];
  sourceLanguage: StudyLanguageCode;
  targetLanguage: StudyLanguageCode;
  refreshRelatedDialogHistory: boolean;
  questionError: string;
}): {
  showQuestionsModal: boolean;
  prefilledQuestion: string;
  itemQuestions: ItemQuestionExchange[];
  itemQuestionError: string;
  askingQuestion: boolean;
  openQuestions: (question?: string) => void;
  closeQuestions: () => void;
  resetQuestions: () => void;
  replaceItemQuestions: (questions: ItemQuestionExchange[]) => void;
  askItemQuestion: (questionText: string) => Promise<void>;
} {
  const [showQuestionsModal, setShowQuestionsModal] = useState(false);
  const [prefilledQuestion, setPrefilledQuestion] = useState("");
  const [itemQuestions, setItemQuestions] = useState<ItemQuestionExchange[]>(initialQuestions);
  const [itemQuestionError, setItemQuestionError] = useState("");
  const [askingQuestion, setAskingQuestion] = useState(false);

  const resetQuestions = (): void => {
    setItemQuestions(initialQuestions);
    setItemQuestionError("");
    setAskingQuestion(false);
    setPrefilledQuestion("");
    setShowQuestionsModal(false);
  };

  useEffect(() => {
    resetQuestions();
  }, [itemId]);

  useEffect(() => {
    if (!showQuestionsModal && !refreshRelatedDialogHistory) return;
    let cancelled = false;
    const loadLatestHistory = async (): Promise<void> => {
      try {
        const detail = await fetchContentItemDetail(itemId, sourceLanguage, targetLanguage);
        if (!cancelled) setItemQuestions(detail.item_questions || []);
      } catch {
        // The existing history remains usable if the refresh fails.
      }
    };
    void loadLatestHistory();
    return () => { cancelled = true; };
  }, [itemId, sourceLanguage, targetLanguage, showQuestionsModal, refreshRelatedDialogHistory]);

  const askItemQuestion = async (questionText: string): Promise<void> => {
    if (askingQuestion || !questionText.trim()) return;
    setAskingQuestion(true);
    setItemQuestionError("");
    try {
      const response = await askContentItemQuestion(itemId, questionText, itemQuestions, sourceLanguage, targetLanguage);
      setItemQuestions(response.conversation || []);
    } catch (error) {
      setItemQuestionError(error instanceof Error && error.message ? error.message : questionError);
    } finally {
      setAskingQuestion(false);
    }
  };

  return {
    showQuestionsModal,
    prefilledQuestion,
    itemQuestions,
    itemQuestionError,
    askingQuestion,
    openQuestions: (question = "") => {
      setPrefilledQuestion(question);
      setShowQuestionsModal(true);
    },
    closeQuestions: () => setShowQuestionsModal(false),
    resetQuestions,
    replaceItemQuestions: setItemQuestions,
    askItemQuestion,
  };
}
