import { useEffect, useRef, useState } from "react";

import { fetchContentDialogs, quickAddWordFromDialog } from "../api";
import { useI18n } from "../i18n";
import { useStudyLanguages } from "../studyLanguages";
import type { ContentDialogRecord } from "../types";

type WordActionStatus = "idle" | "saving" | "added" | "exists" | "error";

type PendingWordAdd = {
  key: string;
  source: string;
  target: string;
  dialogId: number;
  turnIndex: number;
  sourceLine: string;
  targetLine: string;
  clickedTargetToken: string;
};

export default function DialogsPage(): JSX.Element {
  const { t } = useI18n();
  const { sourceLanguage, targetLanguage } = useStudyLanguages();
  const [dialogs, setDialogs] = useState<ContentDialogRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const [playingAll, setPlayingAll] = useState<boolean>(false);
  const [playingDialogId, setPlayingDialogId] = useState<number | null>(null);
  const [expandedDialogId, setExpandedDialogId] = useState<number | null>(null);
  const [wordActionStatus, setWordActionStatus] = useState<Record<string, WordActionStatus>>({});
  const [pendingWordAdd, setPendingWordAdd] = useState<PendingWordAdd | null>(null);
  const [addingWord, setAddingWord] = useState<boolean>(false);
  const playbackRunRef = useRef<number>(0);
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);
  const dialogRefs = useRef<Map<number, HTMLLIElement>>(new Map());
  const cleanToken = (value: string): string => value.replace(/^[^A-Za-zÀ-ÖØ-öø-ÿ]+|[^A-Za-zÀ-ÖØ-öø-ÿ]+$/g, "").trim();
  const lineTokens = (line: string): string[] => line.split(/\s+/).filter((part) => part.trim().length > 0);
  const speakerForTurn = (speaker: string | undefined, index: number): "a" | "b" =>
    speaker === "a" || speaker === "b" ? speaker : (index % 2 === 0 ? "a" : "b");

  const focusDialog = (dialogId: number): void => {
    window.setTimeout(() => {
      const dialogElement = dialogRefs.current.get(dialogId);
      if (!dialogElement) {
        return;
      }
      dialogElement.scrollIntoView({ behavior: "smooth", block: "center" });
      dialogElement.focus({ preventScroll: true });
    }, 0);
  };

  const openAndFocusDialog = (dialogId: number): void => {
    setExpandedDialogId(dialogId);
    focusDialog(dialogId);
  };

  const handleDialogAudioPlay = (dialogId: number): void => {
    setPlayingDialogId(dialogId);
    openAndFocusDialog(dialogId);
  };

  const clearManualDialogPlayback = (dialogId: number): void => {
    if (playingAll) {
      return;
    }
    setPlayingDialogId((current) => (current === dialogId ? null : current));
  };

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
      setExpandedDialogId(null);
      setWordActionStatus({});
      setPendingWordAdd(null);
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

  const requestAddWordFromDialogToken = async (
    key: string,
    dialogId: number,
    turnIndex: number,
    sourceLine: string,
    targetLine: string,
    targetTokenRaw: string,
  ): Promise<void> => {
    const targetToken = cleanToken(targetTokenRaw);
    if (!targetToken) {
      return;
    }

    setWordActionStatus((current) => ({ ...current, [key]: "saving" }));
    try {
      const check = await quickAddWordFromDialog(
        targetToken,
        targetToken,
        sourceLanguage,
        targetLanguage,
        dialogId,
        turnIndex,
        true,
        sourceLine,
        targetLine,
        targetToken,
      );
      if (check.exists) {
        setWordActionStatus((current) => ({ ...current, [key]: "exists" }));
        return;
      }
      setWordActionStatus((current) => ({ ...current, [key]: "idle" }));
      setPendingWordAdd({
        key,
        source: check.source_text || targetToken,
        target: check.target_text || targetToken,
        dialogId,
        turnIndex,
        sourceLine,
        targetLine,
        clickedTargetToken: targetToken,
      });
    } catch {
      setWordActionStatus((current) => ({ ...current, [key]: "error" }));
    }
  };

  const confirmAddWordFromDialog = async (): Promise<void> => {
    if (!pendingWordAdd || addingWord) {
      return;
    }

    const { key, source, target, dialogId, turnIndex, sourceLine, targetLine, clickedTargetToken } = pendingWordAdd;
    setWordActionStatus((current) => ({ ...current, [key]: "saving" }));
    setAddingWord(true);
    try {
      const resultPayload = await quickAddWordFromDialog(
        source,
        target,
        sourceLanguage,
        targetLanguage,
        dialogId,
        turnIndex,
        false,
        sourceLine,
        targetLine,
        clickedTargetToken,
      );
      setWordActionStatus((current) => ({ ...current, [key]: resultPayload.created ? "added" : "exists" }));
    } catch {
      setWordActionStatus((current) => ({ ...current, [key]: "error" }));
    } finally {
      setAddingWord(false);
      setPendingWordAdd(null);
    }
  };

  const renderTargetLineWithWordLinks = (
    dialogId: number,
    targetText: string,
    sourceText: string,
    turnIndex: number,
  ): JSX.Element => {
    const tokens = lineTokens(targetText);
    if (!tokens.length) {
      return <>{targetText}</>;
    }

    return (
      <>
        {tokens.map((token, tokenIndex) => {
          const normalized = cleanToken(token);
          if (!normalized) {
            return (
              <span key={`${dialogId}-${turnIndex}-punct-${tokenIndex}`} className="turn-token-wrap">
                {token}
                {tokenIndex < tokens.length - 1 ? " " : ""}
              </span>
            );
          }
          const statusKey = `dialog-${dialogId}-turn-${turnIndex}-target-${tokenIndex}`;
          const status = wordActionStatus[statusKey] || "idle";
          return (
            <span key={statusKey} className="turn-token-wrap">
              <button
                type="button"
                className="turn-token-button"
                onClick={() => void requestAddWordFromDialogToken(statusKey, dialogId, turnIndex, sourceText, targetText, token)}
                disabled={status === "saving"}
              >
                {token}
              </button>
              {tokenIndex < tokens.length - 1 ? " " : ""}
              {status === "saving" && <span className="turn-token-status">({t("newItem.wordAddSaving")})</span>}
              {status === "added" && <span className="turn-token-status">({t("newItem.wordAddAdded")})</span>}
              {status === "exists" && <span className="turn-token-status">({t("newItem.wordAddExists")})</span>}
              {status === "error" && <span className="turn-token-status">({t("newItem.wordAddError")})</span>}
            </span>
          );
        })}
      </>
    );
  };

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
    const shuffledDialogs = [...playableDialogs];
    for (let index = shuffledDialogs.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [shuffledDialogs[index], shuffledDialogs[swapIndex]] = [shuffledDialogs[swapIndex], shuffledDialogs[index]];
    }
    stopCurrentPlayback();
    playbackRunRef.current += 1;
    const runId = playbackRunRef.current;
    setPlayingAll(true);

    for (const dialog of shuffledDialogs) {
      if (runId !== playbackRunRef.current) {
        break;
      }
      setPlayingDialogId(dialog.dialog_id);
      openAndFocusDialog(dialog.dialog_id);
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
          <ul className="manage-list">
            {dialogs.map((dialog) => (
              <li
                key={dialog.dialog_id}
                ref={(element) => {
                  if (element) {
                    dialogRefs.current.set(dialog.dialog_id, element);
                  } else {
                    dialogRefs.current.delete(dialog.dialog_id);
                  }
                }}
                className={`related-dialog-card dialog-list-card ${playingDialogId === dialog.dialog_id ? "dialog-list-card-playing" : ""}`}
                tabIndex={-1}
              >
                <div className="dialog-list-row">
                  <div className="dialog-list-main">
                    <strong className="dialog-list-topic">{dialog.topic}</strong>
                    <span className="dialog-list-context">{dialog.context || t("dialogs.noContext")}</span>
                    {playingAll && playingDialogId === dialog.dialog_id && (
                      <span className="manage-item-meta">{t("dialogs.nowPlaying")}</span>
                    )}
                  </div>
                  <div className="dialog-list-controls">
                    {dialog.audio_url ? (
                      <audio
                        controls
                        src={dialog.audio_url}
                        preload="none"
                        onPlay={() => handleDialogAudioPlay(dialog.dialog_id)}
                        onPause={() => clearManualDialogPlayback(dialog.dialog_id)}
                        onEnded={() => clearManualDialogPlayback(dialog.dialog_id)}
                      />
                    ) : (
                      <span className="manage-item-meta">{t("dialogs.noAudio")}</span>
                    )}
                    {!!dialog.turns?.length && (
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => setExpandedDialogId((current) => (current === dialog.dialog_id ? null : dialog.dialog_id))}
                      >
                        {expandedDialogId === dialog.dialog_id ? t("dialogs.hideDialog") : t("dialogs.showDialog")}
                      </button>
                    )}
                  </div>
                </div>
                {!!dialog.turns?.length && (
                  <>
                    {expandedDialogId === dialog.dialog_id && (
                      <>
                        <p><strong>{t("newItem.dialogTurns")}:</strong></p>
                        <ul className="conversation-preview-list">
                          {dialog.turns.map((turn, index) => {
                            const speaker = speakerForTurn(turn.speaker, index);
                            return (
                              <li
                                key={`${dialog.dialog_id}-turn-${index}`}
                                className={`conversation-turn ${speaker === "a" ? "speaker-a" : "speaker-b"}`}
                              >
                                <p className="conversation-speaker">
                                  {speaker === "a" ? t("content.preview.personA") : t("content.preview.personB")}
                                </p>
                                <p className="conversation-line conversation-line-translation">
                                  {renderTargetLineWithWordLinks(dialog.dialog_id, turn.target_text, turn.source_text, index)}
                                </p>
                                <p className="conversation-line">{turn.source_text}</p>
                              </li>
                            );
                          })}
                        </ul>
                        <div className="actions">
                          <button type="button" className="secondary-button" onClick={() => setExpandedDialogId(null)}>
                            {t("dialogs.hideDialog")}
                          </button>
                        </div>
                      </>
                    )}
                  </>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {pendingWordAdd && (
        <div className="blocking-modal-overlay" role="dialog" aria-modal="true">
          <div className="blocking-modal add-word-modal">
            <p className="add-word-modal-title">
              <strong>{t("newItem.wordAddTitle")}</strong>
            </p>
            <p className="add-word-modal-word">{pendingWordAdd.target}</p>
            <p className="add-word-modal-meaning">
              {t("newItem.wordAddMeaning", { translation: pendingWordAdd.source })}
            </p>
            <p className="hint">{t("newItem.wordAddPrompt")}</p>
            <div className="actions">
              <button type="button" className="secondary-button" onClick={() => setPendingWordAdd(null)} disabled={addingWord}>
                {t("newItem.wordAddCancel")}
              </button>
              <button type="button" onClick={() => void confirmAddWordFromDialog()} disabled={addingWord}>
                {addingWord ? t("newItem.wordAddSaving") : t("newItem.wordAddConfirmButton")}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
