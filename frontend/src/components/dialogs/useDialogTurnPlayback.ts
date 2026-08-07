import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";

import {
  generateContentDialogTurnAudio,
  generateContentDialogTurnClearAudio,
} from "../../api";
import type { ContentDialogRecord, StudyLanguageCode } from "../../types";

export type DialogTurnAudioMode = "natural" | "clear";

type PlayingTurn = {
  dialogId: number;
  turnIndex: number;
};

type Params = {
  dialogs: ContentDialogRecord[];
  setDialogs: Dispatch<SetStateAction<ContentDialogRecord[]>>;
  sourceLanguage: StudyLanguageCode;
  targetLanguage: StudyLanguageCode;
  loadError: string;
  setError: (value: string) => void;
  ensureDialogDetail: (dialogId: number, initialDialog?: ContentDialogRecord | null) => Promise<ContentDialogRecord | null>;
  upsertVisibleDialog: (dialog: ContentDialogRecord) => void;
  fetchAllFilteredDialogs: () => Promise<ContentDialogRecord[]>;
  focusDialogTurn: (dialogId: number, turnIndex: number, setExpandedDialogId: Dispatch<SetStateAction<number | null>>) => void;
  setExpandedDialogId: Dispatch<SetStateAction<number | null>>;
};

export default function useDialogTurnPlayback({
  dialogs,
  setDialogs,
  sourceLanguage,
  targetLanguage,
  loadError,
  setError,
  ensureDialogDetail,
  upsertVisibleDialog,
  fetchAllFilteredDialogs,
  focusDialogTurn,
  setExpandedDialogId,
}: Params) {
  const [playingAll, setPlayingAll] = useState<boolean>(false);
  const [playingDialogId, setPlayingDialogId] = useState<number | null>(null);
  const [playingTurn, setPlayingTurn] = useState<PlayingTurn | null>(null);
  const [loadingTurnAudioKey, setLoadingTurnAudioKey] = useState<string>("");
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
    setPlayingTurn(null);
  };

  useEffect(() => () => {
    playbackRunRef.current += 1;
    activeAudioRef.current?.pause();
  }, []);

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
      void audio.play().catch(done);
    });

  const updateTurnAudioUrl = (
    dialogId: number,
    turnIndex: number,
    audioUrl: string,
    mode: DialogTurnAudioMode,
  ): void => {
    const field = mode === "clear" ? "clear_audio_url" : "phrase_audio_url";
    setDialogs((current) => current.map((dialog) => (
      dialog.dialog_id === dialogId
        ? {
            ...dialog,
            turns: dialog.turns.map((turn, index) => (
              index === turnIndex ? { ...turn, [field]: audioUrl } : turn
            )),
          }
        : dialog
    )));
  };

  const ensureTurnAudioUrl = async (
    dialogId: number,
    turnIndex: number,
    currentAudioUrl: string,
    mode: DialogTurnAudioMode,
  ): Promise<string> => {
    if (currentAudioUrl) {
      return currentAudioUrl;
    }
    const key = `${mode}:${dialogId}:${turnIndex}`;
    setLoadingTurnAudioKey(key);
    try {
      const audioUrl = mode === "clear"
        ? await generateContentDialogTurnClearAudio(dialogId, turnIndex, sourceLanguage, targetLanguage)
        : await generateContentDialogTurnAudio(dialogId, turnIndex, sourceLanguage, targetLanguage);
      if (audioUrl) {
        updateTurnAudioUrl(dialogId, turnIndex, audioUrl, mode);
      }
      return audioUrl;
    } catch {
      setError(loadError);
      return "";
    } finally {
      setLoadingTurnAudioKey((current) => (current === key ? "" : current));
    }
  };

  const playTurn = async (
    dialogId: number,
    turnIndex: number,
    currentAudioUrl: string,
    mode: DialogTurnAudioMode,
  ): Promise<void> => {
    stopCurrentPlayback();
    const audioUrl = await ensureTurnAudioUrl(dialogId, turnIndex, currentAudioUrl, mode);
    if (!audioUrl) {
      return;
    }
    playbackRunRef.current += 1;
    const runId = playbackRunRef.current;
    setPlayingDialogId(dialogId);
    setPlayingTurn({ dialogId, turnIndex });
    await playAudioUrl(audioUrl, runId);
    if (runId === playbackRunRef.current) {
      setPlayingDialogId(null);
      setPlayingTurn(null);
    }
  };

  const dialogHasTurns = (dialog: ContentDialogRecord): boolean => Boolean(dialog.turn_count || dialog.turns?.length);

  const playDialogWithFocusedTurns = async (dialog: ContentDialogRecord, runId: number): Promise<void> => {
    upsertVisibleDialog(dialog);
    const detailedDialog = await ensureDialogDetail(dialog.dialog_id, dialog);
    if (!detailedDialog || runId !== playbackRunRef.current) {
      return;
    }
    setPlayingDialogId(detailedDialog.dialog_id);
    for (let index = 0; index < detailedDialog.turns.length; index += 1) {
      if (runId !== playbackRunRef.current) {
        break;
      }
      setPlayingTurn({ dialogId: detailedDialog.dialog_id, turnIndex: index });
      if (index > 0) {
        focusDialogTurn(detailedDialog.dialog_id, index, setExpandedDialogId);
      } else {
        setExpandedDialogId(detailedDialog.dialog_id);
      }
      const audioUrl = await ensureTurnAudioUrl(
        detailedDialog.dialog_id,
        index,
        detailedDialog.turns[index].phrase_audio_url || "",
        "natural",
      );
      await playAudioUrl(audioUrl, runId);
    }
  };

  const playSingleDialog = async (dialog: ContentDialogRecord): Promise<void> => {
    if (!dialogHasTurns(dialog)) {
      return;
    }
    stopCurrentPlayback();
    playbackRunRef.current += 1;
    const runId = playbackRunRef.current;
    await playDialogWithFocusedTurns(dialog, runId);
    if (runId === playbackRunRef.current) {
      setPlayingDialogId(null);
      setPlayingTurn(null);
    }
  };

  const playAllDialogs = async (): Promise<void> => {
    stopCurrentPlayback();
    playbackRunRef.current += 1;
    const runId = playbackRunRef.current;
    setPlayingAll(true);
    setError("");
    try {
      const dialogsToPlay = (await fetchAllFilteredDialogs()).filter(dialogHasTurns);
      for (let index = dialogsToPlay.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        [dialogsToPlay[index], dialogsToPlay[swapIndex]] = [dialogsToPlay[swapIndex], dialogsToPlay[index]];
      }
      for (const dialog of dialogsToPlay) {
        if (runId !== playbackRunRef.current) {
          break;
        }
        await playDialogWithFocusedTurns(dialog, runId);
      }
    } catch {
      setError(loadError);
    } finally {
      if (runId === playbackRunRef.current) {
        setPlayingAll(false);
        setPlayingDialogId(null);
        setPlayingTurn(null);
      }
    }
  };

  return {
    dialogHasTurns,
    loadingTurnAudioKey,
    playingAll,
    playingDialogId,
    playingTurn,
    playAllDialogs,
    playSingleDialog,
    playTurn,
    stopCurrentPlayback,
  };
}
