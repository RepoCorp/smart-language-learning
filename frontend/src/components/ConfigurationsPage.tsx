import { FormEvent, useEffect, useRef, useState } from "react";

import { getSpeechSynthesisVoiceSelectionOptions } from "../browserSpeech";
import {
  createUserWithPin,
  fetchElevenLabsVoices,
  fetchOverviewStats,
  getOverviewStatsUpdatedEventName,
  previewElevenLabsVoice,
  resetUserPin,
  updateElevenLabsVoiceDisabledState,
  type AuthUser,
} from "../api";
import { useDebugTools } from "../debugTools";
import { useI18n } from "../i18n";
import { usePromptPreferences } from "../promptPreferences";
import { type StudyLanguageCode, useStudyLanguages } from "../studyLanguages";
import type { ElevenLabsVoiceRecord, OverviewStatsResponse } from "../types";

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
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [pin, setPin] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createSuccess, setCreateSuccess] = useState("");
  const [resetIdentifier, setResetIdentifier] = useState("");
  const [resetPin, setResetPin] = useState("");
  const [resettingPin, setResettingPin] = useState(false);
  const [resetPinError, setResetPinError] = useState("");
  const [resetPinSuccess, setResetPinSuccess] = useState("");
  const [browserVoiceOptions, setBrowserVoiceOptions] = useState<SpeechSynthesisVoice[]>([]);
  const [previewingVoiceURI, setPreviewingVoiceURI] = useState<string>("");
  const activePreviewRef = useRef<SpeechSynthesisUtterance | null>(null);
  const loadedBrowserVoiceOptionsByLanguageRef = useRef<Partial<Record<StudyLanguageCode, SpeechSynthesisVoice[]>>>({});
  const [elevenLabsVoices, setElevenLabsVoices] = useState<ElevenLabsVoiceRecord[]>([]);
  const [elevenLabsPreviewText, setElevenLabsPreviewText] = useState("");
  const [loadingElevenLabsVoices, setLoadingElevenLabsVoices] = useState(false);
  const [elevenLabsError, setElevenLabsError] = useState("");
  const [previewingElevenLabsVoiceId, setPreviewingElevenLabsVoiceId] = useState("");
  const [updatingElevenLabsVoiceId, setUpdatingElevenLabsVoiceId] = useState("");
  const elevenLabsPreviewAudioRef = useRef<HTMLAudioElement | null>(null);
  const languageKeyByCode: Record<StudyLanguageCode, Parameters<typeof t>[0]> = {
    spanish: "study.language.spanish",
    english: "study.language.english",
    german: "study.language.german",
    french: "study.language.french",
    italian: "study.language.italian",
    portuguese: "study.language.portuguese",
  };
  const speechLangByCode: Record<StudyLanguageCode, string> = {
    spanish: "es-ES",
    english: "en-US",
    german: "de-DE",
    french: "fr-FR",
    italian: "it-IT",
    portuguese: "pt-PT",
  };
  const browserVoicePreviewTextByCode: Record<StudyLanguageCode, string> = {
    spanish: "Hola. Esta es una prueba de voz.",
    english: "Hello. This is a voice preview.",
    german: "Hallo. Das ist eine Stimmprobe.",
    french: "Bonjour. Ceci est un apercu de la voix.",
    italian: "Ciao. Questa e una prova della voce.",
    portuguese: "Ola. Esta e uma demonstracao de voz.",
  };

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
    const lang = speechLangByCode[targetLanguage] || "de-DE";

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

  useEffect(() => () => {
    if (elevenLabsPreviewAudioRef.current) {
      elevenLabsPreviewAudioRef.current.pause();
      elevenLabsPreviewAudioRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!authUser?.is_superuser) {
      setElevenLabsVoices([]);
      setElevenLabsError("");
      return;
    }
    let mounted = true;
    setLoadingElevenLabsVoices(true);
    setElevenLabsError("");
    void fetchElevenLabsVoices(targetLanguage)
      .then((payload) => {
        if (!mounted) {
          return;
        }
        setElevenLabsVoices(payload.voices);
        setElevenLabsPreviewText((current) => current.trim() || payload.preview_text || "");
      })
      .catch((error) => {
        if (!mounted) {
          return;
        }
        setElevenLabsError(error instanceof Error ? error.message : "Failed to load ElevenLabs voices");
      })
      .finally(() => {
        if (mounted) {
          setLoadingElevenLabsVoices(false);
        }
      });
    return () => {
      mounted = false;
    };
  }, [authUser?.is_superuser, targetLanguage]);

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
    const utterance = new SpeechSynthesisUtterance(browserVoicePreviewTextByCode[targetLanguage] || browserVoicePreviewTextByCode.german);
    utterance.lang = voice.lang || (speechLangByCode[targetLanguage] || "de-DE");
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

  const handlePreviewElevenLabsVoice = async (voice: ElevenLabsVoiceRecord): Promise<void> => {
    setElevenLabsError("");
    setPreviewingElevenLabsVoiceId(voice.voice_id);
    try {
      const payload = await previewElevenLabsVoice(
        voice.voice_id,
        elevenLabsPreviewText.trim() || browserVoicePreviewTextByCode[targetLanguage] || browserVoicePreviewTextByCode.german,
        targetLanguage,
      );
      if (elevenLabsPreviewAudioRef.current) {
        elevenLabsPreviewAudioRef.current.pause();
      }
      const audio = new Audio(payload.audio_url);
      elevenLabsPreviewAudioRef.current = audio;
      audio.onended = () => {
        setPreviewingElevenLabsVoiceId((current) => (current === voice.voice_id ? "" : current));
      };
      audio.onerror = () => {
        setPreviewingElevenLabsVoiceId((current) => (current === voice.voice_id ? "" : current));
        setElevenLabsError(t("config.elevenLabsPreviewError"));
      };
      await audio.play();
    } catch (error) {
      setElevenLabsError(error instanceof Error ? error.message : t("config.elevenLabsPreviewError"));
      setPreviewingElevenLabsVoiceId("");
    }
  };

  const handleToggleElevenLabsVoice = async (voice: ElevenLabsVoiceRecord): Promise<void> => {
    setElevenLabsError("");
    setUpdatingElevenLabsVoiceId(voice.voice_id);
    try {
      await updateElevenLabsVoiceDisabledState(voice.voice_id, voice.name, !voice.disabled);
      setElevenLabsVoices((current) => current.map((entry) => (
        entry.voice_id === voice.voice_id ? { ...entry, disabled: !entry.disabled } : entry
      )));
    } catch (error) {
      setElevenLabsError(error instanceof Error ? error.message : t("config.elevenLabsUpdateError"));
    } finally {
      setUpdatingElevenLabsVoiceId("");
    }
  };

  const handleResetPin = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setResetPinError("");
    setResetPinSuccess("");
    setResettingPin(true);
    try {
      const user = await resetUserPin(resetIdentifier, resetPin);
      setResetPinSuccess(t("config.resetPinSuccess", { username: user.username }));
      setResetIdentifier("");
      setResetPin("");
    } catch (error) {
      const message = error instanceof Error ? error.message : t("config.resetPinFailed");
      setResetPinError(message);
    } finally {
      setResettingPin(false);
    }
  };

  return (
    <main className="container">
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
            <span className="hint">{t("config.browserVoiceHint", { language: t(languageKeyByCode[targetLanguage]) })}</span>
          </div>
        </div>

        <div className="actions">
          <button type="button" className="secondary-button" onClick={resetDefaults}>
            {t("config.resetDefaults")}
          </button>
        </div>
      </section>
      {authUser?.is_superuser ? (
        <section className="card settings-card">
          <h2 className="settings-title">{t("config.elevenLabsTitle")}</h2>
          <p className="settings-subtitle">{t("config.elevenLabsSubtitle", { language: t(languageKeyByCode[targetLanguage]) })}</p>
          <label className="settings-field">
            {t("config.elevenLabsPreviewText")}
            <input
              type="text"
              value={elevenLabsPreviewText}
              onChange={(event) => setElevenLabsPreviewText(event.target.value)}
              placeholder={browserVoicePreviewTextByCode[targetLanguage] || browserVoicePreviewTextByCode.german}
            />
          </label>
          {loadingElevenLabsVoices ? <p className="hint">{t("config.elevenLabsLoading")}</p> : null}
          {elevenLabsError ? <p className="error">{elevenLabsError}</p> : null}
          {!loadingElevenLabsVoices && elevenLabsVoices.length > 0 ? (
            <div className="elevenlabs-voice-list">
              {elevenLabsVoices.map((voice) => (
                <div
                  key={voice.voice_id}
                  className={`elevenlabs-voice-row ${voice.disabled ? "elevenlabs-voice-row-disabled" : ""}`}
                >
                  <div className="elevenlabs-voice-main">
                    <strong>{voice.name}</strong>
                    {voice.category ? <span className="hint">{voice.category}</span> : null}
                    <code className="elevenlabs-voice-id">{voice.voice_id}</code>
                  </div>
                  <div className="elevenlabs-voice-actions">
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => void handlePreviewElevenLabsVoice(voice)}
                      disabled={previewingElevenLabsVoiceId === voice.voice_id}
                    >
                      {previewingElevenLabsVoiceId === voice.voice_id
                        ? t("config.elevenLabsPreviewing")
                        : t("config.elevenLabsPreview")}
                    </button>
                    <button
                      type="button"
                      className={voice.disabled ? "secondary-button" : ""}
                      onClick={() => void handleToggleElevenLabsVoice(voice)}
                      disabled={updatingElevenLabsVoiceId === voice.voice_id}
                    >
                      {updatingElevenLabsVoiceId === voice.voice_id
                        ? t("config.elevenLabsSaving")
                        : voice.disabled
                          ? t("config.elevenLabsEnable")
                          : t("config.elevenLabsDisable")}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
          {!loadingElevenLabsVoices && !elevenLabsError && elevenLabsVoices.length === 0 ? (
            <p className="hint">{t("config.elevenLabsEmpty")}</p>
          ) : null}
        </section>
      ) : null}
      {canCreateUsers ? (
        <>
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
          <section className="card settings-card">
            <h2 className="settings-title">{t("config.resetPinTitle")}</h2>
            <p className="settings-subtitle">{t("config.resetPinSubtitle")}</p>
            <form className="settings-create-user-form" onSubmit={handleResetPin}>
              <label className="settings-field">
                {t("config.userIdentifier")}
                <input
                  type="text"
                  value={resetIdentifier}
                  onChange={(event) => setResetIdentifier(event.target.value)}
                  autoComplete="username"
                  required
                />
              </label>
              <label className="settings-field">
                {t("config.newPin")}
                <input
                  type="password"
                  value={resetPin}
                  onChange={(event) => setResetPin(event.target.value)}
                  autoComplete="new-password"
                  required
                />
              </label>
              <div className="actions">
                <button type="submit" disabled={resettingPin}>
                  {resettingPin ? t("config.resettingPin") : t("config.resetPin")}
                </button>
              </div>
              {resetPinError ? <p className="error">{resetPinError}</p> : null}
              {resetPinSuccess ? <p className="hint">{resetPinSuccess}</p> : null}
            </form>
          </section>
        </>
      ) : null}
    </main>
  );
}
