import { useState } from "react";

import type { AuthUser } from "../authApi";
import type { OverviewStatsResponse } from "../types";
import { useI18n } from "../i18n";
import GettingStartedGuideModal from "./GettingStartedGuideModal";

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
  const [showGettingStarted, setShowGettingStarted] = useState(false);

  return (
    <>
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
        <div className="actions configuration-account-actions">
          <button type="button" className="secondary-button" onClick={() => setShowGettingStarted(true)}>
            {t("config.gettingStartedOpen")}
          </button>
          {onLogout ? (
            <button type="button" className="secondary-button" onClick={() => void onLogout()} disabled={authBusy}>
              {authBusy ? t("config.loggingOut") : t("config.logOut")}
            </button>
          ) : null}
        </div>
      </section>
      <GettingStartedGuideModal open={showGettingStarted} onClose={() => setShowGettingStarted(false)} />
    </>
  );
}
