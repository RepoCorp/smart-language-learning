import { useEffect, useRef, useState } from "react";

import { getSpeechSynthesisVoiceSelectionOptions } from "../browserSpeech";
import { fetchOverviewStats } from "../api";
import { getOverviewStatsUpdatedEventName } from "../apiCore";
import type { AuthUser } from "../authApi";
import { useDebugTools } from "../debugTools";
import { useI18n } from "../i18n";
import { usePromptPreferences } from "../promptPreferences";
import {
  BROWSER_VOICE_PREVIEW_TEXT_BY_CODE,
  STUDY_LANGUAGE_MESSAGE_KEY_BY_CODE,
  STUDY_LANGUAGE_SPEECH_LOCALE_BY_CODE,
} from "../studyLanguageMetadata";
import { type StudyLanguageCode, useStudyLanguages } from "../studyLanguages";
import type { OverviewStatsResponse } from "../types";
import ConfigurationAccountSection from "./ConfigurationAccountSection";
import ConfigurationAdminUsersSection from "./ConfigurationAdminUsersSection";
import ConfigurationElevenLabsSection from "./ConfigurationElevenLabsSection";

interface ConfigurationsPageProps {
  canCreateUsers?: boolean;
  authUser?: AuthUser | null;
  authBusy?: boolean;
  onLogout?: () => Promise<void>;
}

