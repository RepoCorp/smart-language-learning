import { useState } from "react";

import type { AuthUser } from "../authApi";
import { useI18n } from "../i18n";
import type { OverviewStatsResponse } from "../types";
import ConfigurationAccountSection from "./ConfigurationAccountSection";
import ConfigurationPreferencesSection from "./ConfigurationPreferencesSection";
import GettingStartedGuideModal from "./GettingStartedGuideModal";

interface ConfigurationsPageProps {
  canCreateUsers?: boolean;
  authUser?: AuthUser | null;
  authBusy?: boolean;
  onLogout?: () => Promise<void>;
  onOpenAdmin?: () => void;
}

export default function ConfigurationsPage({
  canCreateUsers = false,
  authUser = null,
  authBusy = false,
  onLogout,
  onOpenAdmin,
}: ConfigurationsPageProps): JSX.Element {
  const { t } = useI18n();
  const [stats, setStats] = useState<OverviewStatsResponse | null>(null);
  const [showGettingStarted, setShowGettingStarted] = useState(false);

  return (
    <main className="container">
      <button
        type="button"
        className="getting-started-open-button"
        onClick={() => setShowGettingStarted(true)}
      >
        {t("config.gettingStartedOpen")}
      </button>
      <ConfigurationAccountSection authBusy={authBusy} authUser={authUser} onLogout={onLogout} stats={stats} />
      <ConfigurationPreferencesSection onStatsChange={setStats} />
      {canCreateUsers ? (
        <section className="card settings-card">
          <h2 className="settings-title">{t("config.adminTitle")}</h2>
          <p className="settings-subtitle">{t("config.adminEntrySubtitle")}</p>
          <div className="actions">
            <button type="button" className="secondary-button" onClick={onOpenAdmin}>{t("config.openAdmin")}</button>
          </div>
        </section>
      ) : null}
      <GettingStartedGuideModal open={showGettingStarted} onClose={() => setShowGettingStarted(false)} />
    </main>
  );
}
