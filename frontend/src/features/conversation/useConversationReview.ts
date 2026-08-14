import { useState } from "react";

import { generateTopicConversationReview } from "../../api";
import type { ContentDialogRecord, ContentItemConversationResponse } from "../../types";
import type { StudyLanguageCode } from "../../studyLanguages";
import {
  buildFinishedConversationTranscript,
  buildGeneratedReviewAnnotations,
} from "./conversationReviewTranscript";
import { useConversationReviewPreparation } from "./useConversationReviewPreparation";

type Args = {
  enabled: boolean;
  topic: string;
  notes: string;
  roleText: string;
  goalText: string;
  turns: ContentItemConversationResponse[];
  setTurns: React.Dispatch<React.SetStateAction<ContentItemConversationResponse[]>>;
  sourceLanguage: StudyLanguageCode;
  targetLanguage: StudyLanguageCode;
  setLoading: (loading: boolean) => void;
  clearError: () => void;
  reportError: (error: unknown) => void;
  onReviewGenerated: () => void;
};

export function useConversationReview({
  enabled,
  topic,
  notes,
  roleText,
  goalText,
  turns,
  setTurns,
  sourceLanguage,
  targetLanguage,
  setLoading,
  clearError,
  reportError,
  onReviewGenerated,
}: Args): {
  reviewDialog: ContentDialogRecord | null;
  generateReview: () => Promise<void>;
  resetReview: () => void;
  preparationRemainingCount: number;
  preparationReady: boolean;
  finishedTranscript: ReturnType<typeof buildFinishedConversationTranscript>;
  generatedReviewAnnotations: ReturnType<typeof buildGeneratedReviewAnnotations>;
} {
  const [reviewDialog, setReviewDialog] = useState<ContentDialogRecord | null>(null);
  const {
    remainingCount: preparationRemainingCount,
    ready: preparationReady,
  } = useConversationReviewPreparation({
    enabled,
    topic,
    notes,
    roleText,
    goalText,
    turns,
    setTurns,
    sourceLanguage,
    targetLanguage,
  });

  const generateReview = async (): Promise<void> => {
    clearError();
    setLoading(true);
    try {
      const dialog = await generateTopicConversationReview(
        topic,
        notes,
        roleText,
        goalText,
        turns,
        sourceLanguage,
        targetLanguage,
      );
      setReviewDialog(dialog);
      onReviewGenerated();
    } catch (error) {
      reportError(error);
    } finally {
      setLoading(false);
    }
  };

  return {
    reviewDialog,
    generateReview,
    resetReview: () => setReviewDialog(null),
    preparationRemainingCount,
    preparationReady,
    finishedTranscript: buildFinishedConversationTranscript(topic, turns),
    generatedReviewAnnotations: buildGeneratedReviewAnnotations(turns),
  };
}
