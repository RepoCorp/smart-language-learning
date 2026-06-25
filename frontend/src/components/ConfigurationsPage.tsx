import { FormEvent, useState } from "react";

import { createUserWithPin } from "../api";
import { useDebugTools } from "../debugTools";
import { useI18n } from "../i18n";
import { usePromptPreferences } from "../promptPreferences";
import { type StudyLanguageCode, useStudyLanguages } from "../studyLanguages";

interface ConfigurationsPageProps {
  canCreateUsers?: boolean;
}

export default function ConfigurationsPage({ canCreateUsers = false }: ConfigurationsPageProps): JSX.Element {
  const { language, setLanguage, t } = useI18n();
  const { enabled: debugToolsEnabled, setEnabled: setDebugToolsEnabled } = useDebugTools();
  const { targetPromptMode, setTargetPromptMode } = usePromptPreferences();
  const { sourceLanguage, targetLanguage, setSourceLanguage, setTargetLanguage, supportedLanguages } = useStudyLanguages();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [pin, setPin] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createSuccess, setCreateSuccess] = useState("");
  const languageKeyByCode: Record<StudyLanguageCode, Parameters<typeof t>[0]> = {
    spanish: "study.language.spanish",
    english: "study.language.english",
    german: "study.language.german",
    french: "study.language.french",
    italian: "study.language.italian",
    portuguese: "study.language.portuguese",
  };

  const resetDefaults = (): void => {
    setLanguage("en");
    setSourceLanguage("spanish");
    setTargetLanguage("german");
    setTargetPromptMode("text");
    setDebugToolsEnabled(false);
  };

  const handleCreateUser = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setCreateError("");
    setCreateSuccess("");
    setCreating(true);
    try {
      const user = await createUserWithPin(username, email, pin);
      setCreateSuccess(t("config.userCreated", { username: user.username }));
      setUsername("");
      setEmail("");
      setPin("");
    } catch (error) {
      const message = error instanceof Error ? error.message : t("config.createUserFailed");
      setCreateError(message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <main className="container">
      <section className="card settings-card">
        <h2 className="settings-title">{t("config.title")}</h2>
        <p className="settings-subtitle">{t("config.subtitle")}</p>

        <div className="settings-grid">
          <label className="settings-field">
            {t("config.appLanguage")}
            <select value={language} onChange={(event) => setLanguage(event.target.value === "es" ? "es" : "en")}>
              <option value="en">{t("lang.english")}</option>
              <option value="es">{t("lang.spanish")}</option>
            </select>
          </label>

          <label className="settings-field">
            {t("config.studySourceLanguage")}
            <select
              value={sourceLanguage}
              onChange={(event) => setSourceLanguage(event.target.value as StudyLanguageCode)}
              aria-label={t("config.studySourceLanguage")}
            >
              {supportedLanguages.map((code) => (
                <option key={code} value={code}>
                  {t(languageKeyByCode[code])}
                </option>
              ))}
            </select>
          </label>

          <label className="settings-field">
            {t("config.studyTargetLanguage")}
            <select
              value={targetLanguage}
              onChange={(event) => setTargetLanguage(event.target.value as StudyLanguageCode)}
              aria-label={t("config.studyTargetLanguage")}
            >
              {supportedLanguages.map((code) => (
                <option key={code} value={code}>
                  {t(languageKeyByCode[code])}
                </option>
              ))}
            </select>
          </label>

          <div className="settings-field">
            {t("config.targetPromptMode")}
            <div className="settings-choice-group" role="radiogroup" aria-label={t("config.targetPromptMode")}>
              <button
                type="button"
                className={`settings-choice-button ${targetPromptMode === "text" ? "settings-choice-button-selected" : ""}`}
                onClick={() => setTargetPromptMode("text")}
                role="radio"
                aria-checked={targetPromptMode === "text"}
              >
                {t("config.targetPromptModeText")}
              </button>
              <button
                type="button"
                className={`settings-choice-button ${targetPromptMode === "audio" ? "settings-choice-button-selected" : ""}`}
                onClick={() => setTargetPromptMode("audio")}
                role="radio"
                aria-checked={targetPromptMode === "audio"}
              >
                {t("config.targetPromptModeAudio")}
              </button>
            </div>
          </div>

          <div className="settings-field">
            {t("config.debugTools")}
            <div className="settings-choice-group" role="radiogroup" aria-label={t("config.debugTools")}>
              <button
                type="button"
                className={`settings-choice-button ${debugToolsEnabled ? "settings-choice-button-selected" : ""}`}
                onClick={() => setDebugToolsEnabled(true)}
                role="radio"
                aria-checked={debugToolsEnabled}
              >
                {t("config.debugToolsOn")}
              </button>
              <button
                type="button"
                className={`settings-choice-button ${!debugToolsEnabled ? "settings-choice-button-selected" : ""}`}
                onClick={() => setDebugToolsEnabled(false)}
                role="radio"
                aria-checked={!debugToolsEnabled}
              >
                {t("config.debugToolsOff")}
              </button>
            </div>
            <span className="hint">{t("config.debugToolsHint")}</span>
          </div>
        </div>

        <div className="actions">
          <button type="button" className="secondary-button" onClick={resetDefaults}>
            {t("config.resetDefaults")}
          </button>
        </div>
      </section>
      {canCreateUsers ? (
        <section className="card settings-card">
          <h2 className="settings-title">{t("config.createUserTitle")}</h2>
          <p className="settings-subtitle">{t("config.createUserSubtitle")}</p>
          <form className="settings-create-user-form" onSubmit={handleCreateUser}>
            <label className="settings-field">
              {t("config.username")}
              <input
                type="text"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="username"
                required
              />
            </label>
            <label className="settings-field">
              {t("config.email")}
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                required
              />
            </label>
            <label className="settings-field">
              {t("config.pin")}
              <input
                type="password"
                value={pin}
                onChange={(event) => setPin(event.target.value)}
                autoComplete="new-password"
                required
              />
            </label>
            <div className="actions">
              <button type="submit" disabled={creating}>
                {creating ? t("config.creatingUser") : t("config.createUser")}
              </button>
            </div>
            {createError ? <p className="error">{createError}</p> : null}
            {createSuccess ? <p className="hint">{createSuccess}</p> : null}
          </form>
        </section>
      ) : null}
    </main>
  );
}
