import { useCallback, useEffect, useState, type FormEvent } from "react";

import { fetchContentItemDetail, fetchSession, markSeen, setContentItemLearned, submitReview } from "../api";
import { useI18n } from "../i18n";
import { useStudyLanguages } from "../studyLanguages";
import type { SessionItem } from "../types";
import NewItem from "./NewItem";
import PhraseReview from "./PhraseReview";
import WordReview from "./WordReview";

type StoredSessionState = {
  durationInput: string;
  sessionDurationMinutes: number | null;
  sessionEndsAtMs: number | null;
  remainingSeconds: number;
  sessionOutcome: "time_up" | "completed" | null;
  completedNewWordCount: number;
  index: number;
  items: SessionItem[];
  showIncorrectReviewItem: boolean;
  showExtendPrompt: boolean;
};

export default function SessionPage(): JSX.Element {
  const { t } = useI18n();
  const { sourceLanguage, targetLanguage } = useStudyLanguages();
  const sessionStorageKey = `active_session_${sourceLanguage}_${targetLanguage}`;
  const [items, setItems] = useState<SessionItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [durationInput, setDurationInput] = useState<string>("10");
  const [sessionDurationMinutes, setSessionDurationMinutes] = useState<number | null>(null);
  const [sessionEndsAtMs, setSessionEndsAtMs] = useState<number | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);
  const [sessionOutcome, setSessionOutcome] = useState<"time_up" | "completed" | null>(null);
  const [completedNewWordCount, setCompletedNewWordCount] = useState<number>(0);
  const [index, setIndex] = useState<number>(0);
  const [waitingNext, setWaitingNext] = useState<boolean>(false);
  const [showIncorrectReviewItem, setShowIncorrectReviewItem] = useState<boolean>(false);
  const [showExtendPrompt, setShowExtendPrompt] = useState<boolean>(false);
  const [hasHydratedState, setHasHydratedState] = useState<boolean>(false);
  const [restoredSnapshotHasItems, setRestoredSnapshotHasItems] = useState<boolean>(false);
  const [openedItem, setOpenedItem] = useState<SessionItem | null>(null);
  const [loadingOpenedItem, setLoadingOpenedItem] = useState<boolean>(false);
  const [openedItemError, setOpenedItemError] = useState<string>("");
  const [showNewWordsCelebration, setShowNewWordsCelebration] = useState<boolean>(false);

  const loadSession = useCallback(async (durationMinutes: number): Promise<void> => {
    setLoading(true);
    setError("");
    setShowIncorrectReviewItem(false);
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
      const parsed = JSON.parse(raw) as Partial<StoredSessionState>;
      setDurationInput(typeof parsed.durationInput === "string" ? parsed.durationInput : "10");
      setSessionDurationMinutes(typeof parsed.sessionDurationMinutes === "number" ? parsed.sessionDurationMinutes : null);
      setSessionEndsAtMs(typeof parsed.sessionEndsAtMs === "number" ? parsed.sessionEndsAtMs : null);
      setRemainingSeconds(typeof parsed.remainingSeconds === "number" ? parsed.remainingSeconds : 0);
      setSessionOutcome(parsed.sessionOutcome === "time_up" || parsed.sessionOutcome === "completed" ? parsed.sessionOutcome : null);
      setCompletedNewWordCount(typeof parsed.completedNewWordCount === "number" ? parsed.completedNewWordCount : 0);
      const parsedItems = Array.isArray(parsed.items) ? parsed.items : [];
      setItems(parsedItems);
      setRestoredSnapshotHasItems(parsedItems.length > 0);
      setIndex(typeof parsed.index === "number" ? parsed.index : 0);
      setShowIncorrectReviewItem(Boolean(parsed.showIncorrectReviewItem));
      setShowExtendPrompt(Boolean(parsed.showExtendPrompt));
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
      completedNewWordCount,
      index,
      items,
      showIncorrectReviewItem,
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
    completedNewWordCount,
    index,
    items,
    showIncorrectReviewItem,
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

  const current = items[index];

  const advance = (): void => {
    setWaitingNext(true);
    setTimeout(() => {
      setIndex((value) => {
        const nextIndex = value + 1;
        if (nextIndex >= items.length) {
          setSessionOutcome("completed");
          return 0;
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
        setShowIncorrectReviewItem(false);
        setWaitingNext(false);
        return [];
      }
      setIndex((currentIndex) => Math.max(0, Math.min(currentIndex, nextItems.length - 1)));
      setShowIncorrectReviewItem(false);
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

  const register = async (correct: boolean): Promise<void> => {
    if (!current || sessionOutcome !== null || showExtendPrompt) {
      return;
    }
    try {
      await submitReview(current.id, correct, current.direction ?? undefined);
    } catch (error) {
      if (isMissingItemError(error)) {
        handleMissingCurrentItem();
        return;
      }
      throw error;
    }
    if (correct) {
      advance();
      return;
    }
    setShowIncorrectReviewItem(true);
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
    if (current.mode === "new" && current.item_type === "word") {
      setCompletedNewWordCount((count) => {
        const nextCount = count + 1;
        if (nextCount > 0 && nextCount % 5 === 0) {
          setShowNewWordsCelebration(true);
        }
        return nextCount;
      });
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

  const continueAfterIncorrectReview = async (): Promise<void> => {
    if (sessionOutcome !== null || showExtendPrompt) {
      return;
    }
    setWaitingNext(true);
    setTimeout(() => {
      setIndex((value) => {
        const nextIndex = value + 1;
        if (nextIndex >= items.length) {
          setSessionOutcome("completed");
          return 0;
        }
        return nextIndex;
      });
      setShowIncorrectReviewItem(false);
      setWaitingNext(false);
    }, 450);
  };

  const startSession = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const parsed = Number.parseInt(durationInput, 10);
    if (!Number.isFinite(parsed) || parsed < 1 || parsed > 180) {
      setError(t("session.durationInvalid"));
      return;
    }
    setError("");
    setSessionOutcome(null);
    setCompletedNewWordCount(0);
    setShowNewWordsCelebration(false);
    setShowExtendPrompt(false);
    setRestoredSnapshotHasItems(false);
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
    setCompletedNewWordCount(0);
    setError("");
    setShowIncorrectReviewItem(false);
    setWaitingNext(false);
    setRestoredSnapshotHasItems(false);
    setShowNewWordsCelebration(false);
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
        {loadingOpenedItem && <p>{t("session.loading")}</p>}
        {!loadingOpenedItem && openedItemError && (
          <>
            <p className="error">{openedItemError}</p>
            <div className="actions">
              <button type="button" className="secondary-button" onClick={closeItemModal}>
                {t("words.close")}
              </button>
            </div>
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
      <main className="container" data-testid="session-start-form">
        <h1>{t("session.title")}</h1>
        <form className="card" onSubmit={startSession}>
          <p className="prompt">{t("session.durationPrompt")}</p>
          <label htmlFor="duration-minutes">{t("session.durationLabel")}</label>
          <input
            id="duration-minutes"
            data-testid="duration-minutes-input"
            type="number"
            min={1}
            max={180}
            value={durationInput}
            onChange={(event) => setDurationInput(event.target.value)}
          />
          {error && <p className="error">{t("session.error", { message: error })}</p>}
          <div className="actions">
            <button type="submit">{t("session.startButton")}</button>
          </div>
        </form>
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

  return (
    <>
      <main className="container" data-testid="session-page">
        <h1>{t("session.title")}</h1>
        <p>
          {t("session.itemProgress", { current: index + 1, total: items.length })}
        </p>
        <p data-testid="session-countdown">{t("session.timeRemaining", { time: formattedRemaining })}</p>
        <div className="actions session-header-actions">
          <button className="secondary-button" onClick={resetToSessionStart}>
            {t("session.restart")}
          </button>
        </div>
        <section className="card">
          {showIncorrectReviewItem ? (
            <NewItem key={`incorrect-${current.id}`} item={current} onContinue={continueAfterIncorrectReview} />
          ) : current.mode === "new" ? (
            <NewItem
              key={current.id}
              item={current}
              onContinue={registerSeenItem}
            />
          ) : current.item_type === "word" ? (
            <WordReview
              key={current.id}
              item={current}
              onAnswered={register}
              onOpenItem={(itemId) => void openItemModal(itemId)}
              onOpenOptionItem={(itemId) => void openItemModal(itemId)}
            />
          ) : (
            <PhraseReview key={current.id} item={current} onAnswered={register} onOpenOptionItem={(itemId) => void openItemModal(itemId)} />
          )}
        </section>
        {waitingNext && <p>{t("session.movingNext")}</p>}
        <div className="actions">
          <button className="secondary-button session-mark-learned-button" onClick={() => void markCurrentAsLearned()}>
            {t("session.markLearned")}
          </button>
        </div>
      </main>
      {openedItemModal}
      {extendPromptOverlay}
      {newWordsCelebrationOverlay}
    </>
  );
}
