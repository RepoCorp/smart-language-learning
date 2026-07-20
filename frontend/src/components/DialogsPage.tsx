import { useEffect, useRef, useState } from "react";

import {
  fetchContentDialogDetail,
  fetchContentDialogs,
  fetchContentItemDetail,
  fetchContentTopicContexts,
  fetchContentTopics,
  generateContentDialogTurnAudio,
  quickAddPhraseFromConversation,
  quickAddWordFromDialog,
  regenerateContentDialogAudio,
} from "../api";
import { useI18n } from "../i18n";
import { usePromptPreferences } from "../promptPreferences";
import { useStudyLanguages } from "../studyLanguages";
import type { ContentDialogRecord, SessionItem } from "../types";
import DangerousButton from "./DangerousButton";
import DialogActionIcon from "./DialogActionIcon";
import DialogTurnsList from "./DialogTurnsList";
import NewItem from "./NewItem";
import useDialogPlaybackFocus from "./useDialogPlaybackFocus";

type WordActionStatus = "idle" | "saving" | "added" | "exists" | "error";
type PendingWordAdd = {
  key: string;
  source: string;
  target: string;
  wordType: string;
  dialogId: number;
  turnIndex: number;
  sourceLine: string;
  targetLine: string;
  clickedTargetToken: string;
  note: string;
};

type PlayingTurn = {
  dialogId: number;
  turnIndex: number;
};

const DIALOGS_PAGE_SIZE = 20;
const ALL_TOPICS_OPTION = "";
const ALL_CONTEXTS_OPTION = "";

