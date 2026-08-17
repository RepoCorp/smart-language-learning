import { useState } from "react";

import type { AuthUser } from "../authApi";
import { useI18n } from "../i18n";
import type { OverviewStatsResponse } from "../types";
import ConfigurationAccountSection from "./ConfigurationAccountSection";
import ConfigurationPreferencesSection from "./ConfigurationPreferencesSection";

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

  return (
    <main className="container">
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
    </main>
  );
}
