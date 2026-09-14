import { useEffect, useState } from "react";

import { createLearningStreakPause, fetchLearningProgress, resumeLearningStreak } from "../apiProgress";
import { getLearningProgressUpdatedEventName } from "../apiCore";
import { useI18n } from "../i18n";
import { useStudyLanguages } from "../studyLanguages";
import type { LearningProgressResponse } from "../types";
import ProgressCalendar from "../features/progress/ProgressCalendar";

function localDateInputValue(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function shiftMonth(month: string, direction: -1 | 1): string {
  const [year, monthIndex] = month.split("-").map(Number);
  const next = new Date(year, monthIndex - 1 + direction, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`;
}

export default function ProgressPage(): JSX.Element {
  const { t } = useI18n();
  const { sourceLanguage, targetLanguage } = useStudyLanguages();
  const [progress, setProgress] = useState<LearningProgressResponse | null>(null);
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [savingPause, setSavingPause] = useState<boolean>(false);
  const [pauseStartDate, setPauseStartDate] = useState<string>(localDateInputValue());
  const [pauseEndDate, setPauseEndDate] = useState<string>(localDateInputValue());
  const [historyMonth, setHistoryMonth] = useState<string | null>(null);
  const [loadingCalendar, setLoadingCalendar] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async (): Promise<void> => {
      setLoadingCalendar(true);
      try {
        const nextProgress = await fetchLearningProgress(sourceLanguage, targetLanguage, historyMonth || undefined);
        if (active) {
          setProgress(nextProgress);
          setError("");
        }
      } catch {
        if (active) {
          setError(t("progress.loadError"));
        }
      } finally {
        if (active) {
          setLoading(false);
          setLoadingCalendar(false);
        }
      }
    };
    const eventName = getLearningProgressUpdatedEventName();
    void load();
    window.addEventListener(eventName, load);
    return () => {
      active = false;
      window.removeEventListener(eventName, load);
    };
  }, [historyMonth, sourceLanguage, t, targetLanguage]);

  const savePause = async (): Promise<void> => {
    setSavingPause(true);
    setError("");
    try {
      setProgress(await createLearningStreakPause(pauseStartDate, pauseEndDate, sourceLanguage, targetLanguage));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : t("progress.pauseError"));
    } finally {
      setSavingPause(false);
    }
  };

  const resumeStreak = async (): Promise<void> => {
    setSavingPause(true);
    setError("");
    try {
      setProgress(await resumeLearningStreak(sourceLanguage, targetLanguage));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : t("progress.resumeError"));
    } finally {
      setSavingPause(false);
    }
  };

  if (loading) {
    return <main className="container"><p>{t("progress.loading")}</p></main>;
  }
  if (!progress) {
    return <main className="container"><p className="error">{error || t("progress.loadError")}</p></main>;
  }

  const remainingSeconds = Math.max(0, (30 * 60) - progress.active_seconds_today);
  const remainingMinutes = Math.ceil(remainingSeconds / 60);
  const poolReady = progress.completed_items_today >= 5 && progress.due_reviews_remaining === 0;
  const displayedHistoryMonth = historyMonth || progress.history.at(-1)?.date.slice(0, 7) || localDateInputValue().slice(0, 7);
  const currentHistoryMonth = progress.current_history_month;

  return (
    <main className="container progress-page">
      <section className="card progress-hero-card">
        <p className="progress-kicker">{t("progress.title")}</p>
        <strong className="progress-streak-number">{progress.current_streak}</strong>
        <h1>{t("progress.currentStreak")}</h1>
        <p>{progress.pause_active
          ? t("progress.pausedUntil", { date: progress.pause_end_date || "" })
          : progress.qualified_today
            ? t("progress.safeToday")
            : t("progress.notYetQualified")}</p>
      </section>

      <section className="card progress-today-card">
        <h2>{t("progress.today")}</h2>
        <div className="progress-today-metrics">
          <div><strong>{Math.floor(progress.active_seconds_today / 60)}</strong><span>{t("progress.minutes")}</span></div>
          <div><strong>{progress.completed_items_today}</strong><span>{t("progress.items")}</span></div>
          <div><strong>{progress.due_reviews_remaining}</strong><span>{t("progress.reviewsLeft")}</span></div>
        </div>
        {!progress.qualified_today && !progress.pause_active && (
          <p className="hint">{poolReady ? t("progress.poolQualified") : t("progress.todayRequirement", { minutes: remainingMinutes })}</p>
        )}
      </section>

      <section className="card progress-details-card">
        <div className="progress-detail-row"><span>{t("progress.longestStreak")}</span><strong>{progress.longest_streak}</strong></div>
        <div className="progress-detail-row"><span>{t("progress.flexDays")}</span><strong>{progress.flex_days}</strong></div>
        <p className="hint">{t("progress.flexEarnedAfter", { count: Math.max(0, 7 - progress.qualifying_days_toward_flex) })}</p>
      </section>

      <ProgressCalendar
        history={progress.history}
        loading={loadingCalendar}
        canViewNextMonth={displayedHistoryMonth < currentHistoryMonth}
        onPreviousMonth={() => setHistoryMonth((month) => shiftMonth(month || currentHistoryMonth, -1))}
        onNextMonth={() => setHistoryMonth((month) => {
          const nextMonth = shiftMonth(month || currentHistoryMonth, 1);
          return nextMonth >= currentHistoryMonth ? null : nextMonth;
        })}
      />

      <section className="card progress-pause-card">
        <h2>{t("progress.pauseTitle")}</h2>
        <p className="hint">{t("progress.pauseHint")}</p>
        {progress.pause_active ? (
          <button type="button" className="secondary-button" onClick={() => void resumeStreak()} disabled={savingPause}>
            {savingPause ? t("progress.resumeSaving") : t("progress.resumeButton")}
          </button>
        ) : progress.pause_available ? (
          <div className="progress-pause-form">
            <label>{t("progress.pauseStart")}<input type="date" value={pauseStartDate} onChange={(event) => setPauseStartDate(event.target.value)} /></label>
            <label>{t("progress.pauseEnd")}<input type="date" value={pauseEndDate} onChange={(event) => setPauseEndDate(event.target.value)} /></label>
            <button type="button" className="secondary-button" onClick={() => void savePause()} disabled={savingPause}>
              {savingPause ? t("progress.pauseSaving") : t("progress.pauseButton")}
            </button>
          </div>
        ) : <p className="hint">{t("progress.pauseUnavailable", { date: progress.next_pause_available_on || "" })}</p>}
        {error && <p className="error">{error}</p>}
      </section>
    </main>
  );
}
