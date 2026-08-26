import { useCallback, useEffect, useRef, useState } from "react";

import { fetchSessionItem } from "../../api";
import type { SessionItem, SessionPlanItem, StudyLanguageCode } from "../../types";

function entryKey(entry: SessionPlanItem): string {
  return [
    entry.id,
    entry.mode,
    entry.direction || "",
    entry.repeatedAfterFailure ? "retry" : "",
    entry.repeatPracticeStep || "",
  ].join(":");
}

export function useSessionItemPayloads({
  entries,
  index,
  sourceLanguage,
  targetLanguage,
  planToken,
}: {
  entries: SessionPlanItem[];
  index: number;
  sourceLanguage: StudyLanguageCode;
  targetLanguage: StudyLanguageCode;
  planToken: number | null;
}): {
  currentItem: SessionItem | null;
  currentItemLoading: boolean;
  currentItemError: string;
} {
  const payloadCacheRef = useRef(new Map<string, SessionItem>());
  const pendingPayloadsRef = useRef(new Map<string, Promise<SessionItem>>());
  const [currentItem, setCurrentItem] = useState<SessionItem | null>(null);
  const [currentItemKey, setCurrentItemKey] = useState("");
  const [currentItemLoading, setCurrentItemLoading] = useState(false);
  const [currentItemError, setCurrentItemError] = useState("");
  const currentEntry = entries[index] || null;
  const currentEntryKey = currentEntry ? entryKey(currentEntry) : "";

  const loadPayload = useCallback((entry: SessionPlanItem): Promise<SessionItem> => {
    const key = entryKey(entry);
    const cached = payloadCacheRef.current.get(key);
    if (cached) {
      return Promise.resolve(cached);
    }
    const pending = pendingPayloadsRef.current.get(key);
    if (pending) {
      return pending;
    }
    const request = fetchSessionItem(entry, sourceLanguage, targetLanguage)
      .then((payload) => {
        payloadCacheRef.current.set(key, payload);
        return payload;
      })
      .finally(() => {
        pendingPayloadsRef.current.delete(key);
      });
    pendingPayloadsRef.current.set(key, request);
    return request;
  }, [sourceLanguage, targetLanguage]);

  useEffect(() => {
    payloadCacheRef.current.clear();
    pendingPayloadsRef.current.clear();
    setCurrentItem(null);
    setCurrentItemKey("");
    setCurrentItemError("");
  }, [planToken, sourceLanguage, targetLanguage]);

  useEffect(() => {
    let active = true;
    if (!currentEntry) {
      setCurrentItem(null);
      setCurrentItemKey("");
      setCurrentItemLoading(false);
      setCurrentItemError("");
      return () => {
        active = false;
      };
    }

    const cached = payloadCacheRef.current.get(currentEntryKey);
    if (cached) {
      setCurrentItem(cached);
      setCurrentItemKey(currentEntryKey);
      setCurrentItemLoading(false);
      setCurrentItemError("");
      return () => {
        active = false;
      };
    }

    setCurrentItem(null);
    setCurrentItemKey("");
    setCurrentItemLoading(true);
    setCurrentItemError("");
    void loadPayload(currentEntry)
      .then((payload) => {
        if (!active) return;
        setCurrentItem(payload);
        setCurrentItemKey(currentEntryKey);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setCurrentItemError(error instanceof Error ? error.message : "Failed to load session item");
      })
      .finally(() => {
        if (active) setCurrentItemLoading(false);
      });

    return () => {
      active = false;
    };
  }, [currentEntry, currentEntryKey, loadPayload]);

  useEffect(() => {
    const nextEntry = entries[index + 1];
    if (nextEntry) {
      void loadPayload(nextEntry).catch(() => {
        // The current item remains usable; retry when this entry becomes current.
      });
    }
  }, [entries, index, loadPayload]);

  return {
    // Avoid briefly remounting a review with the previous item's payload while the next one loads.
    currentItem: currentItemKey === currentEntryKey ? currentItem : null,
    currentItemLoading,
    currentItemError,
  };
}
