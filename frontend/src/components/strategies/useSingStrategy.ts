import { useEffect, useMemo, useState } from "react";

import { generateContentItemSong, generateContentItemSongImage, generateContentItemSongLyrics, retryContentItemSong } from "../../apiSingStrategy";
import type { ItemExercisePhrases, StudyLanguageCode } from "../../types";

export type SingSong = {
  target: string; source: string; audioUrl: string; imageUrl: string; durationSeconds: number; canRetry: boolean; canChangeLyrics: boolean;
};

function songFromPayload(exercisePhrases: ItemExercisePhrases | undefined): SingSong | null {
  const payload = (exercisePhrases as unknown as { sing_song?: Record<string, unknown> } | undefined)?.sing_song;
  const target = String(payload?.target_text || "").trim();
  const source = String(payload?.source_text || "").trim();
  if (!target || !source) return null;
  return {
    target,
    source,
    audioUrl: String(payload?.audio_url || "").trim(),
    imageUrl: String(payload?.image_url || "").trim(),
    durationSeconds: Number(payload?.duration_seconds || 0),
    canRetry: Boolean(payload?.composition_plan),
    canChangeLyrics: !Boolean(payload?.lyrics_locked),
  };
}

export function useSingStrategy({ itemId, exercisePhrases, sourceLanguage, targetLanguage, setExercisePhrases, errorMessage }: {
  itemId: number; exercisePhrases: ItemExercisePhrases | undefined;
  sourceLanguage: StudyLanguageCode; targetLanguage: StudyLanguageCode;
  setExercisePhrases: (value: ItemExercisePhrases) => void; errorMessage: string;
}) {
  const [isCreatingSong, setIsCreatingSong] = useState(false);
  const [isCreatingLyrics, setIsCreatingLyrics] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [error, setError] = useState("");
  const song = useMemo(() => songFromPayload(exercisePhrases), [exercisePhrases]);
  const createLyrics = async (): Promise<void> => {
    if (itemId <= 0 || isCreatingLyrics) return;
    setIsCreatingLyrics(true); setError("");
    try { setExercisePhrases((await generateContentItemSongLyrics(itemId, sourceLanguage, targetLanguage)).exercise_phrases || {}); }
    catch (value) { setError(value instanceof Error ? value.message : errorMessage); }
    finally { setIsCreatingLyrics(false); }
  };
  const createSong = async (): Promise<void> => {
    if (itemId <= 0 || isCreatingSong) return;
    setIsCreatingSong(true); setError("");
    try { setExercisePhrases((await generateContentItemSong(itemId, sourceLanguage, targetLanguage)).exercise_phrases || {}); }
    catch (value) { setError(value instanceof Error ? value.message : errorMessage); }
    finally { setIsCreatingSong(false); }
  };
  const generateImage = async (): Promise<void> => {
    if (itemId <= 0 || isGeneratingImage) return;
    setIsGeneratingImage(true); setError("");
    try { setExercisePhrases((await generateContentItemSongImage(itemId, sourceLanguage, targetLanguage)).exercise_phrases || {}); }
    catch (value) { setError(value instanceof Error ? value.message : errorMessage); }
    finally { setIsGeneratingImage(false); }
  };
  const retrySameSong = async (): Promise<void> => {
    if (itemId <= 0 || isRetrying) return;
    setIsRetrying(true); setError("");
    try { setExercisePhrases((await retryContentItemSong(itemId, sourceLanguage, targetLanguage)).exercise_phrases || {}); }
    catch (value) { setError(value instanceof Error ? value.message : errorMessage); }
    finally { setIsRetrying(false); }
  };
  useEffect(() => { setError(""); setIsCreatingSong(false); setIsCreatingLyrics(false); }, [itemId, song?.target]);
  return { song, isCreatingLyrics, isCreatingSong, isGeneratingImage, isRetrying, error, createLyrics, createSong, generateImage, retrySameSong };
}
