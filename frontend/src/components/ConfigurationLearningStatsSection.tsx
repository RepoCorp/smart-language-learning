import { useI18n } from "../i18n";
import type { OverviewStatsResponse } from "../types";

export default function ConfigurationLearningStatsSection({ stats }: { stats: OverviewStatsResponse | null }): JSX.Element {
  const { t } = useI18n();

  return (
    <section className="card settings-card">
      <h2 className="settings-title">{t("config.learningStatsTitle")}</h2>
      <div className="settings-stats-list configuration-learning-stats-list">
        <div className="settings-stat-group">
          <strong>{t("config.savedMaterialTitle")}</strong>
          <span>{t("stats.savedItems", { words: stats?.saved_word_items ?? "-", phrases: stats?.saved_phrase_items ?? "-" })}</span>
          <span>{t("stats.notStarted", { count: stats?.not_started ?? "-" })}</span>
        </div>
        <div className="settings-stat-group">
          <strong>{t("config.reviewQueueTitle")}</strong>
          <span>{t("stats.futureBothDirections", { count: stats?.future_reviews ?? "-" })}</span>
        </div>
      </div>
    </section>
  );
}
