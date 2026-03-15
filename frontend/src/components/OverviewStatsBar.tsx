import { useEffect, useState } from "react";

import { fetchOverviewStats, getOverviewStatsUpdatedEventName } from "../api";
import { useI18n } from "../i18n";
import type { OverviewStatsResponse } from "../types";

export default function OverviewStatsBar(): JSX.Element {
  const [stats, setStats] = useState<OverviewStatsResponse | null>(null);
  const { language, setLanguage, t } = useI18n();

  useEffect(() => {
    let mounted = true;
    const updateEvent = getOverviewStatsUpdatedEventName();

    const load = async (): Promise<void> => {
      try {
        const data = await fetchOverviewStats();
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
  }, []);

  return (
    <header className="overview-stats">
      <div className="overview-stats-content">
        <span>{t("stats.ready", { count: stats?.ready_to_review ?? "-" })}</span>
        <span>{t("stats.future", { count: stats?.future_reviews ?? "-" })}</span>
        <span>{t("stats.notStarted", { count: stats?.not_started ?? "-" })}</span>
        <label className="language-switcher">
          {t("lang.label")}
          <select
            value={language}
            onChange={(event) => setLanguage(event.target.value === "es" ? "es" : "en")}
            aria-label={t("lang.label")}
          >
            <option value="en">{t("lang.english")}</option>
            <option value="es">{t("lang.spanish")}</option>
          </select>
        </label>
      </div>
    </header>
  );
}
