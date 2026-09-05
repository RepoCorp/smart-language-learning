import { useState } from "react";

import type { AuthUser } from "../authApi";
import { useI18n } from "../i18n";
import type { OverviewStatsResponse } from "../types";
import ConfigurationDocumentationSection from "./ConfigurationDocumentationSection";
import ConfigurationLearningStatsSection from "./ConfigurationLearningStatsSection";
import ConfigurationPreferencesSection from "./ConfigurationPreferencesSection";
import ConfigurationTimezoneSection from "./ConfigurationTimezoneSection";
import GuideLibraryModal from "./GuideLibraryModal";

interface ConfigurationsPageProps {
  canCreateUsers?: boolean;
  authUser?: AuthUser | null;
  authBusy?: boolean;
  onLogout?: () => Promise<void>;
  onOpenAdmin?: () => void;
  onStartGuidedSetup: () => void;
  onStartConversationGuide: () => void;
}

export default function ConfigurationsPage({
  canCreateUsers = false,
  authUser = null,
  authBusy = false,
  onLogout,
  onOpenAdmin,
  onStartGuidedSetup,
  onStartConversationGuide,
}: ConfigurationsPageProps): JSX.Element {
  const { t } = useI18n();
  const [stats, setStats] = useState<OverviewStatsResponse | null>(null);
  const [showGuideLibrary, setShowGuideLibrary] = useState(false);

  return (
    <main className="container configuration-page">
      <p className="configuration-current-user">
        {t("config.currentUser")} <strong>{authUser?.email || authUser?.username || t("config.noCurrentUser")}</strong>
      </p>
      <ConfigurationDocumentationSection onOpenGuides={() => setShowGuideLibrary(true)} />
      <ConfigurationLearningStatsSection stats={stats} />
      <ConfigurationPreferencesSection onStatsChange={setStats} />
      <ConfigurationTimezoneSection />
      {canCreateUsers ? (
        <section className="card settings-card">
          <h2 className="settings-title">{t("config.adminTitle")}</h2>
          <p className="settings-subtitle">{t("config.adminEntrySubtitle")}</p>
          <div className="actions">
            <button type="button" className="secondary-button" onClick={onOpenAdmin}>{t("config.openAdmin")}</button>
          </div>
        </section>
      ) : null}
      {onLogout ? (
        <div className="configuration-logout-action">
          <button type="button" className="secondary-button" onClick={() => void onLogout()} disabled={authBusy}>
            {authBusy ? t("config.loggingOut") : t("config.logOut")}
          </button>
        </div>
      ) : null}
      <GuideLibraryModal
        open={showGuideLibrary}
        onClose={() => setShowGuideLibrary(false)}
        onStartBasics={() => {
          setShowGuideLibrary(false);
          onStartGuidedSetup();
        }}
        onStartConversation={() => {
          setShowGuideLibrary(false);
          onStartConversationGuide();
        }}
      />
    </main>
  );
}
