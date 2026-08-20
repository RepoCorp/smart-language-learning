import type { SessionPlanItem, StudyLanguageCode } from "../../types";

export const ACTIVE_SESSION_CHANGED_EVENT = "sll:active-session-changed";

export type StoredSessionState = {
  durationInput: string;
  sessionDurationMinutes: number | null;
  sessionEndsAtMs: number | null;
  remainingSeconds: number;
  sessionOutcome: "time_up" | "completed" | null;
  index: number;
  items: SessionPlanItem[];
  showPostReviewItem: boolean;
  currentReviewCorrect: boolean | null;
  showExtendPrompt: boolean;
};

type StoredSessionSnapshot = Partial<StoredSessionState> & {
  showIncorrectReviewItem?: boolean;
};

export function activeSessionStorageKey(
  sourceLanguage: StudyLanguageCode,
  targetLanguage: StudyLanguageCode,
): string {
  return `active_session_${sourceLanguage}_${targetLanguage}`;
}

export function readStoredSessionState(key: string): StoredSessionSnapshot | null {
  const raw = window.sessionStorage.getItem(key);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as StoredSessionSnapshot;
  } catch {
    window.sessionStorage.removeItem(key);
    return null;
  }
}

export function writeStoredSessionState(
  key: string,
  snapshot: StoredSessionSnapshot,
  notify = false,
): void {
  window.sessionStorage.setItem(key, JSON.stringify(snapshot));
  if (notify) {
    window.dispatchEvent(new CustomEvent(ACTIVE_SESSION_CHANGED_EVENT, { detail: { key } }));
  }
}

export function updateStoredSessionState(
  key: string,
  update: (snapshot: StoredSessionSnapshot) => StoredSessionSnapshot,
  notify = false,
): StoredSessionSnapshot | null {
  const current = readStoredSessionState(key);
  if (!current) {
    return null;
  }
  const next = update(current);
  writeStoredSessionState(key, next, notify);
  return next;
}
