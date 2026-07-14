import { useEffect, useRef, useState } from "react";

import {
  fetchElevenLabsVoices,
  previewElevenLabsVoice,
  updateElevenLabsVoiceDisabledState,
} from "../api";
import type { AuthUser } from "../authApi";
import { useI18n } from "../i18n";
import { type StudyLanguageCode } from "../studyLanguages";
import type { ElevenLabsVoiceRecord } from "../types";

interface ConfigurationElevenLabsSectionProps {
  authUser?: AuthUser | null;
  languageKeyByCode: Record<StudyLanguageCode, string>;
  previewTextByCode: Record<StudyLanguageCode, string>;
  targetLanguage: StudyLanguageCode;
}

export default function ConfigurationElevenLabsSection({
  authUser = null,
  languageKeyByCode,
  previewTextByCode,
  targetLanguage,
}: ConfigurationElevenLabsSectionProps): JSX.Element | null {
  const { t } = useI18n();
  const [voices, setVoices] = useState<ElevenLabsVoiceRecord[]>([]);
  const [previewText, setPreviewText] = useState("");
  const [loadingVoices, setLoadingVoices] = useState(false);
  const [error, setError] = useState("");
  const [previewingVoiceId, setPreviewingVoiceId] = useState("");
  const [updatingVoiceId, setUpdatingVoiceId] = useState("");
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => () => {
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!authUser?.is_superuser) {
      setVoices([]);
      setError("");
      return;
    }
    let mounted = true;
    setLoadingVoices(true);
    setError("");
    void fetchElevenLabsVoices(targetLanguage)
      .then((payload) => {
        if (!mounted) {
          return;
        }
        setVoices(payload.voices);
        setPreviewText((current) => current.trim() || payload.preview_text || "");
      })
      .catch((loadError) => {
        if (!mounted) {
          return;
        }
        setError(loadError instanceof Error ? loadError.message : "Failed to load ElevenLabs voices");
      })
      .finally(() => {
        if (mounted) {
          setLoadingVoices(false);
        }
      });
    return () => {
      mounted = false;
    };
  }, [authUser?.is_superuser, targetLanguage]);

  if (!authUser?.is_superuser) {
    return null;
  }

  const handlePreviewVoice = async (voice: ElevenLabsVoiceRecord): Promise<void> => {
    setError("");
    setPreviewingVoiceId(voice.voice_id);
    try {
      const payload = await previewElevenLabsVoice(
        voice.voice_id,
        previewText.trim() || previewTextByCode[targetLanguage] || previewTextByCode.german,
        targetLanguage,
      );
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
      }
      const audio = new Audio(payload.audio_url);
      previewAudioRef.current = audio;
      audio.onended = () => {
        setPreviewingVoiceId((current) => (current === voice.voice_id ? "" : current));
      };
      audio.onerror = () => {
        setPreviewingVoiceId((current) => (current === voice.voice_id ? "" : current));
        setError(t("config.elevenLabsPreviewError"));
      };
      await audio.play();
    } catch (previewError) {
      setError(previewError instanceof Error ? previewError.message : t("config.elevenLabsPreviewError"));
      setPreviewingVoiceId("");
    }
  };

  const handleToggleVoice = async (voice: ElevenLabsVoiceRecord): Promise<void> => {
    setError("");
    setUpdatingVoiceId(voice.voice_id);
    try {
      await updateElevenLabsVoiceDisabledState(voice.voice_id, voice.name, !voice.disabled);
      setVoices((current) => current.map((entry) => (
        entry.voice_id === voice.voice_id ? { ...entry, disabled: !entry.disabled } : entry
      )));
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : t("config.elevenLabsUpdateError"));
    } finally {
      setUpdatingVoiceId("");
    }
  };

  return (
    <section className="card settings-card">
      <h2 className="settings-title">{t("config.elevenLabsTitle")}</h2>
      <p className="settings-subtitle">{t("config.elevenLabsSubtitle", { language: t(languageKeyByCode[targetLanguage]) })}</p>
      <label className="settings-field">
        {t("config.elevenLabsPreviewText")}
        <input
          type="text"
          value={previewText}
          onChange={(event) => setPreviewText(event.target.value)}
          placeholder={previewTextByCode[targetLanguage] || previewTextByCode.german}
        />
      </label>
      {loadingVoices ? <p className="hint">{t("config.elevenLabsLoading")}</p> : null}
      {error ? <p className="error">{error}</p> : null}
      {!loadingVoices && voices.length > 0 ? (
        <div className="elevenlabs-voice-list">
          {voices.map((voice) => (
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
                  onClick={() => void handlePreviewVoice(voice)}
                  disabled={previewingVoiceId === voice.voice_id}
                >
                  {previewingVoiceId === voice.voice_id ? t("config.elevenLabsPreviewing") : t("config.elevenLabsPreview")}
                </button>
                <button
                  type="button"
                  className={voice.disabled ? "secondary-button" : ""}
                  onClick={() => void handleToggleVoice(voice)}
                  disabled={updatingVoiceId === voice.voice_id}
                >
                  {updatingVoiceId === voice.voice_id
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
      {!loadingVoices && !error && voices.length === 0 ? (
        <p className="hint">{t("config.elevenLabsEmpty")}</p>
      ) : null}
    </section>
  );
}