export default function ConfigurationsPage({
  canCreateUsers = false,
  authUser = null,
  authBusy = false,
  onLogout,
}: ConfigurationsPageProps): JSX.Element {
  const { language, setLanguage, t } = useI18n();
  const { enabled: debugToolsEnabled, setEnabled: setDebugToolsEnabled } = useDebugTools();
  const {
    targetPromptMode,
    setTargetPromptMode,
    showMobileActionLabels,
    setShowMobileActionLabels,
    preferredBrowserVoiceURIByLanguage,
    setPreferredBrowserVoiceURI,
    clearPreferredBrowserVoiceURIs,
  } = usePromptPreferences();
  const { sourceLanguage, targetLanguage, setSourceLanguage, setTargetLanguage, supportedLanguages } = useStudyLanguages();
  const [stats, setStats] = useState<OverviewStatsResponse | null>(null);
  const [browserVoiceOptions, setBrowserVoiceOptions] = useState<SpeechSynthesisVoice[]>([]);
  const [previewingVoiceURI, setPreviewingVoiceURI] = useState("");
  const activePreviewRef = useRef<SpeechSynthesisUtterance | null>(null);
  const loadedBrowserVoiceOptionsByLanguageRef = useRef<Partial<Record<StudyLanguageCode, SpeechSynthesisVoice[]>>>({});

  useEffect(() => {
    let mounted = true;
    const updateEvent = getOverviewStatsUpdatedEventName();

    const loadStats = async (): Promise<void> => {
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

    void loadStats();
    const onStatsUpdated = (): void => {
      void loadStats();
    };
    window.addEventListener(updateEvent, onStatsUpdated);
    return () => {
      mounted = false;
      window.removeEventListener(updateEvent, onStatsUpdated);
    };
  }, [sourceLanguage, targetLanguage]);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") {
      setBrowserVoiceOptions([]);
      return;
    }
    const speechSynthesis = window.speechSynthesis;
    const lang = STUDY_LANGUAGE_SPEECH_LOCALE_BY_CODE[targetLanguage] || "de-DE";
    const storedOptions = loadedBrowserVoiceOptionsByLanguageRef.current[targetLanguage];
    if (storedOptions && storedOptions.length > 0) {
      setBrowserVoiceOptions(storedOptions);
      return;
    }

    const updateVoiceOptions = (): void => {
      if (loadedBrowserVoiceOptionsByLanguageRef.current[targetLanguage]?.length) {
        return;
      }
      const options = getSpeechSynthesisVoiceSelectionOptions(speechSynthesis.getVoices(), lang, "", 3);
      if (options.length === 0) {
        return;
      }
      loadedBrowserVoiceOptionsByLanguageRef.current[targetLanguage] = options;
      setBrowserVoiceOptions(options);
    };

    updateVoiceOptions();
    speechSynthesis.addEventListener("voiceschanged", updateVoiceOptions);
    return () => {
      speechSynthesis.removeEventListener("voiceschanged", updateVoiceOptions);
    };
  }, [targetLanguage]);

  useEffect(() => () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }, []);

  const resetDefaults = (): void => {
    setLanguage("en");
    setSourceLanguage("spanish");
    setTargetLanguage("german");
    setTargetPromptMode("text");
    setShowMobileActionLabels(false);
    clearPreferredBrowserVoiceURIs();
    setDebugToolsEnabled(false);
  };

  const previewBrowserVoice = (voice: SpeechSynthesisVoice): void => {
    if (typeof window === "undefined" || !("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") {
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(BROWSER_VOICE_PREVIEW_TEXT_BY_CODE[targetLanguage] || BROWSER_VOICE_PREVIEW_TEXT_BY_CODE.german);
    utterance.lang = voice.lang || (STUDY_LANGUAGE_SPEECH_LOCALE_BY_CODE[targetLanguage] || "de-DE");
    utterance.voice = voice;
    utterance.rate = 0.95;
    activePreviewRef.current = utterance;
    setPreviewingVoiceURI(voice.voiceURI);
    const finish = (): void => {
      if (activePreviewRef.current === utterance) {
        activePreviewRef.current = null;
      }
      setPreviewingVoiceURI((current) => (current === voice.voiceURI ? "" : current));
    };
    utterance.onend = finish;
    utterance.onerror = finish;
    window.speechSynthesis.speak(utterance);
  };

  return (
    <main className="container">
      <ConfigurationAccountSection authBusy={authBusy} authUser={authUser} onLogout={onLogout} stats={stats} />
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
                  {t(STUDY_LANGUAGE_MESSAGE_KEY_BY_CODE[code])}
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
                  {t(STUDY_LANGUAGE_MESSAGE_KEY_BY_CODE[code])}
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

          <div className="settings-field">
            {t("config.mobileActionLabels")}
            <div className="settings-choice-group" role="radiogroup" aria-label={t("config.mobileActionLabels")}>
              <button
                type="button"
                className={`settings-choice-button ${showMobileActionLabels ? "settings-choice-button-selected" : ""}`}
                onClick={() => setShowMobileActionLabels(true)}
                role="radio"
                aria-checked={showMobileActionLabels}
              >
                {t("config.mobileActionLabelsOn")}
              </button>
              <button
                type="button"
                className={`settings-choice-button ${!showMobileActionLabels ? "settings-choice-button-selected" : ""}`}
                onClick={() => setShowMobileActionLabels(false)}
                role="radio"
                aria-checked={!showMobileActionLabels}
              >
                {t("config.mobileActionLabelsOff")}
              </button>
            </div>
            <span className="hint">{t("config.mobileActionLabelsHint")}</span>
          </div>

          <div className="settings-field">
            {t("config.browserVoice")}
            {browserVoiceOptions.length > 0 ? (
              <div className="browser-voice-list" role="radiogroup" aria-label={t("config.browserVoice")}>
                {browserVoiceOptions.map((voice) => {
                  const selected = (preferredBrowserVoiceURIByLanguage[targetLanguage] || "") === voice.voiceURI;
                  return (
                    <div key={voice.voiceURI} className={`browser-voice-option ${selected ? "browser-voice-option-selected" : ""}`}>
                      <button
                        type="button"
                        className={`browser-voice-select-button ${selected ? "browser-voice-select-button-selected" : ""}`}
                        onClick={() => setPreferredBrowserVoiceURI(targetLanguage, voice.voiceURI)}
                        role="radio"
                        aria-checked={selected}
                      >
                        <span className="browser-voice-option-name">{voice.name}</span>
                        <span className="browser-voice-option-meta">{voice.lang}</span>
                      </button>
                      <button
                        type="button"
                        className="secondary-button browser-voice-preview-button"
                        onClick={() => previewBrowserVoice(voice)}
                        disabled={previewingVoiceURI === voice.voiceURI}
                      >
                        {previewingVoiceURI === voice.voiceURI ? t("config.browserVoicePreviewing") : t("config.browserVoicePreview")}
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <span className="hint">{t("config.browserVoiceUnavailable")}</span>
            )}
            <span className="hint">{t("config.browserVoiceHint", { language: t(STUDY_LANGUAGE_MESSAGE_KEY_BY_CODE[targetLanguage]) })}</span>
          </div>
        </div>

        <div className="actions">
          <button type="button" className="secondary-button" onClick={resetDefaults}>
            {t("config.resetDefaults")}
          </button>
        </div>
      </section>
      <ConfigurationElevenLabsSection
        authUser={authUser}
        languageKeyByCode={STUDY_LANGUAGE_MESSAGE_KEY_BY_CODE}
        previewTextByCode={BROWSER_VOICE_PREVIEW_TEXT_BY_CODE}
        targetLanguage={targetLanguage}
      />
      <ConfigurationAdminUsersSection canCreateUsers={canCreateUsers} />
    </main>
  );
}
