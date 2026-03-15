import { useEffect, useState } from "react";

import { fetchOverviewStats, getOverviewStatsUpdatedEventName } from "../api";
import { useI18n } from "../i18n";
import { type StudyLanguageCode, useStudyLanguages } from "../studyLanguages";
import type { OverviewStatsResponse } from "../types";

export default function OverviewStatsBar(): JSX.Element {
  const [stats, setStats] = useState<OverviewStatsResponse | null>(null);
  const { language, setLanguage, t } = useI18n();
  const { sourceLanguage, targetLanguage, setSourceLanguage, setTargetLanguage, supportedLanguages } = useStudyLanguages();
  const languageKeyByCode: Record<StudyLanguageCode, Parameters<typeof t>[0]> = {
    spanish: "study.language.spanish",
    english: "study.language.english",
    german: "study.language.german",
    french: "study.language.french",
    italian: "study.language.italian",
    portuguese: "study.language.portuguese",
  };

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
        </div>
        <div className="overview-stats-controls">
          <div className="study-controls">
            <label className="study-language-switcher">
              {t("study.label")}
              <span className="study-language-group">
                {t("study.source")}
                <select
                  value={sourceLanguage}
                  onChange={(event) => setSourceLanguage(event.target.value as StudyLanguageCode)}
                  aria-label={t("study.source")}
                >
                  {supportedLanguages.map((code) => (
                    <option key={code} value={code}>
                      {t(languageKeyByCode[code])}
                    </option>
                  ))}
                </select>
              </span>
              <span className="study-language-group">
                {t("study.target")}
                <select
                  value={targetLanguage}
                  onChange={(event) => setTargetLanguage(event.target.value as StudyLanguageCode)}
                  aria-label={t("study.target")}
                >
                  {supportedLanguages.map((code) => (
                    <option key={code} value={code}>
                      {t(languageKeyByCode[code])}
                    </option>
                  ))}
                </select>
              </span>
            </label>
          </div>
          <div className="ui-controls">
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
        </div>
      </div>
    </header>
  );
}
