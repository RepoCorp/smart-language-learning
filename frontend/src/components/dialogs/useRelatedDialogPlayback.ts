import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";

import {
  generateContentDialogTurnAudio,
  generateContentDialogTurnClearAudio,
} from "../../api";
import type { SessionItem, StudyLanguageCode } from "../../types";
import type { DialogTurnAudioMode } from "./useDialogTurnPlayback";

type RelatedDialog = NonNullable<SessionItem["related_dialogs"]>[number];

type Params = {
  setDialogs: Dispatch<SetStateAction<RelatedDialog[]>>;
  sourceLanguage: StudyLanguageCode;
  targetLanguage: StudyLanguageCode;
  onError: () => void;
};

export default function useRelatedDialogPlayback({
  setDialogs,
  sourceLanguage,
  targetLanguage,
  onError,
}: Params) {
  const [playingDialogId, setPlayingDialogId] = useState<number | null>(null);
  const [playingTurn, setPlayingTurn] = useState<{ dialogId: number; turnIndex: number } | null>(null);
  const [loadingAudioKey, setLoadingAudioKey] = useState<string>("");
  const playbackRunRef = useRef<number>(0);
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);

  const stopPlayback = (): void => {
    playbackRunRef.current += 1;
    activeAudioRef.current?.pause();
    activeAudioRef.current = null;
    setPlayingDialogId(null);
    setPlayingTurn(null);
  };

  useEffect(() => () => {
    playbackRunRef.current += 1;
    activeAudioRef.current?.pause();
  }, []);

  const playAudio = (audioUrl: string, runId: number): Promise<void> => new Promise((resolve) => {
    if (!audioUrl || runId !== playbackRunRef.current) {
      resolve();
      return;
    }
    const audio = new Audio(audioUrl);
    activeAudioRef.current = audio;
    const finish = (): void => {
      audio.removeEventListener("ended", finish);
      audio.removeEventListener("error", finish);
      if (activeAudioRef.current === audio) {
        activeAudioRef.current = null;
      }
      resolve();
    };
    audio.addEventListener("ended", finish);
    audio.addEventListener("error", finish);
    void audio.play().catch(finish);
  });

  const updateTurnAudio = (
    dialogId: number,
    turnIndex: number,
    audioUrl: string,
    mode: DialogTurnAudioMode,
  ): void => {
    const field = mode === "clear" ? "clear_audio_url" : "phrase_audio_url";
    setDialogs((current) => current.map((dialog) => dialog.dialog_id === dialogId ? {
      ...dialog,
      turns: dialog.turns.map((turn, index) => index === turnIndex ? { ...turn, [field]: audioUrl } : turn),
    } : dialog));
  };

  const ensureTurnAudio = async (
    dialogId: number,
    turnIndex: number,
    audioUrl: string,
    mode: DialogTurnAudioMode,
  ): Promise<string> => {
    if (audioUrl) {
      return audioUrl;
    }
    const key = `${mode}:${dialogId}:${turnIndex}`;
    setLoadingAudioKey(key);
    try {
      const generated = mode === "clear"
        ? await generateContentDialogTurnClearAudio(dialogId, turnIndex, sourceLanguage, targetLanguage)
        : await generateContentDialogTurnAudio(dialogId, turnIndex, sourceLanguage, targetLanguage);
      if (generated) {
        updateTurnAudio(dialogId, turnIndex, generated, mode);
      }
      return generated;
    } catch {
      onError();
      return "";
    } finally {
      setLoadingAudioKey((current) => current === key ? "" : current);
    }
  };

  const playTurn = async (
    dialogId: number,
    turnIndex: number,
    audioUrl: string,
    mode: DialogTurnAudioMode,
  ): Promise<void> => {
    stopPlayback();
    const resolvedAudioUrl = await ensureTurnAudio(dialogId, turnIndex, audioUrl, mode);
    if (!resolvedAudioUrl) {
      return;
    }
    playbackRunRef.current += 1;
    const runId = playbackRunRef.current;
    setPlayingDialogId(dialogId);
    setPlayingTurn({ dialogId, turnIndex });
    await playAudio(resolvedAudioUrl, runId);
    if (runId === playbackRunRef.current) {
      setPlayingDialogId(null);
      setPlayingTurn(null);
    }
  };

  const playDialog = async (dialog: RelatedDialog): Promise<void> => {
    if (!dialog.turns.length) {
      return;
    }
    stopPlayback();
    playbackRunRef.current += 1;
    const runId = playbackRunRef.current;
    setPlayingDialogId(dialog.dialog_id);
    for (let index = 0; index < dialog.turns.length && runId === playbackRunRef.current; index += 1) {
      setPlayingTurn({ dialogId: dialog.dialog_id, turnIndex: index });
      const audioUrl = await ensureTurnAudio(dialog.dialog_id, index, dialog.turns[index].phrase_audio_url || "", "natural");
      await playAudio(audioUrl, runId);
    }
    if (runId === playbackRunRef.current) {
      setPlayingDialogId(null);
      setPlayingTurn(null);
    }
  };

  return { loadingAudioKey, playingDialogId, playingTurn, playDialog, playTurn, stopPlayback };
}
