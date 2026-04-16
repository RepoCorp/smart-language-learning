import { useEffect, useRef, useState } from "react";

import { fetchContentDialogs } from "../api";
import { useI18n } from "../i18n";
import { useStudyLanguages } from "../studyLanguages";
import type { ContentDialogRecord } from "../types";

export default function DialogsPage(): JSX.Element {
  const { t } = useI18n();
  const { sourceLanguage, targetLanguage } = useStudyLanguages();
  const [dialogs, setDialogs] = useState<ContentDialogRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const [playingAll, setPlayingAll] = useState<boolean>(false);
  const [playingDialogId, setPlayingDialogId] = useState<number | null>(null);
  const playbackRunRef = useRef<number>(0);
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);

  const stopCurrentPlayback = (): void => {
    playbackRunRef.current += 1;
    if (activeAudioRef.current) {
      activeAudioRef.current.pause();
      activeAudioRef.current.currentTime = 0;
      activeAudioRef.current = null;
    }
    setPlayingAll(false);
    setPlayingDialogId(null);
  };

  useEffect(() => {
    let active = true;
    const load = async (): Promise<void> => {
      setLoading(true);
      setError("");
      stopCurrentPlayback();
      try {
        const payload = await fetchContentDialogs(sourceLanguage, targetLanguage);
        if (!active) {
          return;
        }
        setDialogs(payload.dialogs || []);
      } catch {
        if (active) {
          setDialogs([]);
          setError(t("dialogs.error.load"));
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };
    void load();
    return () => {
      active = false;
      stopCurrentPlayback();
    };
  }, [sourceLanguage, targetLanguage]);

  const playAudioUrl = (audioUrl: string, runId: number): Promise<void> =>
    new Promise((resolve) => {
      if (!audioUrl || runId !== playbackRunRef.current) {
        resolve();
        return;
      }

      const audio = new Audio(audioUrl);
      activeAudioRef.current = audio;
      const done = (): void => {
        audio.removeEventListener("ended", done);
        audio.removeEventListener("error", done);
        if (activeAudioRef.current === audio) {
          activeAudioRef.current = null;
        }
        resolve();
      };
      audio.addEventListener("ended", done);
      audio.addEventListener("error", done);
      void audio.play().catch(() => done());
    });

  const playAllDialogs = async (): Promise<void> => {
    const playableDialogs = dialogs.filter((dialog) => dialog.audio_url);
    if (!playableDialogs.length) {
      return;
    }
    stopCurrentPlayback();
    playbackRunRef.current += 1;
    const runId = playbackRunRef.current;
    setPlayingAll(true);

    for (const dialog of playableDialogs) {
      if (runId !== playbackRunRef.current) {
        break;
      }
      setPlayingDialogId(dialog.dialog_id);
      await playAudioUrl(dialog.audio_url, runId);
    }

    if (runId === playbackRunRef.current) {
      setPlayingAll(false);
      setPlayingDialogId(null);
    }
  };

  return (
    <main className="container" data-testid="dialogs-page">
      <h1>{t("dialogs.title")}</h1>
      <p>{t("dialogs.description")}</p>
      <section className="card">
        <div className="actions">
          {!playingAll ? (
            <button type="button" onClick={() => void playAllDialogs()} disabled={loading || dialogs.length === 0}>
              {t("dialogs.playAll")}
            </button>
          ) : (
            <button type="button" className="secondary-button" onClick={stopCurrentPlayback}>
              {t("dialogs.stopAll")}
            </button>
          )}
        </div>
      </section>
      {loading && <p className="hint">{t("dialogs.loading")}</p>}
      {error && <p className="error">{error}</p>}
      {!loading && !error && dialogs.length === 0 && <p className="hint">{t("dialogs.empty")}</p>}
      {!loading && dialogs.length > 0 && (
        <section className="card">
          <ul className="conversation-preview-list">
            {dialogs.map((dialog) => (
              <li key={dialog.dialog_id} className="manage-row manage-item-row">
                <div className="manage-item-main">
                  <div className="manage-item-text">
                    <strong>{dialog.topic}</strong>
                    {dialog.context ? (
                      <span className="manage-item-meta">{dialog.context}</span>
                    ) : (
                      <span className="manage-item-meta">{t("dialogs.noContext")}</span>
                    )}
                    {playingAll && playingDialogId === dialog.dialog_id && (
                      <span className="manage-item-meta">{t("dialogs.nowPlaying")}</span>
                    )}
                  </div>
                </div>
                {dialog.audio_url ? (
                  <audio controls src={dialog.audio_url} preload="none" />
                ) : (
                  <span className="manage-item-meta">{t("dialogs.noAudio")}</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
