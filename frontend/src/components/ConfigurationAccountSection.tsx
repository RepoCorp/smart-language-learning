import type { AuthUser } from "../authApi";
import type { OverviewStatsResponse } from "../types";
import { useI18n } from "../i18n";

interface ConfigurationAccountSectionProps {
  authBusy?: boolean;
  authUser?: AuthUser | null;
  onLogout?: () => Promise<void>;
  stats: OverviewStatsResponse | null;
}

export default function ConfigurationAccountSection({
  authBusy = false,
  authUser = null,
  onLogout,
  stats,
}: ConfigurationAccountSectionProps): JSX.Element {
  const { t } = useI18n();

  return (
    <section className="card settings-card">
      <h2 className="settings-title">{t("config.accountTitle")}</h2>
      <div className="settings-grid">
        <div className="settings-field">
          {t("config.currentUser")}
          <strong>{authUser?.email || authUser?.username || t("config.noCurrentUser")}</strong>
        </div>
        <div className="settings-field">
          {t("config.learningStatsTitle")}
          <div className="settings-stats-list">
            <div className="settings-stat-group">
              <strong>{t("config.savedMaterialTitle")}</strong>
              <span>{t("stats.savedItems", {
                words: stats?.saved_word_items ?? "-",
                phrases: stats?.saved_phrase_items ?? "-",
              })}</span>
              <span>{t("stats.notStarted", { count: stats?.not_started ?? "-" })}</span>
            </div>
            <div className="settings-stat-group">
              <strong>{t("config.reviewQueueTitle")}</strong>
              <span>{t("stats.futureBothDirections", { count: stats?.future_reviews ?? "-" })}</span>
            </div>
          </div>
        </div>
      </div>
      <div className="actions configuration-account-actions">
        {onLogout ? (
          <button type="button" className="secondary-button" onClick={() => void onLogout()} disabled={authBusy}>
            {authBusy ? t("config.loggingOut") : t("config.logOut")}
          </button>
        ) : null}
      </div>
    </section>
  );
}
