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
          {t("config.accountTitle")}
          <div className="settings-stats-list">
            <span>{t("stats.future", { count: stats?.future_reviews ?? "-" })}</span>
            <span>{t("stats.words", { count: stats?.word_items ?? "-" })}</span>
          </div>
        </div>
      </div>
      {onLogout ? (
        <div className="actions">
          <button type="button" className="secondary-button" onClick={() => void onLogout()} disabled={authBusy}>
            {authBusy ? t("config.loggingOut") : t("config.logOut")}
          </button>
        </div>
      ) : null}
    </section>
  );
}
