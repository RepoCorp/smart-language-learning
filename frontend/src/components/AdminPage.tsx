import ConfigurationAdminUsersSection from "./ConfigurationAdminUsersSection";
import ConfigurationElevenLabsSection from "./ConfigurationElevenLabsSection";
import ConfigurationGrammarPoolSection from "./ConfigurationGrammarPoolSection";
import type { AuthUser } from "../authApi";
import { useDebugTools } from "../debugTools";
import { useI18n } from "../i18n";
import {
  BROWSER_VOICE_PREVIEW_TEXT_BY_CODE,
  STUDY_LANGUAGE_MESSAGE_KEY_BY_CODE,
} from "../studyLanguageMetadata";
import { useStudyLanguages } from "../studyLanguages";

interface AdminPageProps {
  authUser: AuthUser;
}

export default function AdminPage({ authUser }: AdminPageProps): JSX.Element {
  const { t } = useI18n();
  const { enabled: debugToolsEnabled, setEnabled: setDebugToolsEnabled } = useDebugTools();
  const { sourceLanguage, targetLanguage } = useStudyLanguages();

  return (
    <main className="container">
      <section className="card settings-card">
        <h2 className="settings-title">{t("config.adminTitle")}</h2>
        <p className="settings-subtitle">{t("config.adminSubtitle")}</p>
      </section>
      <ConfigurationAdminUsersSection canCreateUsers />
      <section className="card settings-card">
        <h2 className="settings-title">{t("config.debugTools")}</h2>
        <div className="settings-field">
          <div className="settings-choice-group" role="radiogroup" aria-label={t("config.debugTools")}>
            <button type="button" className={`settings-choice-button ${debugToolsEnabled ? "settings-choice-button-selected" : ""}`} onClick={() => setDebugToolsEnabled(true)} role="radio" aria-checked={debugToolsEnabled}>{t("config.debugToolsOn")}</button>
            <button type="button" className={`settings-choice-button ${!debugToolsEnabled ? "settings-choice-button-selected" : ""}`} onClick={() => setDebugToolsEnabled(false)} role="radio" aria-checked={!debugToolsEnabled}>{t("config.debugToolsOff")}</button>
          </div>
          <span className="hint">{t("config.debugToolsHint")}</span>
        </div>
      </section>
      <ConfigurationGrammarPoolSection canManage sourceLanguage={sourceLanguage} targetLanguage={targetLanguage} />
      <ConfigurationElevenLabsSection
        authUser={authUser}
        languageKeyByCode={STUDY_LANGUAGE_MESSAGE_KEY_BY_CODE}
        previewTextByCode={BROWSER_VOICE_PREVIEW_TEXT_BY_CODE}
        targetLanguage={targetLanguage}
      />
    </main>
  );
}
