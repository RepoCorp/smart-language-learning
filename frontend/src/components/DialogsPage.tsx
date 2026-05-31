import { useEffect, useRef, useState } from "react";

import { fetchContentDialogs, fetchContentItemDetail, quickAddWordFromDialog } from "../api";
import { useI18n } from "../i18n";
import { useStudyLanguages } from "../studyLanguages";
import type { ContentDialogRecord, SessionItem } from "../types";
import DialogTurnText from "./DialogTurnText";
import NewItem from "./NewItem";

type WordActionStatus = "idle" | "saving" | "added" | "exists" | "error";
type PendingWordAdd = {
  key: string;
  source: string;
  target: string;
  wordType: string;
  dialogId: number;
  turnIndex: number;
  sourceLine: string;
  targetLine: string;
  clickedTargetToken: string;
};

type PlayingTurn = {
  dialogId: number;
  turnIndex: number;
};

export default function DialogsPage(): JSX.Element {
  const { t } = useI18n();
  const { sourceLanguage, targetLanguage } = useStudyLanguages();
  const [dialogs, setDialogs] = useState<ContentDialogRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const [playingAll, setPlayingAll] = useState<boolean>(false);
  const [playingDialogId, setPlayingDialogId] = useState<number | null>(null);
  const [playingTurn, setPlayingTurn] = useState<PlayingTurn | null>(null);
  const [expandedDialogId, setExpandedDialogId] = useState<number | null>(null);
  const [wordActionStatus, setWordActionStatus] = useState<Record<string, WordActionStatus>>({});
  const [pendingWordAdd, setPendingWordAdd] = useState<PendingWordAdd | null>(null);
  const [addingWord, setAddingWord] = useState<boolean>(false);
  const [openedLinkedWord, setOpenedLinkedWord] = useState<SessionItem | null>(null);
  const [loadingLinkedWord, setLoadingLinkedWord] = useState<boolean>(false);
  const playbackRunRef = useRef<number>(0);
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);
  const dialogRefs = useRef<Map<number, HTMLLIElement>>(new Map());
  const turnRefs = useRef<Map<string, HTMLLIElement>>(new Map());
  const cleanToken = (value: string): string => value.replace(/^[^A-Za-zÀ-ÖØ-öø-ÿ]+|[^A-Za-zÀ-ÖØ-öø-ÿ]+$/g, "").trim();
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

  const turnRefKey = (dialogId: number, turnIndex: number): string => `${dialogId}:${turnIndex}`;

  const focusDialogTurn = (dialogId: number, turnIndex: number): void => {
    setExpandedDialogId(dialogId);
    window.setTimeout(() => {
      const turnElement = turnRefs.current.get(turnRefKey(dialogId, turnIndex));
      if (!turnElement) {
        focusDialog(dialogId);
        return;
      }
      turnElement.scrollIntoView({ behavior: "smooth", block: "center" });
      turnElement.focus({ preventScroll: true });
    }, 0);
  };

  const handleDialogAudioPlay = (dialogId: number): void => {
    setPlayingDialogId(dialogId);
    setPlayingTurn(null);
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
    setPlayingTurn(null);
  };

  const openLinkedWordItem = async (itemId: number): Promise<void> => {
    setLoadingLinkedWord(true);
    try {
      const detail = await fetchContentItemDetail(itemId, sourceLanguage, targetLanguage);
      setOpenedLinkedWord({
        id: detail.id,
        item_type: detail.item_type,
        spanish_text: detail.spanish_text,
        german_text: detail.german_text,
        example_sentence: detail.example_sentence || "",
        notes: detail.notes || "",
        word_type: detail.word_type || "",
        audio_url: detail.audio_url || "",
        exercise_phrases: detail.exercise_phrases || {},
        mode: "new",
        direction: null,
        options: [],
        dialog_phrase_answer: detail.dialog_phrase_answer || "",
        dialog_phrase_scene: detail.dialog_phrase_scene || "",
        dialog_phrase_scene_audio_urls: detail.dialog_phrase_scene_audio_urls || [],
        dialog_phrase_options: detail.dialog_phrase_options || [],
        related_dialogs: detail.related_dialogs || [],
        item_questions: detail.item_questions || [],
      });
    } finally {
      setLoadingLinkedWord(false);
    }
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
        if (!check.id) {
          setWordActionStatus((current) => ({ ...current, [key]: "error" }));
          return;
        }
        await openLinkedWordItem(check.id);
        setWordActionStatus((current) => ({ ...current, [key]: "exists" }));
        return;
      }
      setWordActionStatus((current) => ({ ...current, [key]: "idle" }));
      const resolvedWordType = String(check.word_type || "").trim();
      if (!resolvedWordType) {
        setWordActionStatus((current) => ({ ...current, [key]: "error" }));
        return;
      }
      setPendingWordAdd({
        key,
        source: check.source_text || targetToken,
        target: check.target_text || targetToken,
        wordType: resolvedWordType,
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
      if (resultPayload.exists) {
        if (!resultPayload.id) {
          setWordActionStatus((current) => ({ ...current, [key]: "error" }));
          return;
        }
        await openLinkedWordItem(resultPayload.id);
      }
      setWordActionStatus((current) => ({ ...current, [key]: resultPayload.created ? "added" : "exists" }));
    } catch {
      setWordActionStatus((current) => ({ ...current, [key]: "error" }));
    } finally {
      setAddingWord(false);
      setPendingWordAdd(null);
    }
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

  const dialogHasAllTurnAudio = (dialog: ContentDialogRecord): boolean =>
    Boolean(dialog.turns?.length) && dialog.turns.every((turn) => Boolean(turn.phrase_audio_url));

  const dialogIsPlayable = (dialog: ContentDialogRecord): boolean => Boolean(dialog.audio_url) || dialogHasAllTurnAudio(dialog);

  const playDialogWithFocusedTurns = async (dialog: ContentDialogRecord, runId: number): Promise<void> => {
    setPlayingDialogId(dialog.dialog_id);
    if (dialogHasAllTurnAudio(dialog)) {
      for (let index = 0; index < dialog.turns.length; index += 1) {
        if (runId !== playbackRunRef.current) {
          break;
        }
        setPlayingTurn({ dialogId: dialog.dialog_id, turnIndex: index });
        focusDialogTurn(dialog.dialog_id, index);
        await playAudioUrl(dialog.turns[index].phrase_audio_url || "", runId);
      }
      return;
    }

    setPlayingTurn(null);
    openAndFocusDialog(dialog.dialog_id);
    await playAudioUrl(dialog.audio_url, runId);
  };

  const playAllDialogs = async (): Promise<void> => {
    const playableDialogs = dialogs.filter(dialogIsPlayable);
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
      await playDialogWithFocusedTurns(dialog, runId);
    }

    if (runId === playbackRunRef.current) {
      setPlayingAll(false);
      setPlayingDialogId(null);
      setPlayingTurn(null);
    }
  };

  const hasPlayableDialogs = dialogs.some(dialogIsPlayable);

  return (
    <main className="container" data-testid="dialogs-page">
      <h1>{t("dialogs.title")}</h1>
      <p>{t("dialogs.description")}</p>
      <section className="card">
        <div className="actions">
          {!playingAll ? (
            <button type="button" onClick={() => void playAllDialogs()} disabled={loading || !hasPlayableDialogs}>
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
                            const isPlayingTurn = playingTurn?.dialogId === dialog.dialog_id && playingTurn.turnIndex === index;
                            return (
                              <li
                                key={`${dialog.dialog_id}-turn-${index}`}
                                ref={(element) => {
                                  const key = turnRefKey(dialog.dialog_id, index);
                                  if (element) {
                                    turnRefs.current.set(key, element);
                                  } else {
                                    turnRefs.current.delete(key);
                                  }
                                }}
                                className={`conversation-turn ${speaker === "a" ? "speaker-a" : "speaker-b"} ${isPlayingTurn ? "turn-highlight" : ""}`}
                                tabIndex={-1}
                              >
                                <p className="conversation-speaker">
                                  {speaker === "a" ? t("content.preview.personA") : t("content.preview.personB")}
                                </p>
                                <div className="conversation-line conversation-line-translation">
                                  <DialogTurnText
                                    dialogId={dialog.dialog_id}
                                    turnIndex={index}
                                    sourceText={turn.source_text}
                                    targetText={turn.target_text}
                                    sourceLanguage={sourceLanguage}
                                    targetLanguage={targetLanguage}
                                    tokenStatus={wordActionStatus}
                                    statusKeyPrefix={`dialog-${dialog.dialog_id}-turn-${index}-target`}
                                    onOpenItem={openLinkedWordItem}
                                    onTokenClick={(statusKey, token) => void requestAddWordFromDialogToken(
                                      statusKey,
                                      dialog.dialog_id,
                                      index,
                                      turn.source_text,
                                      turn.target_text,
                                      token,
                                    )}
                                  />
                                </div>
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
            <p className="add-word-modal-type">
              <strong>{t("newItem.wordAddType", { type: pendingWordAdd.wordType })}</strong>
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
      {openedLinkedWord && (
        <div className="blocking-modal-overlay" role="dialog" aria-modal="true">
          <div className="blocking-modal words-item-modal">
            <NewItem item={openedLinkedWord} readOnly onClose={() => setOpenedLinkedWord(null)} />
          </div>
        </div>
      )}
      {loadingLinkedWord && <p className="hint">{t("session.loading")}</p>}
    </main>
  );
}