function mergeDialogRecord(existing: ContentDialogRecord | null, incoming: ContentDialogRecord): ContentDialogRecord {
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

function mergeDialogList(current: ContentDialogRecord[], incoming: ContentDialogRecord[]): ContentDialogRecord[] {
  const existingById = new Map(current.map((dialog) => [dialog.dialog_id, dialog]));
  return incoming.map((dialog) => mergeDialogRecord(existingById.get(dialog.dialog_id) || null, dialog));
}

export default function DialogsPage(): JSX.Element {
  const { t } = useI18n();
  const { targetPromptMode, showMobileActionLabels } = usePromptPreferences();
  const { sourceLanguage, targetLanguage } = useStudyLanguages();
  const [dialogs, setDialogs] = useState<ContentDialogRecord[]>([]);
  const [availableTopics, setAvailableTopics] = useState<string[]>([]);
  const [availableContexts, setAvailableContexts] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [page, setPage] = useState<number>(1);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [topicFilter, setTopicFilter] = useState<string>("");
  const [contextFilter, setContextFilter] = useState<string>("");
  const [showDialogText, setShowDialogText] = useState<boolean>(targetPromptMode === "text");
  const [selectedDialogId, setSelectedDialogId] = useState<number | null>(null);
  const [playingAll, setPlayingAll] = useState<boolean>(false);
  const [playingDialogId, setPlayingDialogId] = useState<number | null>(null);
  const [playingTurn, setPlayingTurn] = useState<PlayingTurn | null>(null);
  const [expandedDialogId, setExpandedDialogId] = useState<number | null>(null);
  const [loadingDialogId, setLoadingDialogId] = useState<number | null>(null);
  const [regeneratingAudioDialogId, setRegeneratingAudioDialogId] = useState<number | null>(null);
  const [loadingTurnAudioKey, setLoadingTurnAudioKey] = useState<string>("");
  const [wordActionStatus, setWordActionStatus] = useState<Record<string, WordActionStatus>>({});
  const [phraseActionStatus, setPhraseActionStatus] = useState<Record<string, WordActionStatus>>({});
  const [phraseActionError, setPhraseActionError] = useState<Record<string, string>>({});
  const [pendingWordAdd, setPendingWordAdd] = useState<PendingWordAdd | null>(null);
  const [addingWord, setAddingWord] = useState<boolean>(false);
  const [openedLinkedWord, setOpenedLinkedWord] = useState<SessionItem | null>(null);
  const [loadingLinkedWord, setLoadingLinkedWord] = useState<boolean>(false);
  const playbackRunRef = useRef<number>(0);
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);
  const {
    registerDialogRef,
    registerTurnRef,
    focusDialogTurn,
  } = useDialogPlaybackFocus();
  const cleanToken = (value: string): string => value.replace(/^[^A-Za-zÀ-ÖØ-öø-ÿ]+|[^A-Za-zÀ-ÖØ-öø-ÿ]+$/g, "").trim();
  const hideDialogText = targetPromptMode === "audio" && !showDialogText;

  useEffect(() => {
    setShowDialogText(targetPromptMode === "text");
  }, [targetPromptMode]);

  useEffect(() => {
    let active = true;
    const loadTopics = async (): Promise<void> => {
      try {
        const payload = await fetchContentTopics(sourceLanguage, targetLanguage);
        if (!active) {
          return;
        }
        setAvailableTopics(payload.topics || []);
      } catch {
        if (!active) {
          return;
        }
        setAvailableTopics([]);
      }
    };
    void loadTopics();
    return () => {
      active = false;
    };
  }, [sourceLanguage, targetLanguage]);

  useEffect(() => {
    let active = true;
    const loadContexts = async (): Promise<void> => {
      if (!topicFilter) {
        setAvailableContexts([]);
        setContextFilter(ALL_CONTEXTS_OPTION);
        return;
      }
      try {
        const payload = await fetchContentTopicContexts(topicFilter, sourceLanguage, targetLanguage);
        if (!active) {
          return;
        }
        setAvailableContexts(payload.contexts || []);
      } catch {
        if (!active) {
          return;
        }
        setAvailableContexts([]);
      }
    };
    void loadContexts();
    return () => {
      active = false;
    };
  }, [topicFilter, sourceLanguage, targetLanguage]);

  const fetchDialogsPage = async (pageNumber: number): Promise<void> => {
    const payload = await fetchContentDialogs(
      sourceLanguage,
      targetLanguage,
      pageNumber,
      DIALOGS_PAGE_SIZE,
      topicFilter,
      contextFilter,
    );
    const nextDialogs = payload.dialogs || [];
    setDialogs((current) => mergeDialogList(current, nextDialogs));
    setSelectedDialogId((current) => {
      if (current !== null && nextDialogs.some((dialog) => dialog.dialog_id === current)) {
        return current;
      }
      return nextDialogs[0]?.dialog_id ?? null;
    });
    setHasMore(Boolean(payload.has_more));
  };

  const fetchAllFilteredDialogs = async (): Promise<ContentDialogRecord[]> => {
    const allDialogs: ContentDialogRecord[] = [];
    let currentPage = 1;
    let hasMorePages = true;
    while (hasMorePages) {
      const payload = await fetchContentDialogs(
        sourceLanguage,
        targetLanguage,
        currentPage,
        DIALOGS_PAGE_SIZE,
        topicFilter,
        contextFilter,
      );
      allDialogs.push(...(payload.dialogs || []));
      hasMorePages = Boolean(payload.has_more);
      currentPage = payload.next_page || (currentPage + 1);
    }
    return allDialogs;
  };

  const upsertVisibleDialog = (dialog: ContentDialogRecord): void => {
    setDialogs((current) => {
      const existingIndex = current.findIndex((entry) => entry.dialog_id === dialog.dialog_id);
      if (existingIndex >= 0) {
        return current.map((entry, index) => (
          index === existingIndex ? mergeDialogRecord(entry, dialog) : entry
        ));
      }
      return [dialog, ...current];
    });
  };

  const ensureDialogDetail = async (
    dialogId: number,
    initialDialog: ContentDialogRecord | null = null,
  ): Promise<ContentDialogRecord | null> => {
    if (initialDialog) {
      upsertVisibleDialog(initialDialog);
    }
    const existing = dialogs.find((dialog) => dialog.dialog_id === dialogId);
    if (existing?.turns?.length) {
      return existing;
    }
    setLoadingDialogId(dialogId);
    try {
      const detail = await fetchContentDialogDetail(dialogId, sourceLanguage, targetLanguage);
      upsertVisibleDialog(detail);
      return detail;
    } catch {
      setError(t("dialogs.error.load"));
      return null;
    } finally {
      setLoadingDialogId((current) => (current === dialogId ? null : current));
    }
  };

  const toggleDialogExpanded = async (dialogId: number): Promise<void> => {
    if (expandedDialogId === dialogId) {
      setExpandedDialogId(null);
      return;
    }
    const detail = await ensureDialogDetail(dialogId);
    if (!detail) {
      return;
    }
    setExpandedDialogId(dialogId);
  };

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

  const openLinkedWordItem = async (itemId: number): Promise<void> => {
    setLoadingLinkedWord(true);
    try {
      const detail = await fetchContentItemDetail(itemId, sourceLanguage, targetLanguage);
      setOpenedLinkedWord({
        id: detail.id,
        item_type: detail.item_type,
        spanish_text: detail.spanish_text,
        german_text: detail.german_text,
        example_sentence: detail.example_sentence || "",
        notes: detail.notes || "",
        word_type: detail.word_type || "",
        audio_url: detail.audio_url || "",
        exercise_phrases: detail.exercise_phrases || {},
        mode: "new",
        direction: null,
        options: [],
        dialog_phrase_answer: detail.dialog_phrase_answer || "",
        dialog_phrase_scene: detail.dialog_phrase_scene || "",
        dialog_phrase_scene_audio_urls: detail.dialog_phrase_scene_audio_urls || [],
        dialog_phrase_options: detail.dialog_phrase_options || [],
        dialog_phrase_turns: detail.dialog_phrase_turns || [],
        dialog_phrase_odd_index: detail.dialog_phrase_odd_index ?? null,
        related_dialogs: detail.related_dialogs || [],
        compare_words: detail.compare_words || [],
        compare_words_insights: detail.compare_words_insights || "",
        item_questions: detail.item_questions || [],
      });
    } finally {
      setLoadingLinkedWord(false);
    }
  };

  useEffect(() => {
    let active = true;
    const load = async (): Promise<void> => {
      setLoading(true);
      setError("");
      setExpandedDialogId(null);
      setWordActionStatus({});
      setPhraseActionStatus({});
      setPhraseActionError({});
      setPendingWordAdd(null);
      stopCurrentPlayback();
      try {
        await fetchDialogsPage(page);
        if (!active) {
          return;
        }
      } catch {
        if (active) {
          setDialogs([]);
          setHasMore(false);
          setError(t("dialogs.error.load"));
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };
    void load();
    return () => {
      active = false;
      stopCurrentPlayback();
    };
  }, [sourceLanguage, targetLanguage, topicFilter, contextFilter, page]);

  const requestAddWordFromDialogToken = async (
    key: string,
    dialogId: number,
    turnIndex: number,
    sourceLine: string,
    targetLine: string,
    targetTokenRaw: string,
  ): Promise<void> => {
    const targetToken = cleanToken(targetTokenRaw);
    if (!targetToken) {
      return;
    }

    setWordActionStatus((current) => ({ ...current, [key]: "saving" }));
    try {
      const check = await quickAddWordFromDialog(
        targetToken,
        targetToken,
        sourceLanguage,
        targetLanguage,
        dialogId,
        turnIndex,
        true,
        sourceLine,
        targetLine,
        targetToken,
      );
      if (check.exists) {
        if (!check.id) {
          setWordActionStatus((current) => ({ ...current, [key]: "error" }));
          return;
        }
        await openLinkedWordItem(check.id);
        setWordActionStatus((current) => ({ ...current, [key]: "exists" }));
        return;
      }
      setWordActionStatus((current) => ({ ...current, [key]: "idle" }));
      const resolvedWordType = String(check.word_type || "").trim();
      if (!resolvedWordType) {
        setWordActionStatus((current) => ({ ...current, [key]: "error" }));
        return;
      }
      setPendingWordAdd({
        key,
        source: check.source_text || targetToken,
        target: check.target_text || targetToken,
        wordType: resolvedWordType,
        dialogId,
        turnIndex,
        sourceLine,
        targetLine,
        clickedTargetToken: targetToken,
        note: check.notes || "",
      });
    } catch {
      setWordActionStatus((current) => ({ ...current, [key]: "error" }));
    }
  };

  const confirmAddWordFromDialog = async (): Promise<void> => {
    if (!pendingWordAdd || addingWord) {
      return;
    }

    const { key, source, target, dialogId, turnIndex, sourceLine, targetLine, clickedTargetToken } = pendingWordAdd;
    setWordActionStatus((current) => ({ ...current, [key]: "saving" }));
    setAddingWord(true);
    try {
      const resultPayload = await quickAddWordFromDialog(
        source,
        target,
        sourceLanguage,
        targetLanguage,
        dialogId,
        turnIndex,
        false,
        sourceLine,
        targetLine,
        clickedTargetToken,
      );
      if (resultPayload.exists) {
        if (!resultPayload.id) {
          setWordActionStatus((current) => ({ ...current, [key]: "error" }));
          return;
        }
        await openLinkedWordItem(resultPayload.id);
      }
      setWordActionStatus((current) => ({ ...current, [key]: resultPayload.created ? "added" : "exists" }));
    } catch {
      setWordActionStatus((current) => ({ ...current, [key]: "error" }));
    } finally {
      setAddingWord(false);
      setPendingWordAdd(null);
    }
  };

  const wholeTurnPhraseKey = (dialogId: number, turnIndex: number): string => `dialog-${dialogId}-turn-${turnIndex}-whole-phrase`;

  const addWholeTurnPhraseFromDialog = async (
    dialogId: number,
    turn: { source_text: string; target_text: string; speaker?: "a" | "b"; phrase_audio_url?: string },
    turnIndex: number,
  ): Promise<void> => {
    if (!turn.source_text.trim() || !turn.target_text.trim()) {
      return;
    }
    const statusKey = wholeTurnPhraseKey(dialogId, turnIndex);
    setPhraseActionStatus((current) => ({ ...current, [statusKey]: "saving" }));
    setPhraseActionError((current) => ({ ...current, [statusKey]: "" }));
    try {
      const resultPayload = await quickAddPhraseFromConversation(
        turn.source_text,
        turn.target_text,
        sourceLanguage,
        targetLanguage,
        false,
        dialogId,
        turnIndex,
        turn.source_text,
        turn.target_text,
      );
      if (resultPayload.id) {
        await openLinkedWordItem(resultPayload.id);
      }
      setPhraseActionStatus((current) => ({ ...current, [statusKey]: resultPayload.created ? "added" : "exists" }));
    } catch (error) {
      setPhraseActionStatus((current) => ({ ...current, [statusKey]: "error" }));
      setPhraseActionError((current) => ({
        ...current,
        [statusKey]: error instanceof Error && error.message ? error.message : t("newItem.sentenceAddError"),
      }));
    }
  };

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
      void audio.play().catch(() => done());
    });

  const updateTurnAudioUrl = (dialogId: number, turnIndex: number, audioUrl: string): void => {
    setDialogs((current) => current.map((dialog) => {
      if (dialog.dialog_id !== dialogId) {
        return dialog;
      }
      return {
        ...dialog,
        turns: dialog.turns.map((turn, index) => (
          index === turnIndex ? { ...turn, phrase_audio_url: audioUrl } : turn
        )),
      };
    }));
  };

  const ensureTurnAudioUrl = async (dialogId: number, turnIndex: number, currentAudioUrl = ""): Promise<string> => {
    if (currentAudioUrl) {
      return currentAudioUrl;
    }
    const key = `${dialogId}:${turnIndex}`;
    setLoadingTurnAudioKey(key);
    try {
      const audioUrl = await generateContentDialogTurnAudio(dialogId, turnIndex, sourceLanguage, targetLanguage);
      if (audioUrl) {
        updateTurnAudioUrl(dialogId, turnIndex, audioUrl);
      }
      return audioUrl;
    } catch {
      setError(t("dialogs.error.load"));
      return "";
    } finally {
      setLoadingTurnAudioKey((current) => (current === key ? "" : current));
    }
  };

  const playTurn = async (dialogId: number, turnIndex: number, currentAudioUrl = ""): Promise<void> => {
    stopCurrentPlayback();
    const audioUrl = await ensureTurnAudioUrl(dialogId, turnIndex, currentAudioUrl);
    if (!audioUrl) {
      return;
    }
    playbackRunRef.current += 1;
    const runId = playbackRunRef.current;
    setSelectedDialogId(dialogId);
    setPlayingDialogId(dialogId);
    setPlayingTurn({ dialogId, turnIndex });
    await playAudioUrl(audioUrl, runId);
    if (runId === playbackRunRef.current) {
      setPlayingDialogId(null);
      setPlayingTurn(null);
    }
  };

  const dialogHasTurns = (dialog: ContentDialogRecord): boolean => Boolean(dialog.turn_count || dialog.turns?.length);

  const dialogIsPlayable = (dialog: ContentDialogRecord): boolean => dialogHasTurns(dialog);

  const playDialogWithFocusedTurns = async (dialog: ContentDialogRecord, runId: number): Promise<void> => {
    upsertVisibleDialog(dialog);
    const detailedDialog = await ensureDialogDetail(dialog.dialog_id, dialog);
    if (!detailedDialog || runId !== playbackRunRef.current) {
      return;
    }
    setSelectedDialogId(detailedDialog.dialog_id);
    setPlayingDialogId(detailedDialog.dialog_id);
    if (detailedDialog.turns?.length) {
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
        const audioUrl = await ensureTurnAudioUrl(detailedDialog.dialog_id, index, detailedDialog.turns[index].phrase_audio_url || "");
        await playAudioUrl(audioUrl, runId);
      }
      return;
    }
  };

  const playSingleDialog = async (dialog: ContentDialogRecord): Promise<void> => {
    if (!dialogIsPlayable(dialog)) {
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

  const regenerateDialogAudio = async (dialog: ContentDialogRecord): Promise<void> => {
    if (regeneratingAudioDialogId !== null) {
      return;
    }
    setRegeneratingAudioDialogId(dialog.dialog_id);
    setError("");
    try {
      const refreshedDialog = await regenerateContentDialogAudio(dialog.dialog_id, sourceLanguage, targetLanguage);
      upsertVisibleDialog(refreshedDialog);
      setExpandedDialogId(dialog.dialog_id);
    } catch {
      setError(t("manage.error.regenerateAudio"));
    } finally {
      setRegeneratingAudioDialogId(null);
    }
  };

  const playAllDialogs = async (): Promise<void> => {
    stopCurrentPlayback();
    playbackRunRef.current += 1;
    const runId = playbackRunRef.current;
    setPlayingAll(true);
    setError("");

    try {
      const allFilteredDialogs = await fetchAllFilteredDialogs();
      const playableDialogs = allFilteredDialogs.filter(dialogIsPlayable);
      if (!playableDialogs.length || runId !== playbackRunRef.current) {
        return;
      }
      const shuffledDialogs = [...playableDialogs];
      for (let index = shuffledDialogs.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        [shuffledDialogs[index], shuffledDialogs[swapIndex]] = [shuffledDialogs[swapIndex], shuffledDialogs[index]];
      }

      for (const dialog of shuffledDialogs) {
        if (runId !== playbackRunRef.current) {
          break;
        }
        await playDialogWithFocusedTurns(dialog, runId);
      }
    } catch {
      setError(t("dialogs.error.load"));
    } finally {
      if (runId === playbackRunRef.current) {
        setPlayingAll(false);
        setPlayingDialogId(null);
        setPlayingTurn(null);
      }
    }
  };

  const hasPlayableDialogs = dialogs.some(dialogIsPlayable);
  const selectedDialog = selectedDialogId === null
    ? null
    : dialogs.find((dialog) => dialog.dialog_id === selectedDialogId) || null;

  const renderDialogActionButtons = (dialog: ContentDialogRecord): JSX.Element => (
    <>
      <div className="item-action-group" aria-label={t("newItem.actionGroupExplore")}>
        {!!(dialog.turn_count || dialog.turns?.length) && (
          <button
            type="button"
            className="secondary-button exercise-action-icon-button dialog-list-action-button"
            onClick={() => void toggleDialogExpanded(dialog.dialog_id)}
            disabled={loadingDialogId === dialog.dialog_id}
            aria-label={loadingDialogId === dialog.dialog_id
              ? t("dialogs.loading")
              : expandedDialogId === dialog.dialog_id ? t("dialogs.hideDialog") : t("dialogs.showDialog")}
            title={loadingDialogId === dialog.dialog_id
              ? t("dialogs.loading")
              : expandedDialogId === dialog.dialog_id ? t("dialogs.hideDialog") : t("dialogs.showDialog")}
            data-mobile-label={loadingDialogId === dialog.dialog_id
              ? t("dialogs.loading")
              : expandedDialogId === dialog.dialog_id ? t("dialogs.hideDialog") : t("dialogs.showDialog")}
            aria-pressed={expandedDialogId === dialog.dialog_id}
          >
            <DialogActionIcon name="dialog" />
          </button>
        )}
        {dialogHasTurns(dialog) ? (
          <button
            type="button"
            className="secondary-button exercise-action-icon-button dialog-list-action-button"
            onClick={() => {
              if (playingDialogId === dialog.dialog_id) {
                stopCurrentPlayback();
                return;
              }
              void playSingleDialog(dialog);
            }}
            disabled={loadingDialogId === dialog.dialog_id}
            aria-label={playingDialogId === dialog.dialog_id ? t("dialogs.stopDialog") : t("dialogs.playDialog")}
            title={playingDialogId === dialog.dialog_id ? t("dialogs.stopDialog") : t("dialogs.playDialog")}
            data-mobile-label={playingDialogId === dialog.dialog_id ? t("dialogs.stopDialog") : t("dialogs.playDialog")}
          >
            <DialogActionIcon name={playingDialogId === dialog.dialog_id ? "stop" : "play"} />
          </button>
        ) : (
          <span className="manage-item-meta">{t("dialogs.noAudio")}</span>
        )}
        {targetPromptMode === "audio" && !!(dialog.turn_count || dialog.turns?.length) && (
          <button
            type="button"
            className="secondary-button exercise-action-icon-button dialog-list-action-button"
            onClick={() => setShowDialogText((value) => !value)}
            aria-label={showDialogText ? t("prompt.hideText") : t("prompt.showText")}
            title={showDialogText ? t("prompt.hideText") : t("prompt.showText")}
            data-mobile-label={showDialogText ? t("prompt.hideText") : t("prompt.showText")}
            aria-pressed={showDialogText}
          >
            <DialogActionIcon name="text" />
          </button>
        )}
      </div>
      {!!(dialog.turn_count || dialog.turns?.length) && (
        <div className="item-action-group item-action-group-danger" aria-label={t("newItem.actionGroupDanger")}>
          <DangerousButton
            type="button"
            className="secondary-button exercise-action-icon-button dialog-list-action-button"
            onConfirm={() => regenerateDialogAudio(dialog)}
            disabled={regeneratingAudioDialogId === dialog.dialog_id}
            aria-label={regeneratingAudioDialogId === dialog.dialog_id ? t("dialogs.loading") : t("manage.regenerateAudio")}
            title={regeneratingAudioDialogId === dialog.dialog_id ? t("dialogs.loading") : t("manage.regenerateAudio")}
            data-mobile-label={regeneratingAudioDialogId === dialog.dialog_id ? t("dialogs.loading") : t("manage.regenerateAudio")}
          >
            <DialogActionIcon name="refresh" />
          </DangerousButton>
        </div>
      )}
    </>
  );

  return (
    <main className="container" data-testid="dialogs-page">
      <h1>{t("dialogs.title")}</h1>
      <p>{t("dialogs.description")}</p>
      <section className="card">
        <label className="form-field">
          <span>{t("dialogs.topicFilter")}</span>
          <select
            value={topicFilter}
            onChange={(event) => {
              setTopicFilter(event.target.value);
              setContextFilter(ALL_CONTEXTS_OPTION);
              setPage(1);
            }}
            disabled={loading}
          >
            <option value={ALL_TOPICS_OPTION}>{t("dialogs.topicFilterPlaceholder")}</option>
            {availableTopics.map((topic) => (
              <option key={topic} value={topic}>{topic}</option>
            ))}
          </select>
        </label>
        <label className="form-field">
          <span>{t("dialogs.contextFilter")}</span>
          <select
            value={contextFilter}
            onChange={(event) => {
              setContextFilter(event.target.value);
              setPage(1);
            }}
            disabled={loading || !topicFilter}
          >
            <option value={ALL_CONTEXTS_OPTION}>{t("dialogs.contextFilterPlaceholder")}</option>
            {availableContexts.map((context) => (
              <option key={context} value={context}>{context}</option>
            ))}
          </select>
        </label>
        <div className="actions">
          {!playingAll ? (
            <button type="button" onClick={() => void playAllDialogs()} disabled={loading || !hasPlayableDialogs}>
              {t("dialogs.playAll")}
            </button>
          ) : (
            <button type="button" className="secondary-button" onClick={stopCurrentPlayback}>
              {t("dialogs.stopAll")}
            </button>
          )}
        </div>
      </section>
      <div className={showMobileActionLabels ? "mobile-action-labels-expanded" : undefined}>
        {selectedDialog && (
          <section className="card dialog-global-controls-card">
            <div className="dialog-global-controls-header">
              <strong className="dialog-list-topic">{selectedDialog.topic}</strong>
              <span className="dialog-list-context">{selectedDialog.context || t("dialogs.noContext")}</span>
              {playingDialogId === selectedDialog.dialog_id && (
                <span className="manage-item-meta">{t("dialogs.nowPlaying")}</span>
              )}
            </div>
            <div className="dialog-list-controls dialog-global-controls-row">
              {renderDialogActionButtons(selectedDialog)}
            </div>
          </section>
        )}
        {loading && <p className="hint">{t("dialogs.loading")}</p>}
        {error && <p className="error">{error}</p>}
        {!loading && !error && dialogs.length === 0 && <p className="hint">{t("dialogs.empty")}</p>}
        {!loading && dialogs.length > 0 && (
          <section className="card">
            <ul className="manage-list">
              {dialogs.map((dialog) => (
                <li
                  key={dialog.dialog_id}
                  ref={(element) => registerDialogRef(dialog.dialog_id, element)}
                  className={`related-dialog-card dialog-list-card ${playingDialogId === dialog.dialog_id ? "dialog-list-card-playing" : ""}`}
                  tabIndex={-1}
                >
                  <div className="dialog-list-row">
                    <div className="dialog-list-main">
                      <label className="dialog-select-control">
                        <input
                          type="radio"
                          name="active-dialog"
                          checked={selectedDialogId === dialog.dialog_id}
                          onChange={() => setSelectedDialogId(dialog.dialog_id)}
                        />
                      </label>
                      <strong className="dialog-list-topic">{dialog.topic}</strong>
                      <span className="dialog-list-context">{dialog.context || t("dialogs.noContext")}</span>
                      {playingAll && playingDialogId === dialog.dialog_id && (
                        <span className="manage-item-meta">{t("dialogs.nowPlaying")}</span>
                      )}
                    </div>
                  </div>
                  {!!(dialog.turn_count || dialog.turns?.length) && (
                    <>
                      {expandedDialogId === dialog.dialog_id && !!dialog.turns?.length && (
                        <>
                          <p><strong>{t("newItem.dialogTurns")}:</strong></p>
                          <DialogTurnsList
                            dialogId={dialog.dialog_id}
                            turns={dialog.turns}
                            sourceLanguage={sourceLanguage}
                            targetLanguage={targetLanguage}
                            hideTargetText={hideDialogText}
                            tokenStatus={wordActionStatus}
                            statusKeyPrefixBase="dialog"
                            onOpenItem={openLinkedWordItem}
                            onTokenClick={(statusKey, token, turnIndex, sourceText, targetText) => void requestAddWordFromDialogToken(
                              statusKey,
                              dialog.dialog_id,
                              turnIndex,
                              sourceText,
                              targetText,
                              token,
                            )}
                            getTurnRef={(turnIndex, element) => {
                              registerTurnRef(dialog.dialog_id, turnIndex, element);
                            }}
                            highlightedTurnIndex={playingTurn?.dialogId === dialog.dialog_id ? playingTurn.turnIndex : null}
                            renderLeadingAction={(turn, index) => (
                              <button
                                type="button"
                                className="secondary-button exercise-action-icon-button dialog-inline-action-button"
                                onClick={() => void playTurn(dialog.dialog_id, index, turn.phrase_audio_url || "")}
                                disabled={loadingTurnAudioKey === `${dialog.dialog_id}:${index}`}
                                aria-label={loadingTurnAudioKey === `${dialog.dialog_id}:${index}` ? t("dialogs.loading") : t("newItem.playTurnAudio")}
                                title={loadingTurnAudioKey === `${dialog.dialog_id}:${index}` ? t("dialogs.loading") : t("newItem.playTurnAudio")}
                              >
                                <DialogActionIcon name="play" />
                              </button>
                            )}
                            renderTurnActions={(turn, index) => {
                              const phraseKey = wholeTurnPhraseKey(dialog.dialog_id, index);
                              return (
                                <>
                                <button
                                  type="button"
                                  className="secondary-button"
                                  onClick={() => void addWholeTurnPhraseFromDialog(dialog.dialog_id, turn, index)}
                                  disabled={phraseActionStatus[phraseKey] === "saving"}
                                >
                                  {phraseActionStatus[phraseKey] === "saving"
                                    ? t("newItem.sentenceAddSaving")
                                    : t("content.preview.savePhrase")}
                                </button>
                                {phraseActionStatus[phraseKey] === "added" && (
                                  <span className="turn-token-status">{t("newItem.sentenceAddAdded")}</span>
                                )}
                                {phraseActionStatus[phraseKey] === "exists" && (
                                  <span className="turn-token-status">{t("newItem.sentenceAddExists")}</span>
                                )}
                                {phraseActionStatus[phraseKey] === "error" && (
                                  <span className="turn-token-status">
                                    {phraseActionError[phraseKey] || t("newItem.sentenceAddError")}
                                  </span>
                                )}
                              </>
                            );
                          }}
                        />
                        <div className="actions">
                          <button type="button" className="secondary-button" onClick={() => setExpandedDialogId(null)}>
                            {t("dialogs.hideDialog")}
                          </button>
                        </div>
                      </>
                    )}
                  </>
                )}
              </li>
            ))}
          </ul>
          <div className="actions">
            <button
              type="button"
              className="secondary-button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page <= 1 || loading}
            >
              {t("dialogs.previousPage")}
            </button>
            <span>{t("dialogs.pageLabel", { page })}</span>
            <button
              type="button"
              className="secondary-button"
              onClick={() => setPage((current) => current + 1)}
              disabled={!hasMore || loading}
            >
              {t("dialogs.nextPage")}
            </button>
          </div>
        </section>
      )}
      </div>

      {pendingWordAdd && (
        <div className="blocking-modal-overlay" role="dialog" aria-modal="true">
          <div className="blocking-modal add-word-modal">
            <p className="add-word-modal-title">
              <strong>{t("newItem.wordAddTitle")}</strong>
            </p>
            <p className="add-word-modal-word">{pendingWordAdd.target}</p>
            <p className="add-word-modal-meaning">
              {t("newItem.wordAddMeaning", { translation: pendingWordAdd.source })}
            </p>
            <p className="add-word-modal-type">
              <strong>{t("newItem.wordAddType", { type: pendingWordAdd.wordType })}</strong>
            </p>
            {pendingWordAdd.note && (
              <p className="hint">{t("newItem.wordAddNote", { note: pendingWordAdd.note })}</p>
            )}
            <p className="hint">{t("newItem.wordAddPrompt")}</p>
            <div className="actions">
              <button type="button" className="secondary-button" onClick={() => setPendingWordAdd(null)} disabled={addingWord}>
                {t("newItem.wordAddCancel")}
              </button>
              <button type="button" onClick={() => void confirmAddWordFromDialog()} disabled={addingWord}>
                {addingWord ? t("newItem.wordAddSaving") : t("newItem.wordAddConfirmButton")}
              </button>
            </div>
          </div>
        </div>
      )}
      {openedLinkedWord && (
        <div className="blocking-modal-overlay" role="dialog" aria-modal="true">
          <div className="blocking-modal words-item-modal">
            <NewItem item={openedLinkedWord} readOnly onClose={() => setOpenedLinkedWord(null)} />
          </div>
        </div>
      )}
      {loadingLinkedWord && <p className="hint">{t("session.loading")}</p>}
    </main>
  );
}
