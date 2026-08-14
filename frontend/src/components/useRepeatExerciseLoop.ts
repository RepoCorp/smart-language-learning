import { useEffect, useRef, useState } from "react";

import {
  BROWSER_EXERCISE_PHRASE_PAUSE_MS,
  pauseBrowserExercisePhrases,
  speakBrowserExerciseLinesOnce,
} from "../exerciseBrowserSpeech";
import type { StudyLanguageCode } from "../types";

const EXERCISE_DURATION_SECONDS = 30;

type LoopPlayback = string[] | {
  lines?: string[];
  audioSources?: string[];
};

export function useRepeatExerciseLoop({
  defaultLines,
  audioSources,
  targetLanguage,
  preferredBrowserVoiceURI,
}: {
  defaultLines: string[];
  audioSources: string[];
  targetLanguage: StudyLanguageCode;
  preferredBrowserVoiceURI: string;
}): {
  secondsLeft: number;
  isRunning: boolean;
  isMuted: boolean;
  start: (playback?: LoopPlayback) => void;
  stop: (resetToFullTime?: boolean) => void;
  toggleMute: () => void;
} {
  const [secondsLeft, setSecondsLeft] = useState(EXERCISE_DURATION_SECONDS);
  const [isRunning, setIsRunning] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const timerRef = useRef<number | null>(null);
  const runRef = useRef(0);
  const runningRef = useRef(false);
  const mutedRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const cancelPlayback = (): void => {
    runningRef.current = false;
    runRef.current += 1;
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    window.speechSynthesis?.cancel();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
  };

  const stop = (resetToFullTime = true): void => {
    cancelPlayback();
    setIsRunning(false);
    setSecondsLeft(resetToFullTime ? EXERCISE_DURATION_SECONDS : 0);
  };

  useEffect(() => () => cancelPlayback(), []);

  const playDoneSound = (): void => {
    const AudioContextClass = window.AudioContext
      || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    const now = context.currentTime;
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.03, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
    gain.connect(context.destination);
    const oscillator = context.createOscillator();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(659.25, now);
    oscillator.frequency.setValueAtTime(783.99, now + 0.2);
    oscillator.connect(gain);
    oscillator.start(now);
    oscillator.stop(now + 0.46);
    oscillator.onended = () => { void context.close(); };
  };

  const playAudioSourcesOnce = async (sources: string[], runId: number): Promise<void> => {
    for (const source of sources) {
      if (!source || runRef.current !== runId || !runningRef.current) continue;
      if (mutedRef.current) {
        await new Promise<void>((resolve) => window.setTimeout(resolve, BROWSER_EXERCISE_PHRASE_PAUSE_MS));
        continue;
      }
      await new Promise<void>((resolve) => {
        const audio = new Audio(source);
        audioRef.current = audio;
        audio.onended = resolve;
        audio.onerror = resolve;
        audio.onpause = resolve;
        void audio.play().catch(resolve);
      });
    }
    audioRef.current = null;
  };

  const start = (playback?: LoopPlayback): void => {
    stop();
    const runId = runRef.current;
    setSecondsLeft(EXERCISE_DURATION_SECONDS);
    setIsRunning(true);
    runningRef.current = true;
    timerRef.current = window.setInterval(() => {
      setSecondsLeft((current) => {
        if (current <= 1) {
          stop(false);
          if (!mutedRef.current) playDoneSound();
          return 0;
        }
        return current - 1;
      });
    }, 1000);

    const overrideLines = Array.isArray(playback) ? playback : playback?.lines;
    const playbackAudioSources = Array.isArray(playback)
      ? audioSources
      : playback?.audioSources ?? audioSources;
    const lines = overrideLines?.length ? overrideLines : defaultLines;
    const playOnce = playbackAudioSources.length
      ? () => playAudioSourcesOnce(playbackAudioSources, runId)
      : () => speakBrowserExerciseLinesOnce({
        lines,
        runId,
        isRunning: () => runRef.current === runId && runningRef.current,
        isMuted: () => mutedRef.current,
        targetLanguage,
        preferredBrowserVoiceURI,
      });
    const loop = (): void => {
      if (runRef.current !== runId || !runningRef.current) return;
      void playOnce().then(async () => {
        if (runRef.current !== runId || !runningRef.current) return;
        await pauseBrowserExercisePhrases(runId, () => runRef.current === runId && runningRef.current);
        if (runRef.current === runId && runningRef.current) loop();
      });
    };
    loop();
  };

  return {
    secondsLeft,
    isRunning,
    isMuted,
    start,
    stop,
    toggleMute: () => {
      setIsMuted((current) => {
        const next = !current;
        mutedRef.current = next;
        if (next) {
          window.speechSynthesis?.cancel();
          audioRef.current?.pause();
        }
        return next;
      });
    },
  };
}
