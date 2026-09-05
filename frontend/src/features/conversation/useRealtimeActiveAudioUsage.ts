import { useEffect, useRef } from "react";

import { recordTopicConversationRealtimeUsage } from "../../apiConversationRealtimeUsage";

const UNLIMITED_REALTIME_ALLOWANCE_SECONDS = 1_000_000_000;

type RealtimeActiveAudioUsageOptions = {
  onLimitReached: () => void;
};

export function useRealtimeActiveAudioUsage({ onLimitReached }: RealtimeActiveAudioUsageOptions) {
  const remainingSecondsRef = useRef(0);
  const activeStartedAtRef = useRef<number | null>(null);
  const unsentMillisecondsRef = useRef(0);
  const limitTimerRef = useRef<number | null>(null);
  const requestQueueRef = useRef(Promise.resolve());

  const clearLimitTimer = (): void => {
    if (limitTimerRef.current !== null) {
      window.clearTimeout(limitTimerRef.current);
      limitTimerRef.current = null;
    }
  };

  const flush = (force: boolean): void => {
    const seconds = force
      ? Math.ceil(unsentMillisecondsRef.current / 1000)
      : Math.floor(unsentMillisecondsRef.current / 1000);
    if (seconds <= 0) return;
    unsentMillisecondsRef.current -= seconds * 1000;
    remainingSecondsRef.current = Math.max(0, remainingSecondsRef.current - seconds);
    requestQueueRef.current = requestQueueRef.current
      .then(async () => {
        const result = await recordTopicConversationRealtimeUsage(seconds);
        remainingSecondsRef.current = result.remaining_seconds;
      })
      .catch(() => {
        unsentMillisecondsRef.current += seconds * 1000;
      });
  };

  const setAudioActive = (active: boolean): void => {
    if (active && activeStartedAtRef.current === null) {
      if (remainingSecondsRef.current <= 0) {
        onLimitReached();
        return;
      }
      activeStartedAtRef.current = performance.now();
      if (remainingSecondsRef.current >= UNLIMITED_REALTIME_ALLOWANCE_SECONDS) {
        return;
      }
      const millisecondsRemaining = Math.max(0, (remainingSecondsRef.current * 1000) - unsentMillisecondsRef.current);
      limitTimerRef.current = window.setTimeout(() => {
        setAudioActive(false);
        flush(true);
        onLimitReached();
      }, millisecondsRemaining);
      return;
    }
    if (!active && activeStartedAtRef.current !== null) {
      unsentMillisecondsRef.current += performance.now() - activeStartedAtRef.current;
      activeStartedAtRef.current = null;
      clearLimitTimer();
      flush(false);
    }
  };

  const startSession = (remainingSeconds: number): void => {
    clearLimitTimer();
    remainingSecondsRef.current = Math.max(0, Math.floor(remainingSeconds));
    unsentMillisecondsRef.current = 0;
    activeStartedAtRef.current = null;
  };

  const stopSession = (): void => {
    setAudioActive(false);
    flush(true);
  };

  useEffect(() => () => stopSession(), []);

  return { setAudioActive, startSession, stopSession };
}
