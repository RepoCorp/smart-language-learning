import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";

import {
  generateContentDialogTurnAudio,
  generateContentDialogTurnClearAudio,
} from "../../../api";
import type { ContentDialogRecord, StudyLanguageCode } from "../../../types";

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
  audioMode?: DialogTurnAudioMode;
  clearPlaybackRate?: number;
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
  audioMode = "natural",
  clearPlaybackRate = 1,
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
  const [isPlaybackPaused, setIsPlaybackPaused] = useState<boolean>(false);
  const [loadingTurnAudioKey, setLoadingTurnAudioKey] = useState<string>("");
  const playbackRunRef = useRef<number>(0);
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);
  const activeAudioModeRef = useRef<DialogTurnAudioMode>("natural");
  const clearPlaybackRateRef = useRef(clearPlaybackRate);
  const pausedRef = useRef(false);
  const finishAudioRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    clearPlaybackRateRef.current = clearPlaybackRate;
    if (activeAudioRef.current && activeAudioModeRef.current === "clear") {
      activeAudioRef.current.playbackRate = clearPlaybackRate;
    }
  }, [clearPlaybackRate]);

  const stopCurrentPlayback = (): void => {
    playbackRunRef.current += 1;
    pausedRef.current = false;
    if (activeAudioRef.current) {
      activeAudioRef.current.pause();
      activeAudioRef.current.currentTime = 0;
      activeAudioRef.current = null;
    }
    finishAudioRef.current?.();
    setLoadingTurnAudioKey("");
    setPlayingAll(false);
    setPlayingDialogId(null);
    setPlayingTurn(null);
    setIsPlaybackPaused(false);
  };

  const togglePlaybackPause = (): void => {
    const audio = activeAudioRef.current;
    pausedRef.current = !pausedRef.current;
    setIsPlaybackPaused(pausedRef.current);
    if (pausedRef.current) audio?.pause();
    else if (audio) {
      const runId = playbackRunRef.current;
      void audio.play().catch(() => {
        if (runId !== playbackRunRef.current) return;
        setError(loadError);
        stopCurrentPlayback();
      });
    }
  };

  useEffect(() => { stopCurrentPlayback(); }, [audioMode, sourceLanguage, targetLanguage]);

  useEffect(() => () => {
    playbackRunRef.current += 1;
    activeAudioRef.current?.pause();
    finishAudioRef.current?.();
  }, []);

  const playAudioUrl = (audioUrl: string, runId: number, mode: DialogTurnAudioMode): Promise<void> =>
    new Promise((resolve, reject) => {
      if (!audioUrl || runId !== playbackRunRef.current) {
        resolve();
        return;
      }

      const audio = new Audio(audioUrl);
      audio.preservesPitch = true;
      audio.playbackRate = mode === "clear" ? clearPlaybackRateRef.current : 1;
      activeAudioRef.current = audio;
      activeAudioModeRef.current = mode;
      const done = (): void => {
        audio.removeEventListener("ended", done);
        audio.removeEventListener("error", failed);
        if (activeAudioRef.current === audio) {
          activeAudioRef.current = null;
        }
        if (finishAudioRef.current === done) finishAudioRef.current = null;
        resolve();
      };
      const failed = (): void => {
        reject(new Error(loadError));
        done();
      };
      finishAudioRef.current = done;
      audio.addEventListener("ended", done);
      audio.addEventListener("error", failed);
      if (!pausedRef.current) void audio.play().catch(failed);
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
    runId: number,
  ): Promise<string> => {
    if (runId !== playbackRunRef.current) return "";
    if (currentAudioUrl) {
      return currentAudioUrl;
    }
    const key = `${mode}:${dialogId}:${turnIndex}`;
    setLoadingTurnAudioKey(key);
    try {
      const audioUrl = mode === "clear"
        ? await generateContentDialogTurnClearAudio(dialogId, turnIndex, sourceLanguage, targetLanguage)
        : await generateContentDialogTurnAudio(dialogId, turnIndex, sourceLanguage, targetLanguage);
      if (runId !== playbackRunRef.current) return "";
      if (audioUrl) {
        updateTurnAudioUrl(dialogId, turnIndex, audioUrl, mode);
      }
      else setError(loadError);
      return audioUrl;
    } catch {
      if (runId === playbackRunRef.current) setError(loadError);
      return "";
    } finally {
      if (runId === playbackRunRef.current) setLoadingTurnAudioKey("");
    }
  };

  const playTurn = async (
    dialogId: number,
    turnIndex: number,
    currentAudioUrl: string,
    mode: DialogTurnAudioMode,
  ): Promise<void> => {
    stopCurrentPlayback();
    const runId = playbackRunRef.current;
    setError("");
    setPlayingDialogId(dialogId);
    setPlayingTurn({ dialogId, turnIndex });
    try {
      const audioUrl = await ensureTurnAudioUrl(dialogId, turnIndex, currentAudioUrl, mode, runId);
      if (audioUrl) await playAudioUrl(audioUrl, runId, mode);
    } catch {
      if (runId === playbackRunRef.current) setError(loadError);
    } finally {
      if (runId === playbackRunRef.current) stopCurrentPlayback();
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
      focusDialogTurn(detailedDialog.dialog_id, index, setExpandedDialogId);
      const audioUrl = await ensureTurnAudioUrl(
        detailedDialog.dialog_id,
        index,
        (audioMode === "clear" ? detailedDialog.turns[index].clear_audio_url : detailedDialog.turns[index].phrase_audio_url) || "",
        audioMode,
        runId,
      );
      if (!audioUrl) {
        if (runId === playbackRunRef.current) throw new Error(loadError);
        return;
      }
      await playAudioUrl(audioUrl, runId, audioMode);
    }
  };

  const playSingleDialog = async (dialog: ContentDialogRecord): Promise<void> => {
    if (!dialogHasTurns(dialog)) {
      return;
    }
    stopCurrentPlayback();
    playbackRunRef.current += 1;
    const runId = playbackRunRef.current;
    setError("");
    try {
      await playDialogWithFocusedTurns(dialog, runId);
    } catch {
      if (runId === playbackRunRef.current) setError(loadError);
    } finally {
      if (runId === playbackRunRef.current) stopCurrentPlayback();
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
      if (runId === playbackRunRef.current) setError(loadError);
    } finally {
      if (runId === playbackRunRef.current) {
        stopCurrentPlayback();
      }
    }
  };

  return {
    dialogHasTurns,
    loadingTurnAudioKey,
    playingAll,
    playingDialogId,
    playingTurn,
    isPlaybackPaused,
    playAllDialogs,
    playSingleDialog,
    playTurn,
    stopCurrentPlayback,
    togglePlaybackPause,
  };
}
