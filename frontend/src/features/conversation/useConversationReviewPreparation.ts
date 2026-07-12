import { useEffect, useRef, useState } from "react";

import {
  fetchTopicConversationUserCorrection,
  fetchTopicConversationUserLiteralTranslation,
} from "../../api";
import type { ContentItemConversationResponse } from "../../types";
import type { StudyLanguageCode } from "../../studyLanguages";

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
};

type PendingTask =
  | { type: "user-correction"; index: number }
  | { type: "assistant-translation"; index: number };

export function useConversationReviewPreparation({
  enabled,
  topic,
  notes,
  roleText,
  goalText,
  turns,
  setTurns,
  sourceLanguage,
  targetLanguage,
}: Args): { pendingCount: number; remainingCount: number; ready: boolean } {
  const [runToken, setRunToken] = useState<number>(0);
  const inFlightRef = useRef<boolean>(false);
  const failedUserCorrectionRef = useRef<Set<number>>(new Set());
  const failedAssistantTranslationRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (enabled) {
      return;
    }
    inFlightRef.current = false;
    failedUserCorrectionRef.current = new Set();
    failedAssistantTranslationRef.current = new Set();
    setRunToken((current) => current + 1);
  }, [enabled]);

  useEffect(() => {
    for (let index = 0; index < turns.length; index += 1) {
      const turn = turns[index];
      const userText = (turn.user_text || "").trim();
      if (userText && (turn.user_corrected_text || "").trim()) {
        failedUserCorrectionRef.current.delete(index);
      }
      const assistantText = (turn.assistant_text || "").trim();
      if (assistantText && (turn.assistant_translation_text || "").trim()) {
        failedAssistantTranslationRef.current.delete(index);
      }
    }
  }, [turns]);

  const remainingCount = turns.reduce((count, turn) => {
    const userText = (turn.user_text || "").trim();
    const assistantText = (turn.assistant_text || "").trim();
    const needsCorrection = userText && !(turn.user_corrected_text || "").trim();
    const needsAssistantTranslation = assistantText && !(turn.assistant_translation_text || "").trim();
    return count + (needsCorrection ? 1 : 0) + (needsAssistantTranslation ? 1 : 0);
  }, 0);

  const pendingCount = turns.reduce((count, turn, index) => {
    const userText = (turn.user_text || "").trim();
    const assistantText = (turn.assistant_text || "").trim();
    const needsCorrection = userText
      && !(turn.user_corrected_text || "").trim()
      && !failedUserCorrectionRef.current.has(index);
    const needsAssistantTranslation = assistantText
      && !(turn.assistant_translation_text || "").trim()
      && !failedAssistantTranslationRef.current.has(index);
    return count + (needsCorrection ? 1 : 0) + (needsAssistantTranslation ? 1 : 0);
  }, 0);

  useEffect(() => {
    if (!enabled || inFlightRef.current) {
      return;
    }
    const nextTask = findNextPendingTask(turns, failedUserCorrectionRef.current, failedAssistantTranslationRef.current);
    if (!nextTask) {
      return;
    }

    inFlightRef.current = true;

    const runTask = async (): Promise<void> => {
      try {
        if (nextTask.type === "user-correction") {
          const payload = await fetchTopicConversationUserCorrection(
            topic,
            notes,
            roleText,
            goalText,
            turns[nextTask.index].user_text,
            turns.slice(0, nextTask.index).map((turn) => ({
              user_text: turn.user_text,
              assistant_text: turn.assistant_text,
            })),
            sourceLanguage,
            targetLanguage,
          );
          setTurns((current) => current.map((turn, index) => (
            index === nextTask.index
              ? {
                ...turn,
                user_corrected_text: payload.user_corrected_text || turn.user_text || "",
                user_corrected_translation_text: payload.user_corrected_translation_text || "",
                user_correction_explanation: payload.user_correction_explanation || "",
              }
              : turn
          )));
          return;
        }

        const payload = await fetchTopicConversationUserLiteralTranslation(
          turns[nextTask.index].assistant_text,
          sourceLanguage,
          targetLanguage,
        );
        setTurns((current) => current.map((turn, index) => (
          index === nextTask.index
            ? { ...turn, assistant_translation_text: payload.user_translation_text || "" }
            : turn
        )));
      } catch {
        if (nextTask.type === "user-correction") {
          failedUserCorrectionRef.current.add(nextTask.index);
        } else {
          failedAssistantTranslationRef.current.add(nextTask.index);
        }
      } finally {
        inFlightRef.current = false;
        setRunToken((current) => current + 1);
      }
    };

    void runTask();
  }, [
    enabled,
    goalText,
    notes,
    roleText,
    runToken,
    setTurns,
    sourceLanguage,
    targetLanguage,
    topic,
    turns,
  ]);

  return {
    pendingCount,
    remainingCount,
    ready: remainingCount === 0,
  };
}

function findNextPendingTask(
  turns: ContentItemConversationResponse[],
  failedUserCorrection: Set<number>,
  failedAssistantTranslation: Set<number>,
): PendingTask | null {
  for (let index = 0; index < turns.length; index += 1) {
    const turn = turns[index];
    const userText = (turn.user_text || "").trim();
    if (userText && !(turn.user_corrected_text || "").trim() && !failedUserCorrection.has(index)) {
      return { type: "user-correction", index };
    }
    const assistantText = (turn.assistant_text || "").trim();
    if (assistantText && !(turn.assistant_translation_text || "").trim() && !failedAssistantTranslation.has(index)) {
      return { type: "assistant-translation", index };
    }
  }
  return null;
}
