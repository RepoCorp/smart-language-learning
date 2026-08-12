import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { fetchLearningProgress } from "../apiProgress";
import { getLearningProgressUpdatedEventName } from "../apiCore";
import { useI18n } from "../i18n";
import { useStudyLanguages } from "../studyLanguages";
import type { LearningProgressResponse } from "../types";

export default function LearningStreakControl(): JSX.Element {
  const { t } = useI18n();
  const { sourceLanguage, targetLanguage } = useStudyLanguages();
  const navigate = useNavigate();
  const [progress, setProgress] = useState<LearningProgressResponse | null>(null);

  useEffect(() => {
    let active = true;
    const load = async (): Promise<void> => {
      try {
        const nextProgress = await fetchLearningProgress(sourceLanguage, targetLanguage);
        if (active) {
          setProgress(nextProgress);
        }
      } catch {
        if (active) {
          setProgress(null);
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
  }, [sourceLanguage, targetLanguage]);

  const stateClass = progress?.pause_active
    ? "learning-streak-control-paused"
    : progress?.qualified_today
      ? "learning-streak-control-complete"
      : "";
  return (
    <button
      type="button"
      className={`learning-streak-control ${stateClass}`}
      onClick={() => navigate("/progress")}
      aria-label={t("progress.open")}
      title={t("progress.open")}
    >
      <strong>{progress?.current_streak ?? "-"}</strong>
      <span>{progress?.pause_active ? t("progress.pausedShort") : t("progress.streakShort")}</span>
    </button>
  );
}
