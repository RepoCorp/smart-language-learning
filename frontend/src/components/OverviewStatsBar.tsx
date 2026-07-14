import { useEffect, useState } from "react";
import type { ReactNode } from "react";

import { fetchOverviewStats } from "../api";
import { getOverviewStatsUpdatedEventName } from "../apiCore";
import { useI18n } from "../i18n";
import { useStudyLanguages } from "../studyLanguages";
import type { OverviewStatsResponse } from "../types";

interface OverviewStatsBarProps {
  topBarControl?: ReactNode;
  showFutureReviews?: boolean;
  showWordCount?: boolean;
}

export default function OverviewStatsBar({
  topBarControl,
  showFutureReviews = true,
  showWordCount = true,
}: OverviewStatsBarProps): JSX.Element {
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

  const metricCards = [
    { key: "ready", label: t("stats.readyLabel"), value: stats?.ready_to_review ?? "-" },
    ...(showFutureReviews ? [{ key: "future", label: t("stats.futureLabel"), value: stats?.future_reviews ?? "-" }] : []),
    { key: "not-started", label: t("stats.notStartedLabel"), value: stats?.not_started ?? "-" },
    ...(showWordCount ? [{ key: "words", label: t("stats.wordsLabel"), value: stats?.word_items ?? "-" }] : []),
  ];

  return (
    <header className="overview-stats">
      <div className="overview-stats-content">
        {topBarControl ? <div className="overview-stats-header">{topBarControl}</div> : null}
        <div className="overview-stats-metrics">
          {metricCards.map((metric) => (
            <div key={metric.key} className="overview-stats-metric-card">
              <span className="overview-stats-metric-label">{metric.label}</span>
              <strong className="overview-stats-metric-value">{metric.value}</strong>
            </div>
          ))}
        </div>
      </div>
    </header>
  );
}
