import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";

import { suppressPromptAutoplayForAudio } from "../audioAutoplayGuard";
import { completeDifficultItem, fetchContentItemDetail, restoreSessionItemState, submitReview } from "../api";
import { markSessionItemSeen } from "../apiSessionProgress";
import { useI18n } from "../i18n";
import { useStudyLanguages } from "../studyLanguages";
import type { SessionItem } from "../types";
import DangerousButton from "./DangerousButton";
import NewItem from "./NewItem";
import SessionCurrentItem from "./session/SessionCurrentItem";
import { useNewItemCelebration } from "./useNewItemCelebration";
import useSessionStudyActivity from "./useSessionStudyActivity";
import { useSessionItemPayloads } from "../features/session/useSessionItemPayloads";
import { useSessionLifecycle } from "../features/session/useSessionLifecycle";

export default function SessionPage(): JSX.Element {
  const { t } = useI18n();
  const { sourceLanguage, targetLanguage } = useStudyLanguages();
  const {
    items,
    setItems,
    loading,
    error,
    setError,
    durationInput,
    setDurationInput,
    sessionDurationMinutes,
    setSessionDurationMinutes,
    sessionEndsAtMs,
    setSessionEndsAtMs,
    remainingSeconds,
    setRemainingSeconds,
    sessionOutcome,
    setSessionOutcome,
    index,
    setIndex,
    showPostReviewItem,
    setShowPostReviewItem,
    setCurrentReviewCorrect,
    showExtendPrompt,
    setShowExtendPrompt,
    sessionPlanToken,
    loadSession,
  } = useSessionLifecycle({ sourceLanguage, targetLanguage });
  const [waitingNext, setWaitingNext] = useState<boolean>(false);
  const [openedItem, setOpenedItem] = useState<SessionItem | null>(null);
  const [loadingOpenedItem, setLoadingOpenedItem] = useState<boolean>(false);
  const [openedItemError, setOpenedItemError] = useState<string>("");
  const {
    showNewItemCelebration,
    registerConfirmedNewItem,
    dismissNewItemCelebration,
  } = useNewItemCelebration();
  const [resetCurrentResultError, setResetCurrentResultError] = useState<string>("");
  const [resettingCurrentResult, setResettingCurrentResult] = useState<boolean>(false);
  const [currentReviewResetVersion, setCurrentReviewResetVersion] = useState<number>(0);
  const reviewResultAudioRef = useRef<HTMLAudioElement | null>(null);
  const {
    currentItem: current,
    currentItemLoading,
    currentItemError,
  } = useSessionItemPayloads({
    entries: items,
    index,
    sourceLanguage,
    targetLanguage,
    planToken: sessionPlanToken,
  });

  useSessionStudyActivity(
    sessionDurationMinutes !== null
      && sessionOutcome === null
      && !showExtendPrompt
      && !loading
      && items.length > 0,
    sourceLanguage,
    targetLanguage,
  );

  useEffect(() => () => {
    if (reviewResultAudioRef.current) {
      reviewResultAudioRef.current.pause();
      reviewResultAudioRef.current = null;
    }
  }, []);

  const playReviewedItemAudio = useCallback((): void => {
    const audioUrl = current?.audio_url || "";
    if (!audioUrl) {
      return;
    }
    if (reviewResultAudioRef.current) {
      reviewResultAudioRef.current.pause();
      reviewResultAudioRef.current.currentTime = 0;
    }
    const audio = new Audio(audioUrl);
    reviewResultAudioRef.current = audio;
    suppressPromptAutoplayForAudio(audio);
    const clearCurrentAudio = (): void => {
      if (reviewResultAudioRef.current === audio) {
        reviewResultAudioRef.current = null;
      }
    };
    audio.addEventListener("ended", clearCurrentAudio, { once: true });
    audio.addEventListener("error", clearCurrentAudio, { once: true });
    void audio.play().catch(clearCurrentAudio);
  }, [current]);

  const advance = (): void => {
    setWaitingNext(true);
    setTimeout(() => {
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
      if (!currentItems.length) {
        return currentItems;
      }
      const removalIndex = Math.max(0, Math.min(index, currentItems.length - 1));
      const nextItems = [...currentItems];
      nextItems.splice(removalIndex, 1);
      if (!nextItems.length) {
        setSessionOutcome("completed");
        setShowPostReviewItem(false);
        setCurrentReviewCorrect(null);
        setWaitingNext(false);
        return [];
      }
      setIndex((currentIndex) => Math.max(0, Math.min(currentIndex, nextItems.length - 1)));
      setShowPostReviewItem(false);
      setCurrentReviewCorrect(null);
      setWaitingNext(false);
      return nextItems;
    });
  };

  const isMissingItemError = (error: unknown): boolean => {
    if (!(error instanceof Error)) {
      return false;
    }
    return error.message.trim().toLowerCase() === "item not found";
  };

  const completeCurrentDifficultItemIfFinished = useCallback(async (itemId: number): Promise<void> => {
    const hasLaterStep = items.slice(index + 1).some((entry) => entry.id === itemId && entry.repeatedAfterFailure);
    if (!hasLaterStep) {
      await completeDifficultItem(itemId);
    }
  }, [index, items]);

  const register = async (correct: boolean): Promise<void> => {
    if (!current || sessionOutcome !== null || showExtendPrompt || showPostReviewItem) {
      return;
    }
    const reviewedItem = current;
    if (!reviewedItem.repeatedAfterFailure) {
      try {
        await submitReview(reviewedItem.id, correct, reviewedItem.direction ?? undefined);
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
    if (!current || sessionOutcome !== null || showExtendPrompt) {
      return;
    }
    try {
      const result = await markSessionItemSeen(current.id);
      registerConfirmedNewItem(result);
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
    if (!current || sessionOutcome !== null || showExtendPrompt || !showPostReviewItem) {
      return;
    }
    if (current.repeatedAfterFailure) {
      await completeCurrentDifficultItemIfFinished(current.id);
    }
    setShowPostReviewItem(false);
    setCurrentReviewCorrect(null);
    advance();
  };

  const resetCurrentResult = useCallback(async (): Promise<void> => {
    if (!current || !showPostReviewItem) {
      return;
    }
    setResettingCurrentResult(true);
    setResetCurrentResultError("");
    try {
      if (!current.repeatedAfterFailure && current.session_restore_state) {
        await restoreSessionItemState(current.id, current.session_restore_state);
      }
      if (reviewResultAudioRef.current) {
        reviewResultAudioRef.current.pause();
        reviewResultAudioRef.current = null;
      }
      setShowPostReviewItem(false);
      setCurrentReviewCorrect(null);
      setWaitingNext(false);
      setCurrentReviewResetVersion((value) => value + 1);
    } catch {
      setResetCurrentResultError(t("session.resetCurrentResultFailed"));
    } finally {
      setResettingCurrentResult(false);
    }
  }, [current, showPostReviewItem, t]);

  const openItemModal = async (itemId: number): Promise<void> => {
    setLoadingOpenedItem(true);
    setOpenedItem(null);
    setOpenedItemError("");
    try {
      const detail = await fetchContentItemDetail(itemId, sourceLanguage, targetLanguage);
      setOpenedItem({
        id: detail.id,
        item_type: detail.item_type,
        spanish_text: detail.spanish_text,
        german_text: detail.german_text,
        example_sentence: detail.example_sentence || "",
        notes: detail.notes || "",
        word_type: detail.word_type || "",
        plural_german: detail.plural_german || "",
        audio_url: detail.audio_url || "",
        exercise_phrases: detail.exercise_phrases || {},
        mode: "new",
        direction: null,
        options: [],
        dialog_phrase_answer: detail.dialog_phrase_answer || "",
        dialog_phrase_scene: detail.dialog_phrase_scene || "",
        dialog_phrase_scene_audio_urls: detail.dialog_phrase_scene_audio_urls || [],
        dialog_phrase_options: detail.dialog_phrase_options || [],
        dialog_phrase_turns: detail.dialog_phrase_turns || [],
        dialog_phrase_odd_index: detail.dialog_phrase_odd_index ?? null,
        related_dialogs: detail.related_dialogs || [],
        compare_words: detail.compare_words || [],
        compare_words_insights: detail.compare_words_insights || "",
        item_questions: detail.item_questions || [],
      });
    } catch {
      setOpenedItemError(t("manage.error.load"));
    } finally {
      setLoadingOpenedItem(false);
    }
  };

  const closeItemModal = (): void => {
    setOpenedItem(null);
    setLoadingOpenedItem(false);
    setOpenedItemError("");
  };

  const startSession = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const parsed = Number.parseInt(durationInput, 10);
    if (!Number.isFinite(parsed) || parsed < 1 || parsed > 180) {
      setError(t("session.durationInvalid"));
      return;
    }
    setError("");
    setResetCurrentResultError("");
    setSessionOutcome(null);
    setShowExtendPrompt(false);
    setShowPostReviewItem(false);
    setCurrentReviewCorrect(null);
    setRemainingSeconds(parsed * 60);
    setSessionEndsAtMs(Date.now() + parsed * 60 * 1000);
    setSessionDurationMinutes(parsed);
    void loadSession(parsed);
  };

  const resetToSessionStart = (): void => {
    setSessionDurationMinutes(null);
    setSessionEndsAtMs(null);
    setSessionOutcome(null);
    setShowExtendPrompt(false);
    setRemainingSeconds(0);
    setItems([]);
    setIndex(0);
    setError("");
    setResetCurrentResultError("");
    setShowPostReviewItem(false);
    setCurrentReviewCorrect(null);
    setWaitingNext(false);
    setResettingCurrentResult(false);
  };

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const formattedRemaining = `${minutes}:${String(seconds).padStart(2, "0")}`;

  const openedItemModal = (loadingOpenedItem || openedItem || openedItemError) ? (
    <div className="blocking-modal-overlay" role="dialog" aria-modal="true">
      <div className="blocking-modal related-dialogs-modal">
        {!openedItem && (
          <button type="button" className="modal-corner-close" aria-label={t("words.close")} onClick={closeItemModal}>
            ×
          </button>
        )}
        {loadingOpenedItem && <p>{t("session.loading")}</p>}
        {!loadingOpenedItem && openedItemError && (
          <>
            <p className="error">{openedItemError}</p>
          </>
        )}
        {!loadingOpenedItem && openedItem && (
          <NewItem item={openedItem} readOnly onClose={closeItemModal} />
        )}
      </div>
    </div>
  ) : null;
  const newWordsCelebrationOverlay = showNewItemCelebration ? (
    <div className="blocking-modal-overlay session-celebration-overlay" role="dialog" aria-modal="true">
      <section className="blocking-modal session-celebration-modal">
        <div className="session-celebration-burst" aria-hidden="true">
          {Array.from({ length: 18 }, (_, index) => (
            <span key={index} />
          ))}
        </div>
        <p className="session-celebration-kicker">{t("session.newWordsCelebrationKicker")}</p>
        <h2>{t("session.newWordsCelebrationTitle")}</h2>
        <p>{t("session.newWordsCelebrationMessage")}</p>
        <div className="actions">
          <button type="button" onClick={dismissNewItemCelebration}>
            {t("session.newWordsCelebrationContinue")}
          </button>
        </div>
      </section>
    </div>
  ) : null;

  if (sessionDurationMinutes === null) {
    return (
      <main className="container session-start-page" data-testid="session-start-form">
        <section className="card session-start-card">
          <div className="session-start-intro">
            <p className="session-start-eyebrow">{t("session.title")}</p>
            <h1>{t("session.durationPrompt")}</h1>
          </div>
          <form className="session-start-form" onSubmit={startSession}>
            <div className="session-start-controls">
              <label className="session-duration-field" htmlFor="duration-minutes">
                <span>{t("session.durationLabel")}</span>
                <input
                  id="duration-minutes"
                  data-testid="duration-minutes-input"
                  type="number"
                  min={1}
                  max={180}
                  value={durationInput}
                  onChange={(event) => setDurationInput(event.target.value)}
                />
              </label>
            </div>

            {error && <p className="error">{t("session.error", { message: error })}</p>}
            <div className="actions session-start-actions">
              <button type="submit">{t("session.startButton")}</button>
            </div>
          </form>
        </section>
      </main>
    );
  }

  if (sessionOutcome !== null) {
    return (
      <>
        <main className="container">
          <h1>{t("session.title")}</h1>
          <section className="card">
            {sessionOutcome === "time_up" ? (
              <>
                <p className="error">{t("session.timeUpTitle")}</p>
                <p>{t("session.timeUpMessage")}</p>
              </>
            ) : (
              <>
                <p>{t("session.completedTitle")}</p>
                <p>{t("session.completedMessage")}</p>
              </>
            )}
            {resetCurrentResultError && <p className="error">{t("session.error", { message: resetCurrentResultError })}</p>}
            <div className="actions">
              <button onClick={resetToSessionStart}>{t("session.startAnother")}</button>
            </div>
          </section>
        </main>
        {newWordsCelebrationOverlay}
      </>
    );
  }

  if (loading || (items.length > 0 && currentItemLoading)) {
    return (
      <>
        <main className="container">{t("session.loading")}</main>
        {newWordsCelebrationOverlay}
      </>
    );
  }

  if (error || currentItemError) {
    return (
      <>
        <main className="container error">{t("session.error", { message: error || currentItemError })}</main>
        {newWordsCelebrationOverlay}
      </>
    );
  }

  if (!items.length) {
    return (
      <>
        <main className="container">
          <p>{t("session.empty")}</p>
        </main>
        {newWordsCelebrationOverlay}
      </>
    );
  }

  if (!current) {
    return (
      <>
        <main className="container">{t("session.loading")}</main>
        {newWordsCelebrationOverlay}
      </>
    );
  }

  const currentRenderKey = [
    current.id,
    current.mode,
    current.direction || "none",
    current.repeatPracticeStep || "base",
    current.repeatedAfterFailure ? "retry" : "fresh",
    index,
    currentReviewResetVersion,
  ].join(":");

      return (
        <>
          <main className="container" data-testid="session-page">
            <h1>{t("session.title")}</h1>
            <div className="session-page-status-row">
              <p>
                {t("session.itemProgress", { current: index + 1, total: items.length })}
              </p>
              <p data-testid="session-countdown">{t("session.timeRemaining", { time: formattedRemaining })}</p>
            </div>
            {resetCurrentResultError && <p className="error">{t("session.error", { message: resetCurrentResultError })}</p>}
            <div className="actions session-header-actions">
              <DangerousButton className="secondary-button dangerous-action-button" onConfirm={resetToSessionStart}>
                {t("session.restart")}
              </DangerousButton>
            </div>
            <section className="card">
          <SessionCurrentItem
            item={current}
            renderKey={currentRenderKey}
            reviewComplete={showPostReviewItem}
            onNewItemContinue={registerSeenItem}
            onReviewAnswered={register}
            onNextItem={continueAfterReviewedItem}
            postReviewActions={showPostReviewItem ? (
              <>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => void openItemModal(current.id)}
                  disabled={loadingOpenedItem}
                >
                  {t("words.openItem")}
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => void resetCurrentResult()}
                  disabled={waitingNext || resettingCurrentResult}
                >
                  {t("session.resetCurrentResult")}
                </button>
              </>
            ) : undefined}
          />
            </section>
            {waitingNext && <p>{t("session.movingNext")}</p>}
          </main>
      {openedItemModal}
      {newWordsCelebrationOverlay}
    </>
  );
}
