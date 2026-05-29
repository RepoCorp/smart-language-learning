import { useEffect, useState } from "react";
import type { ReactNode } from "react";

import { fetchOverviewStats, getOverviewStatsUpdatedEventName } from "../api";
import { useI18n } from "../i18n";
import { useStudyLanguages } from "../studyLanguages";
import type { OverviewStatsResponse } from "../types";

interface OverviewStatsBarProps {
  topBarControl?: ReactNode;
}

export default function OverviewStatsBar({ topBarControl }: OverviewStatsBarProps): JSX.Element {
  const [stats, setStats] = useState<OverviewStatsResponse | null>(null);
  const { t } = useI18n();
  const { sourceLanguage, targetLanguage } = useStudyLanguages();

  useEffect(() => {
    let mounted = true;
    const updateEvent = getOverviewStatsUpdatedEventName();

    const load = async (): Promise<void> => {
      try {
        const data = await fetchOverviewStats(sourceLanguage, targetLanguage);
        if (mounted) {
          setStats(data);
        }
      } catch {
        if (mounted) {
          setStats(null);
        }
      }
    };

    void load();
    const onStatsUpdated = (): void => {
      void load();
    };
    window.addEventListener(updateEvent, onStatsUpdated);

    return () => {
      mounted = false;
      window.removeEventListener(updateEvent, onStatsUpdated);
    };
  }, [sourceLanguage, targetLanguage]);

  return (
    <header className="overview-stats">
      <div className="overview-stats-content">
        <div className="overview-stats-metrics">
          <span>{t("stats.ready", { count: stats?.ready_to_review ?? "-" })}</span>
          <span>{t("stats.future", { count: stats?.future_reviews ?? "-" })}</span>
          <span>{t("stats.notStarted", { count: stats?.not_started ?? "-" })}</span>
          <span className="overview-stats-word-count">{t("stats.words", { count: stats?.word_items ?? "-" })}</span>
          {topBarControl ? <div className="overview-stats-top-control">{topBarControl}</div> : null}
        </div>
      </div>
    </header>
  );
}
