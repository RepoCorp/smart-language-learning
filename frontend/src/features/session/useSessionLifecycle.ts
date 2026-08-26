import { useCallback, useEffect, useRef, useState } from "react";

import { fetchSession } from "../../api";
import { useI18n } from "../../i18n";
import type { SessionPlanItem, StudyLanguageCode } from "../../types";
import {
  ACTIVE_SESSION_CHANGED_EVENT,
  activeSessionStorageKey,
  readStoredSessionState,
  writeStoredSessionState,
  type StoredSessionState,
} from "./sessionStorage";

type SessionOutcome = "time_up" | "completed" | null;

function toSessionPlanItems(value: unknown): SessionPlanItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const candidate = entry as Partial<SessionPlanItem>;
    if (
      typeof candidate.id !== "number"
      || (candidate.item_type !== "word" && candidate.item_type !== "phrase")
      || (candidate.mode !== "new" && candidate.mode !== "review")
    ) {
      return [];
    }
    return [{
      id: candidate.id,
      item_type: candidate.item_type,
      mode: candidate.mode,
      direction: candidate.direction || null,
      repeatedAfterFailure: Boolean(candidate.repeatedAfterFailure),
      repeatPracticeStep: candidate.repeatPracticeStep,
    }];
  });
}

export function useSessionLifecycle({
  sourceLanguage,
  targetLanguage,
}: {
  sourceLanguage: StudyLanguageCode;
  targetLanguage: StudyLanguageCode;
}) {
  const { t } = useI18n();
  const sessionStorageKey = activeSessionStorageKey(sourceLanguage, targetLanguage);
  const [items, setItems] = useState<SessionPlanItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [durationInput, setDurationInput] = useState("10");
  const [sessionDurationMinutes, setSessionDurationMinutes] = useState<number | null>(null);
  const [sessionEndsAtMs, setSessionEndsAtMs] = useState<number | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [sessionOutcome, setSessionOutcome] = useState<SessionOutcome>(null);
  const [index, setIndex] = useState(0);
  const [showPostReviewItem, setShowPostReviewItem] = useState(false);
  const [currentReviewCorrect, setCurrentReviewCorrect] = useState<boolean | null>(null);
  const [showExtendPrompt, setShowExtendPrompt] = useState(false);
  const [sessionPlanToken, setSessionPlanToken] = useState(0);
  const [hasHydratedState, setHasHydratedState] = useState(false);
  const [restoredSnapshotHasItems, setRestoredSnapshotHasItems] = useState(false);
  const activeLoadIdRef = useRef(0);

  const loadSession = useCallback(async (durationMinutes: number): Promise<void> => {
    const loadId = activeLoadIdRef.current + 1;
    activeLoadIdRef.current = loadId;
    setLoading(true);
    setSessionPlanToken((current) => current + 1);
    setItems([]);
    setError("");
    setShowPostReviewItem(false);
    setCurrentReviewCorrect(null);
    try {
      const data = await fetchSession(5, sourceLanguage, targetLanguage, durationMinutes);
      if (activeLoadIdRef.current !== loadId) return;
      setItems(data.items || []);
      setIndex(0);
    } catch {
      if (activeLoadIdRef.current !== loadId) return;
      setError(t("session.loadFailed"));
    } finally {
      if (activeLoadIdRef.current === loadId) {
        setLoading(false);
      }
    }
  }, [sourceLanguage, t, targetLanguage]);

  useEffect(() => {
    activeLoadIdRef.current += 1;
    setHasHydratedState(false);
    setRestoredSnapshotHasItems(false);
    const parsed = readStoredSessionState(sessionStorageKey);
    if (!parsed) {
      setHasHydratedState(true);
      return;
    }
    setDurationInput(typeof parsed.durationInput === "string" ? parsed.durationInput : "10");
    setSessionDurationMinutes(typeof parsed.sessionDurationMinutes === "number" ? parsed.sessionDurationMinutes : null);
    setSessionEndsAtMs(typeof parsed.sessionEndsAtMs === "number" ? parsed.sessionEndsAtMs : null);
    setRemainingSeconds(typeof parsed.remainingSeconds === "number" ? parsed.remainingSeconds : 0);
    setSessionOutcome(parsed.sessionOutcome === "time_up" || parsed.sessionOutcome === "completed" ? parsed.sessionOutcome : null);
    const parsedItems = toSessionPlanItems(parsed.items);
    setItems(parsedItems);
    setRestoredSnapshotHasItems(parsedItems.length > 0);
    setIndex(typeof parsed.index === "number" ? parsed.index : 0);
    setShowExtendPrompt(Boolean(parsed.showExtendPrompt));
    setShowPostReviewItem(Boolean(parsed.showPostReviewItem ?? parsed.showIncorrectReviewItem));
    setCurrentReviewCorrect(typeof parsed.currentReviewCorrect === "boolean" ? parsed.currentReviewCorrect : null);
    setHasHydratedState(true);
  }, [sessionStorageKey]);

  useEffect(() => {
    if (!hasHydratedState) return;
    if (sessionDurationMinutes === null) {
      window.sessionStorage.removeItem(sessionStorageKey);
      return;
    }
    const snapshot: StoredSessionState = {
      durationInput,
      sessionDurationMinutes,
      sessionEndsAtMs,
      remainingSeconds,
      sessionOutcome,
      index,
      items,
      showPostReviewItem,
      currentReviewCorrect,
      showExtendPrompt,
    };
    writeStoredSessionState(sessionStorageKey, snapshot);
  }, [
    currentReviewCorrect,
    durationInput,
    hasHydratedState,
    index,
    items,
    remainingSeconds,
    sessionDurationMinutes,
    sessionEndsAtMs,
    sessionOutcome,
    sessionStorageKey,
    showExtendPrompt,
    showPostReviewItem,
  ]);

  useEffect(() => {
    if (!hasHydratedState || loading || sessionDurationMinutes === null || restoredSnapshotHasItems || items.length > 0) return;
    void loadSession(sessionDurationMinutes);
  }, [hasHydratedState, items.length, loadSession, loading, restoredSnapshotHasItems, sessionDurationMinutes]);

  useEffect(() => {
    if (sessionEndsAtMs === null || sessionOutcome !== null || showExtendPrompt) return;
    const tick = (): void => {
      setRemainingSeconds(Math.max(0, Math.ceil((sessionEndsAtMs - Date.now()) / 1000)));
    };
    tick();
    const intervalId = window.setInterval(tick, 1000);
    return () => window.clearInterval(intervalId);
  }, [sessionEndsAtMs, sessionOutcome, showExtendPrompt]);

  useEffect(() => {
    const syncGlobalSessionAction = (event: Event): void => {
      const detail = (event as CustomEvent<{ key?: string }>).detail;
      if (detail?.key !== sessionStorageKey) return;
      const snapshot = readStoredSessionState(sessionStorageKey);
      if (!snapshot) return;
      setSessionEndsAtMs(typeof snapshot.sessionEndsAtMs === "number" ? snapshot.sessionEndsAtMs : null);
      setRemainingSeconds(typeof snapshot.remainingSeconds === "number" ? snapshot.remainingSeconds : 0);
      setSessionOutcome(snapshot.sessionOutcome === "time_up" || snapshot.sessionOutcome === "completed" ? snapshot.sessionOutcome : null);
      setShowExtendPrompt(Boolean(snapshot.showExtendPrompt));
    };
    window.addEventListener(ACTIVE_SESSION_CHANGED_EVENT, syncGlobalSessionAction);
    return () => window.removeEventListener(ACTIVE_SESSION_CHANGED_EVENT, syncGlobalSessionAction);
  }, [sessionStorageKey]);

  useEffect(() => {
    if (!hasHydratedState) return;
    if (!items.length) {
      setIndex(0);
    } else if (index >= items.length) {
      setIndex(items.length - 1);
    }
  }, [hasHydratedState, index, items.length]);

  return {
    items,
    setItems,
    loading,
    error,
    setError,
    durationInput,
    setDurationInput,
    sessionDurationMinutes,
    setSessionDurationMinutes,
    sessionEndsAtMs,
    setSessionEndsAtMs,
    remainingSeconds,
    setRemainingSeconds,
    sessionOutcome,
    setSessionOutcome,
    index,
    setIndex,
    showPostReviewItem,
    setShowPostReviewItem,
    currentReviewCorrect,
    setCurrentReviewCorrect,
    showExtendPrompt,
    setShowExtendPrompt,
    sessionPlanToken,
    loadSession,
  };
}
