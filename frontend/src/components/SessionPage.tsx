import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";

import { suppressPromptAutoplayForAudio } from "../audioAutoplayGuard";
import { completeDifficultItem, fetchContentItemDetail, fetchSession, markSeen, restoreSessionItemState, setContentItemLearned, submitReview } from "../api";
import { useI18n } from "../i18n";
import { useStudyLanguages } from "../studyLanguages";
import type { SessionItem } from "../types";
import DangerousButton from "./DangerousButton";
import NewItem from "./NewItem";
import PhraseReview from "./PhraseReview";
import WordReview from "./WordReview";

type StoredSessionState = {
  durationInput: string;
  sessionDurationMinutes: number | null;
  sessionEndsAtMs: number | null;
  remainingSeconds: number;
  sessionOutcome: "time_up" | "completed" | null;
  index: number;
  items: SessionItem[];
  showPostReviewItem: boolean;
  currentReviewCorrect: boolean | null;
  showExtendPrompt: boolean;
};

type DailyNewItemProgress = {
  date: string;
  count: number;
};

const DAILY_NEW_ITEM_CELEBRATION_INTERVAL = 5;

function todayKey(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export default function SessionPage(): JSX.Element {
  const { t } = useI18n();
  const { sourceLanguage, targetLanguage } = useStudyLanguages();
  const sessionStorageKey = `active_session_${sourceLanguage}_${targetLanguage}`;
  const dailyNewItemStorageKey = `daily_new_items_${sourceLanguage}_${targetLanguage}`;
  const [items, setItems] = useState<SessionItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [durationInput, setDurationInput] = useState<string>("10");
  const [sessionDurationMinutes, setSessionDurationMinutes] = useState<number | null>(null);
  const [sessionEndsAtMs, setSessionEndsAtMs] = useState<number | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);
  const [sessionOutcome, setSessionOutcome] = useState<"time_up" | "completed" | null>(null);
  const [index, setIndex] = useState<number>(0);
  const [waitingNext, setWaitingNext] = useState<boolean>(false);
  const [showPostReviewItem, setShowPostReviewItem] = useState<boolean>(false);
  const [currentReviewCorrect, setCurrentReviewCorrect] = useState<boolean | null>(null);
  const [showExtendPrompt, setShowExtendPrompt] = useState<boolean>(false);
  const [hasHydratedState, setHasHydratedState] = useState<boolean>(false);
  const [restoredSnapshotHasItems, setRestoredSnapshotHasItems] = useState<boolean>(false);
  const [openedItem, setOpenedItem] = useState<SessionItem | null>(null);
  const [loadingOpenedItem, setLoadingOpenedItem] = useState<boolean>(false);
  const [openedItemError, setOpenedItemError] = useState<string>("");
  const [showNewWordsCelebration, setShowNewWordsCelebration] = useState<boolean>(false);
  const [resetCurrentResultError, setResetCurrentResultError] = useState<string>("");
  const [resettingCurrentResult, setResettingCurrentResult] = useState<boolean>(false);
  const [currentReviewResetVersion, setCurrentReviewResetVersion] = useState<number>(0);
  const reviewResultAudioRef = useRef<HTMLAudioElement | null>(null);

  const loadSession = useCallback(async (durationMinutes: number): Promise<void> => {
    setLoading(true);
    setError("");
    setResetCurrentResultError("");
    setShowPostReviewItem(false);
    setCurrentReviewCorrect(null);
    setCurrentReviewResetVersion(0);
    try {
      const data = await fetchSession(5, sourceLanguage, targetLanguage, durationMinutes);
      const loadedItems = data.items || [];
      setItems(loadedItems);
      setIndex(0);
    } catch {
      setError(t("session.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t, sourceLanguage, targetLanguage]);

  useEffect(() => {
    setHasHydratedState(false);
    setRestoredSnapshotHasItems(false);
    const raw = window.sessionStorage.getItem(sessionStorageKey);
    if (!raw) {
      setHasHydratedState(true);
      return;
    }
    try {
      const parsed = JSON.parse(raw) as Partial<StoredSessionState> & { showIncorrectReviewItem?: boolean };
      setDurationInput(typeof parsed.durationInput === "string" ? parsed.durationInput : "10");
      setSessionDurationMinutes(typeof parsed.sessionDurationMinutes === "number" ? parsed.sessionDurationMinutes : null);
      setSessionEndsAtMs(typeof parsed.sessionEndsAtMs === "number" ? parsed.sessionEndsAtMs : null);
      setRemainingSeconds(typeof parsed.remainingSeconds === "number" ? parsed.remainingSeconds : 0);
      setSessionOutcome(parsed.sessionOutcome === "time_up" || parsed.sessionOutcome === "completed" ? parsed.sessionOutcome : null);
      const parsedItems = Array.isArray(parsed.items) ? parsed.items : [];
      setItems(parsedItems);
      setRestoredSnapshotHasItems(parsedItems.length > 0);
      setIndex(typeof parsed.index === "number" ? parsed.index : 0);
      setShowExtendPrompt(Boolean(parsed.showExtendPrompt));
      setShowPostReviewItem(Boolean(parsed.showPostReviewItem ?? parsed.showIncorrectReviewItem));
      setCurrentReviewCorrect(typeof parsed.currentReviewCorrect === "boolean" ? parsed.currentReviewCorrect : null);
      setResetCurrentResultError("");
    } catch {
      window.sessionStorage.removeItem(sessionStorageKey);
    } finally {
      setHasHydratedState(true);
    }
  }, [sessionStorageKey]);

  useEffect(() => {
    if (!hasHydratedState) {
      return;
    }
    if (sessionDurationMinutes === null) {
      window.sessionStorage.removeItem(sessionStorageKey);
      return;
    }
    const snapshot: StoredSessionState = {
      durationInput,
      sessionDurationMinutes,
      sessionEndsAtMs,
      remainingSeconds,
      sessionOutcome,
      index,
      items,
      showPostReviewItem,
      currentReviewCorrect,
      showExtendPrompt,
    };
    window.sessionStorage.setItem(sessionStorageKey, JSON.stringify(snapshot));
  }, [
    hasHydratedState,
    sessionStorageKey,
    durationInput,
    sessionDurationMinutes,
    sessionEndsAtMs,
    remainingSeconds,
    sessionOutcome,
    index,
    items,
    showPostReviewItem,
    currentReviewCorrect,
    showExtendPrompt,
  ]);

  useEffect(() => {
    if (!hasHydratedState || sessionDurationMinutes === null) {
      return;
    }
    if (restoredSnapshotHasItems) {
      return;
    }
    if (items.length > 0) {
      return;
    }
    void loadSession(sessionDurationMinutes);
  }, [hasHydratedState, restoredSnapshotHasItems, loadSession, sessionDurationMinutes, items.length]);

  useEffect(() => {
    if (sessionEndsAtMs === null || sessionOutcome !== null || showExtendPrompt) {
      return;
    }

    const tick = (): void => {
      const diffSeconds = Math.max(0, Math.ceil((sessionEndsAtMs - Date.now()) / 1000));
      setRemainingSeconds(diffSeconds);
      if (diffSeconds <= 0) {
        setShowExtendPrompt(true);
      }
    };

    tick();
    const intervalId = window.setInterval(tick, 1000);
    return () => window.clearInterval(intervalId);
  }, [sessionEndsAtMs, sessionOutcome, showExtendPrompt]);

  useEffect(() => {
    if (!hasHydratedState) {
      return;
    }
    if (!items.length) {
      setIndex(0);
      return;
    }
    if (index >= items.length) {
      setIndex(items.length - 1);
    }
  }, [hasHydratedState, index, items.length]);

  useEffect(() => () => {
    if (reviewResultAudioRef.current) {
      reviewResultAudioRef.current.pause();
      reviewResultAudioRef.current = null;
    }
  }, []);

  const current = items[index];

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
      await markSeen(current.id);
    } catch (error) {
      if (isMissingItemError(error)) {
        handleMissingCurrentItem();
        return;
      }
      throw error;
    }
    if (current.mode === "new") {
      const today = todayKey();
      let currentProgress: DailyNewItemProgress = { date: today, count: 0 };
      try {
        const rawProgress = window.localStorage.getItem(dailyNewItemStorageKey);
        const parsedProgress = rawProgress ? JSON.parse(rawProgress) as Partial<DailyNewItemProgress> : null;
        if (parsedProgress?.date === today && typeof parsedProgress.count === "number") {
          currentProgress = { date: today, count: parsedProgress.count };
        }
      } catch {
        currentProgress = { date: today, count: 0 };
      }
      const nextProgress = { date: today, count: currentProgress.count + 1 };
      window.localStorage.setItem(dailyNewItemStorageKey, JSON.stringify(nextProgress));
      if (nextProgress.count > 0 && nextProgress.count % DAILY_NEW_ITEM_CELEBRATION_INTERVAL === 0) {
        setShowNewWordsCelebration(true);
      }
    }
    advance();
  };

  const markCurrentAsLearned = async (): Promise<void> => {
    if (!current || sessionOutcome !== null || showExtendPrompt) {
      return;
    }
    try {
      await setContentItemLearned(current.id, true, sourceLanguage, targetLanguage);
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
    setShowNewWordsCelebration(false);
    setShowExtendPrompt(false);
    setRestoredSnapshotHasItems(false);
    setShowPostReviewItem(false);
    setCurrentReviewCorrect(null);
    setRemainingSeconds(parsed * 60);
    setSessionEndsAtMs(Date.now() + parsed * 60 * 1000);
    setSessionDurationMinutes(parsed);
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
    setRestoredSnapshotHasItems(false);
    setShowNewWordsCelebration(false);
    setResettingCurrentResult(false);
  };

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const formattedRemaining = `${minutes}:${String(seconds).padStart(2, "0")}`;

  const extendSession = (): void => {
    const extensionMinutes = 5;
    const nextEndsAt = Date.now() + extensionMinutes * 60 * 1000;
    setSessionEndsAtMs(nextEndsAt);
    setRemainingSeconds(extensionMinutes * 60);
    setShowExtendPrompt(false);
  };

  const endSessionNow = (): void => {
    setShowExtendPrompt(false);
    setSessionOutcome("time_up");
  };

  const extendPromptOverlay = showExtendPrompt ? (
    <div className="blocking-modal-overlay session-extend-overlay" role="dialog" aria-modal="true">
      <section className="blocking-modal">
        <p className="error">{t("session.extendPromptTitle")}</p>
        <p>{t("session.extendPromptMessage")}</p>
        <div className="actions">
          <button onClick={extendSession}>{t("session.extendYes")}</button>
          <button className="secondary-button" onClick={endSessionNow}>
            {t("session.extendNo")}
          </button>
        </div>
      </section>
    </div>
  ) : null;
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
  const newWordsCelebrationOverlay = showNewWordsCelebration ? (
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
          <button type="button" onClick={() => setShowNewWordsCelebration(false)}>
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
    );
  }

  if (loading) {
    return (
      <>
        <main className="container">{t("session.loading")}</main>
        {extendPromptOverlay}
        {newWordsCelebrationOverlay}
      </>
    );
  }

  if (error) {
    return (
      <>
        <main className="container error">{t("session.error", { message: error })}</main>
        {extendPromptOverlay}
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
        {extendPromptOverlay}
        {newWordsCelebrationOverlay}
      </>
    );
  }

  if (!current) {
    return (
      <>
        <main className="container">{t("session.loading")}</main>
        {extendPromptOverlay}
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
            {showPostReviewItem && currentReviewCorrect !== null && (
              <p className={currentReviewCorrect ? "hint" : "error"}>
                {currentReviewCorrect ? t("review.passed") : t("review.failed")}
              </p>
            )}
            {resetCurrentResultError && <p className="error">{t("session.error", { message: resetCurrentResultError })}</p>}
            <div className="actions session-header-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => void openItemModal(current.id)}
                disabled={loadingOpenedItem}
              >
                {t("words.openItem")}
              </button>
              <button className="secondary-button" onClick={resetToSessionStart}>
                {t("session.restart")}
              </button>
              {showPostReviewItem && (
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => void resetCurrentResult()}
                  disabled={waitingNext || resettingCurrentResult}
                >
                  {t("session.resetCurrentResult")}
                </button>
              )}
            </div>
            <section className="card">
          {current.mode === "new" ? (
            <NewItem
              key={currentRenderKey}
              item={current}
              onContinue={registerSeenItem}
            />
          ) : current.item_type === "word" ? (
            <WordReview
              key={currentRenderKey}
              item={current}
              onAnswered={register}
              reviewComplete={showPostReviewItem}
              onNextItem={continueAfterReviewedItem}
            />
          ) : (
            <PhraseReview
              key={currentRenderKey}
              item={current}
              onAnswered={register}
              reviewComplete={showPostReviewItem}
              onNextItem={continueAfterReviewedItem}
            />
          )}
            </section>
            {waitingNext && <p>{t("session.movingNext")}</p>}
            <div className="actions">
              <DangerousButton className="secondary-button session-mark-learned-button" onConfirm={markCurrentAsLearned}>
                {t("session.markLearned")}
              </DangerousButton>
            </div>
          </main>
      {openedItemModal}
      {extendPromptOverlay}
      {newWordsCelebrationOverlay}
    </>
  );
}
