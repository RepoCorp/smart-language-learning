import { useEffect, useState } from "react";

import {
  fetchContentDialogDetail,
  fetchContentItemDetail,
  quickAddPhraseFromConversation,
  quickAddWordFromDialog,
  regenerateContentDialogAudio,
} from "../api";
import { useI18n } from "../i18n";
import { usePromptPreferences } from "../promptPreferences";
import { useStudyLanguages } from "../studyLanguages";
import type { ContentDialogRecord, SessionItem } from "../types";
import NewItem from "./NewItem";
import DialogsCatalogList from "./dialogs/DialogsCatalogList";
import DialogGlobalControls from "./dialogs/DialogGlobalControls";
import useDialogPlaybackFocus from "./useDialogPlaybackFocus";
import DialogsFilterBar from "./dialogs/DialogsFilterBar";
import useDialogsCatalog, { mergeDialogRecord } from "./dialogs/useDialogsCatalog";
import useDialogTurnPlayback, { type DialogTurnAudioMode } from "./dialogs/useDialogTurnPlayback";

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
  const [turnAudioMode, setTurnAudioMode] = useState<DialogTurnAudioMode>("natural");
  const [expandedDialogId, setExpandedDialogId] = useState<number | null>(null);
  const [loadingDialogId, setLoadingDialogId] = useState<number | null>(null);
  const [regeneratingAudioDialogId, setRegeneratingAudioDialogId] = useState<number | null>(null);
  const [wordActionStatus, setWordActionStatus] = useState<Record<string, WordActionStatus>>({});
  const [phraseActionStatus, setPhraseActionStatus] = useState<Record<string, WordActionStatus>>({});
  const [phraseActionError, setPhraseActionError] = useState<Record<string, string>>({});
  const [pendingWordAdd, setPendingWordAdd] = useState<PendingWordAdd | null>(null);
  const [addingWord, setAddingWord] = useState<boolean>(false);
  const [openedLinkedWord, setOpenedLinkedWord] = useState<SessionItem | null>(null);
  const [loadingLinkedWord, setLoadingLinkedWord] = useState<boolean>(false);
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

  const {
    dialogHasTurns,
    loadingTurnAudioKey,
    playingAll,
    playingDialogId,
    playingTurn,
    isPlaybackPaused,
    playAllDialogs,
    playSingleDialog,
    playTurn,
    stopCurrentPlayback,
    togglePlaybackPause,
  } = useDialogTurnPlayback({
    dialogs,
    setDialogs,
    sourceLanguage,
    targetLanguage,
    loadError: t("dialogs.error.load"),
    setError,
    ensureDialogDetail,
    upsertVisibleDialog,
    fetchAllFilteredDialogs,
    focusDialogTurn,
    setExpandedDialogId,
  });

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

  const regenerateDialogAudio = async (dialog: ContentDialogRecord): Promise<void> => {
    if (regeneratingAudioDialogId !== null) {
      return;
    }
    stopCurrentPlayback();
    setRegeneratingAudioDialogId(dialog.dialog_id);
    setError("");
    try {
      const refreshedDialog = await regenerateContentDialogAudio(
        dialog.dialog_id,
        sourceLanguage,
        targetLanguage,
        turnAudioMode,
      );
      upsertVisibleDialog(refreshedDialog);
      setExpandedDialogId(dialog.dialog_id);
    } catch {
      setError(t("manage.error.regenerateAudio"));
    } finally {
      setRegeneratingAudioDialogId(null);
    }
  };

  const hasPlayableDialogs = dialogs.some(dialogHasTurns);
  const renderDialogActionButtons = (dialog: ContentDialogRecord): JSX.Element => (
    <DialogGlobalControls
      dialog={dialog}
      hasTurns={dialogHasTurns(dialog)}
      isPaused={isPlaybackPaused}
      isPlaying={playingDialogId === dialog.dialog_id}
      loading={loadingDialogId === dialog.dialog_id}
      showText={showDialogText}
      targetPromptMode={targetPromptMode}
      turnAudioMode={turnAudioMode}
      regenerating={regeneratingAudioDialogId === dialog.dialog_id}
      onPlay={() => void playSingleDialog(dialog)}
      onTogglePause={togglePlaybackPause}
      onToggleText={() => setShowDialogText((value) => !value)}
      onToggleTurnAudioMode={() => setTurnAudioMode((current) => current === "natural" ? "clear" : "natural")}
      onCollapse={() => setExpandedDialogId(null)}
      onRegenerate={() => regenerateDialogAudio(dialog)}
    />
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
            <button type="button" className="secondary-button" onClick={togglePlaybackPause}>
              {isPlaybackPaused ? t("dialogs.resumeDialog") : t("dialogs.pauseDialog")}
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
            turnAudioMode,
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
            playTurn: (dialogId, turnIndex, audioUrl, mode) => void playTurn(dialogId, turnIndex, audioUrl, mode),
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
