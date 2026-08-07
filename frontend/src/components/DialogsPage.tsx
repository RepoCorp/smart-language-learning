import { useEffect, useRef, useState } from "react";

import {
  fetchContentDialogDetail,
  fetchContentItemDetail,
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
import NewItem from "./NewItem";
import DialogsCatalogList from "./dialogs/DialogsCatalogList";
import useDialogPlaybackFocus from "./useDialogPlaybackFocus";
import DialogsFilterBar from "./dialogs/DialogsFilterBar";
import useDialogsCatalog, { mergeDialogRecord } from "./dialogs/useDialogsCatalog";

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

export default function DialogsPage(): JSX.Element {
  const { t } = useI18n();
  const { targetPromptMode, showMobileActionLabels } = usePromptPreferences();
  const { sourceLanguage, targetLanguage } = useStudyLanguages();
  const {
    dialogs,
    setDialogs,
    topics,
    contexts,
    search,
    topic,
    context,
    level,
    page,
    hasMore,
    loading,
    error,
    setError,
    setSearch,
    setTopic,
    setContext,
    setLevel,
    setPage,
    fetchAllFilteredDialogs,
  } = useDialogsCatalog(sourceLanguage, targetLanguage);
  const [showDialogText, setShowDialogText] = useState<boolean>(targetPromptMode === "text");
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
    focusDialogTurn(dialogId, 0, setExpandedDialogId);
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
        plural_german: detail.plural_german || "",
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
    setExpandedDialogId(null);
    setWordActionStatus({});
    setPhraseActionStatus({});
    setPhraseActionError({});
    setPendingWordAdd(null);
    stopCurrentPlayback();
  }, [search, topic, context, page]);

  useEffect(() => () => stopCurrentPlayback(), []);

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
  const renderDialogActionButtons = (dialog: ContentDialogRecord): JSX.Element => (
    <>
      <div className="item-action-group" aria-label={t("newItem.actionGroupExplore")}>
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
        <button
          type="button"
          className="secondary-button exercise-action-icon-button dialog-list-action-button"
          onClick={() => setExpandedDialogId(null)}
          aria-label={t("dialogs.hideDialog")}
          title={t("dialogs.hideDialog")}
          data-mobile-label={t("dialogs.hideDialog")}
        >
          <DialogActionIcon name="collapse" />
        </button>
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
        <DialogsFilterBar
          search={search}
          topic={topic}
          context={context}
          level={level}
          topics={topics}
          contexts={contexts}
          loading={loading}
          onSearchChange={setSearch}
          onTopicChange={setTopic}
          onContextChange={setContext}
          onLevelChange={setLevel}
        />
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
        <DialogsCatalogList
          state={{
            activeDialogId: expandedDialogId,
            dialogs,
            error,
            hasMore,
            hideTargetText: hideDialogText,
            loading,
            loadingDialogId,
            loadingTurnAudioKey,
            page,
            playingAll,
            playingDialogId,
            playingTurn,
            phraseActionError,
            phraseActionStatus,
            sourceLanguage,
            targetLanguage,
            wordActionStatus,
          }}
          actions={{
            addWholeTurnPhrase: (dialogId, turn, turnIndex) => void addWholeTurnPhraseFromDialog(dialogId, turn, turnIndex),
            activateDialog: (dialogId) => void toggleDialogExpanded(dialogId),
            getTurnRef: (dialogId, turnIndex, element) => registerTurnRef(dialogId, turnIndex, element),
            onNextPage: () => setPage((current) => current + 1),
            onOpenItem: openLinkedWordItem,
            onPreviousPage: () => setPage((current) => Math.max(1, current - 1)),
            onTokenClick: (dialogId, statusKey, token, turnIndex, sourceText, targetText) => void requestAddWordFromDialogToken(
              statusKey,
              dialogId,
              turnIndex,
              sourceText,
              targetText,
              token,
            ),
            playTurn: (dialogId, turnIndex, audioUrl) => void playTurn(dialogId, turnIndex, audioUrl),
            registerDialogRef,
            renderDialogActionButtons,
            wholeTurnPhraseKey,
          }}
        />
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
