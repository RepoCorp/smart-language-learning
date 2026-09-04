import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";

import { suppressPromptAutoplayForAudio } from "../../audioAutoplayGuard";
import { completeDifficultItem, restoreSessionItemState, submitReview } from "../../api";
import { markSessionItemSeen } from "../../apiSessionProgress";
import type { SessionItem } from "../../types";

interface SessionReviewFlowOptions {
  current: SessionItem | null;
  items: SessionItem[];
  index: number;
  sessionOutcome: string | null;
  showExtendPrompt: boolean;
  showPostReviewItem: boolean;
  setItems: Dispatch<SetStateAction<SessionItem[]>>;
  setIndex: Dispatch<SetStateAction<number>>;
  setSessionOutcome: Dispatch<SetStateAction<string | null>>;
  setShowPostReviewItem: Dispatch<SetStateAction<boolean>>;
  setCurrentReviewCorrect: Dispatch<SetStateAction<boolean | null>>;
  onNewItemConfirmed: (result: unknown) => void;
  resetErrorMessage: string;
}

function isMissingItemError(error: unknown): boolean {
  return error instanceof Error && error.message.trim().toLowerCase() === "item not found";
}

export default function useSessionReviewFlow({
  current,
  items,
  index,
  sessionOutcome,
  showExtendPrompt,
  showPostReviewItem,
  setItems,
  setIndex,
  setSessionOutcome,
  setShowPostReviewItem,
  setCurrentReviewCorrect,
  onNewItemConfirmed,
  resetErrorMessage,
}: SessionReviewFlowOptions) {
  const [waitingNext, setWaitingNext] = useState(false);
  const [resetCurrentResultError, setResetCurrentResultError] = useState("");
  const [resettingCurrentResult, setResettingCurrentResult] = useState(false);
  const [currentReviewResetVersion, setCurrentReviewResetVersion] = useState(0);
  const reviewResultAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => () => {
    reviewResultAudioRef.current?.pause();
    reviewResultAudioRef.current = null;
  }, []);

  const advance = (): void => {
    setWaitingNext(true);
    window.setTimeout(() => {
      setIndex((value) => {
        const nextIndex = value + 1;
        if (nextIndex >= items.length) {
          setSessionOutcome("completed");
          return Math.max(0, items.length - 1);
        }
        return nextIndex;
      });
      setWaitingNext(false);
    }, 450);
  };

  const handleMissingCurrentItem = (): void => {
    setItems((currentItems) => {
      const removalIndex = Math.max(0, Math.min(index, currentItems.length - 1));
      const nextItems = [...currentItems];
      nextItems.splice(removalIndex, 1);
      if (!nextItems.length) {
        setSessionOutcome("completed");
      }
      setIndex((currentIndex) => Math.max(0, Math.min(currentIndex, Math.max(0, nextItems.length - 1))));
      setShowPostReviewItem(false);
      setCurrentReviewCorrect(null);
      setWaitingNext(false);
      return nextItems;
    });
  };

  const completeCurrentDifficultItemIfFinished = useCallback(async (itemId: number): Promise<void> => {
    if (!items.slice(index + 1).some((entry) => entry.id === itemId && entry.repeatedAfterFailure)) {
      await completeDifficultItem(itemId);
    }
  }, [index, items]);

  const register = async (correct: boolean): Promise<void> => {
    if (!current || sessionOutcome !== null || showExtendPrompt || showPostReviewItem) return;
    if (!current.repeatedAfterFailure) {
      try {
        await submitReview(current.id, correct, current.direction ?? undefined);
      } catch (error) {
        if (isMissingItemError(error)) {
          handleMissingCurrentItem();
          return;
        }
        throw error;
      }
    }
    setCurrentReviewCorrect(correct);
    setShowPostReviewItem(true);
  };

  const registerSeenItem = async (): Promise<void> => {
    if (!current || sessionOutcome !== null || showExtendPrompt) return;
    try {
      onNewItemConfirmed(await markSessionItemSeen(current.id));
    } catch (error) {
      if (isMissingItemError(error)) {
        handleMissingCurrentItem();
        return;
      }
      throw error;
    }
    advance();
  };

  const continueAfterReviewedItem = async (): Promise<void> => {
    if (!current || sessionOutcome !== null || showExtendPrompt || !showPostReviewItem) return;
    if (current.repeatedAfterFailure) await completeCurrentDifficultItemIfFinished(current.id);
    setShowPostReviewItem(false);
    setCurrentReviewCorrect(null);
    advance();
  };

  const resetCurrentResult = useCallback(async (): Promise<void> => {
    if (!current || !showPostReviewItem) return;
    setResettingCurrentResult(true);
    setResetCurrentResultError("");
    try {
      if (!current.repeatedAfterFailure && current.session_restore_state) {
        await restoreSessionItemState(current.id, current.session_restore_state);
      }
      reviewResultAudioRef.current?.pause();
      reviewResultAudioRef.current = null;
      setShowPostReviewItem(false);
      setCurrentReviewCorrect(null);
      setWaitingNext(false);
      setCurrentReviewResetVersion((value) => value + 1);
    } catch {
      setResetCurrentResultError(resetErrorMessage);
    } finally {
      setResettingCurrentResult(false);
    }
  }, [current, resetErrorMessage, setCurrentReviewCorrect, setShowPostReviewItem, showPostReviewItem]);

  const resetFlow = (): void => {
    setWaitingNext(false);
    setResettingCurrentResult(false);
    setResetCurrentResultError("");
  };

  return {
    waitingNext,
    resetCurrentResultError,
    resettingCurrentResult,
    currentReviewResetVersion,
    register,
    registerSeenItem,
    continueAfterReviewedItem,
    resetCurrentResult,
    resetFlow,
  };
}
