import { useEffect, useState } from "react";
import type { Dispatch, SetStateAction } from "react";

import {
  fetchContentDialogs,
  fetchContentTopicContexts,
  fetchContentTopics,
} from "../../api";
import { useI18n } from "../../i18n";
import type { ContentDialogRecord, StudyLanguageCode } from "../../types";

const DIALOGS_PAGE_SIZE = 20;

export function mergeDialogRecord(existing: ContentDialogRecord | null, incoming: ContentDialogRecord): ContentDialogRecord {
  if (!existing) {
    return incoming;
  }
  return {
    ...existing,
    ...incoming,
    turns: incoming.turns?.length ? incoming.turns : existing.turns,
    turn_count: incoming.turn_count ?? existing.turn_count,
  };
}

interface UseDialogsCatalogResult {
  dialogs: ContentDialogRecord[];
  setDialogs: Dispatch<SetStateAction<ContentDialogRecord[]>>;
  topics: string[];
  contexts: string[];
  search: string;
  topic: string;
  context: string;
  page: number;
  hasMore: boolean;
  loading: boolean;
  error: string;
  setError: Dispatch<SetStateAction<string>>;
  setSearch: (value: string) => void;
  setTopic: (value: string) => void;
  setContext: (value: string) => void;
  setPage: Dispatch<SetStateAction<number>>;
  fetchAllFilteredDialogs: () => Promise<ContentDialogRecord[]>;
}

export default function useDialogsCatalog(
  sourceLanguage: StudyLanguageCode,
  targetLanguage: StudyLanguageCode,
): UseDialogsCatalogResult {
  const { t } = useI18n();
  const [dialogs, setDialogs] = useState<ContentDialogRecord[]>([]);
  const [topics, setTopics] = useState<string[]>([]);
  const [contexts, setContexts] = useState<string[]>([]);
  const [search, setSearchValue] = useState("");
  const [topic, setTopicValue] = useState("");
  const [context, setContextValue] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void fetchContentTopics(sourceLanguage, targetLanguage)
      .then((payload) => {
        if (active) setTopics(payload.topics || []);
      })
      .catch(() => {
        if (active) setTopics([]);
      });
    return () => { active = false; };
  }, [sourceLanguage, targetLanguage]);

  useEffect(() => {
    let active = true;
    if (!topic) {
      setContexts([]);
      return () => { active = false; };
    }
    void fetchContentTopicContexts(topic, sourceLanguage, targetLanguage)
      .then((payload) => {
        if (active) setContexts(payload.contexts || []);
      })
      .catch(() => {
        if (active) setContexts([]);
      });
    return () => { active = false; };
  }, [topic, sourceLanguage, targetLanguage]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    void fetchContentDialogs(sourceLanguage, targetLanguage, page, DIALOGS_PAGE_SIZE, topic, context, search)
      .then((payload) => {
        if (!active) return;
        setDialogs((current) => payload.dialogs.map((dialog) => (
          mergeDialogRecord(current.find((entry) => entry.dialog_id === dialog.dialog_id) || null, dialog)
        )));
        setHasMore(Boolean(payload.has_more));
      })
      .catch(() => {
        if (!active) return;
        setDialogs([]);
        setHasMore(false);
        setError(t("dialogs.error.load"));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [sourceLanguage, targetLanguage, topic, context, search, page, t]);

  const setSearch = (value: string): void => {
    setSearchValue(value);
    setPage(1);
  };
  const setTopic = (value: string): void => {
    setTopicValue(value);
    setContextValue("");
    setPage(1);
  };
  const setContext = (value: string): void => {
    setContextValue(value);
    setPage(1);
  };
  const fetchAllFilteredDialogs = async (): Promise<ContentDialogRecord[]> => {
    const allDialogs: ContentDialogRecord[] = [];
    let currentPage = 1;
    let hasMorePages = true;
    while (hasMorePages) {
      const payload = await fetchContentDialogs(
        sourceLanguage, targetLanguage, currentPage, DIALOGS_PAGE_SIZE, topic, context, search,
      );
      allDialogs.push(...payload.dialogs);
      hasMorePages = Boolean(payload.has_more);
      currentPage = payload.next_page || currentPage + 1;
    }
    return allDialogs;
  };

  return {
    dialogs, setDialogs, topics, contexts, search, topic, context, page, hasMore, loading, error, setError,
    setSearch, setTopic, setContext, setPage, fetchAllFilteredDialogs,
  };
}
