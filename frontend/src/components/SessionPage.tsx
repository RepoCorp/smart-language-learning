import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";

import { fetchSession, markSeen, setContentItemLearned, submitReview } from "../api";
import { useI18n } from "../i18n";
import { useStudyLanguages } from "../studyLanguages";
import type { SessionItem } from "../types";
import NewItem from "./NewItem";
import PhraseReview from "./PhraseReview";
import WordReview from "./WordReview";

export default function SessionPage(): JSX.Element {
  const { t } = useI18n();
  const { sourceLanguage, targetLanguage } = useStudyLanguages();
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
  const [showIncorrectReviewItem, setShowIncorrectReviewItem] = useState<boolean>(false);

  const loadSession = useCallback(async (durationMinutes: number): Promise<void> => {
    setLoading(true);
    setError("");
    setShowIncorrectReviewItem(false);
    try {
      const data = await fetchSession(5, sourceLanguage, targetLanguage, durationMinutes);
      setItems(data.items || []);
      setIndex(0);
    } catch {
      setError(t("session.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t, sourceLanguage, targetLanguage]);

  useEffect(() => {
    if (sessionDurationMinutes === null) {
      return;
    }
    void loadSession(sessionDurationMinutes);
  }, [loadSession, sessionDurationMinutes]);

  useEffect(() => {
    if (sessionEndsAtMs === null || sessionOutcome !== null) {
      return;
    }

    const tick = (): void => {
      const diffSeconds = Math.max(0, Math.ceil((sessionEndsAtMs - Date.now()) / 1000));
      setRemainingSeconds(diffSeconds);
      if (diffSeconds <= 0) {
        setSessionOutcome("time_up");
      }
    };

    tick();
    const intervalId = window.setInterval(tick, 1000);
    return () => window.clearInterval(intervalId);
  }, [sessionEndsAtMs, sessionOutcome]);

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

  const register = async (correct: boolean): Promise<void> => {
    if (!current || sessionOutcome !== null) {
      return;
    }
    await submitReview(current.id, correct, current.direction ?? undefined);
    if (correct) {
      advance();
      return;
    }
    setShowIncorrectReviewItem(true);
  };

  const registerSeenItem = async (): Promise<void> => {
    if (!current || sessionOutcome !== null) {
      return;
    }
    await markSeen(current.id);
    advance();
  };

  const markCurrentAsLearned = async (): Promise<void> => {
    if (!current || sessionOutcome !== null) {
      return;
    }
    await setContentItemLearned(current.id, true, sourceLanguage, targetLanguage);
    advance();
  };

  const continueAfterIncorrectReview = async (): Promise<void> => {
    if (sessionOutcome !== null) {
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
    setRemainingSeconds(parsed * 60);
    setSessionEndsAtMs(Date.now() + parsed * 60 * 1000);
    setSessionDurationMinutes(parsed);
  };

  const resetToSessionStart = (): void => {
    setSessionDurationMinutes(null);
    setSessionEndsAtMs(null);
    setSessionOutcome(null);
    setRemainingSeconds(0);
    setItems([]);
    setIndex(0);
    setError("");
    setShowIncorrectReviewItem(false);
    setWaitingNext(false);
  };

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const formattedRemaining = `${minutes}:${String(seconds).padStart(2, "0")}`;

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
    return <main className="container">{t("session.loading")}</main>;
  }

  if (error) {
    return <main className="container error">{t("session.error", { message: error })}</main>;
  }

  if (!items.length) {
    return (
      <main className="container">
        <p>{t("session.empty")}</p>
        <p>
          <Link to="/content/create">{t("session.createContent")}</Link> |{" "}
          <Link to="/content/manage">{t("content.manageLink")}</Link> |{" "}
          <Link to="/conversation">{t("conversation.navLink")}</Link>
        </p>
      </main>
    );
  }

  if (!current) {
    return <main className="container">{t("session.loading")}</main>;
  }

  return (
    <main className="container" data-testid="session-page">
      <h1>{t("session.title")}</h1>
      <p>
        <Link to="/content/create">{t("session.createContent")}</Link> |{" "}
        <Link to="/content/manage">{t("content.manageLink")}</Link> |{" "}
        <Link to="/conversation">{t("conversation.navLink")}</Link>
      </p>
      <p>
        {t("session.itemProgress", { current: index + 1, total: items.length })}
      </p>
      <p data-testid="session-countdown">{t("session.timeRemaining", { time: formattedRemaining })}</p>
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
          <WordReview key={current.id} item={current} onAnswered={register} />
        ) : (
          <PhraseReview key={current.id} item={current} onAnswered={register} />
        )}
      </section>
      {waitingNext && <p>{t("session.movingNext")}</p>}
      <div className="actions">
        <button className="secondary-button" onClick={() => void markCurrentAsLearned()}>
          {t("session.markLearned")}
        </button>
      </div>
    </main>
  );
}
