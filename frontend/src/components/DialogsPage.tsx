import { useEffect, useState } from "react";

import {
  fetchContentDialogDetail,
  regenerateContentDialogAudio,
} from "../api";
import { useI18n } from "../i18n";
import { usePromptPreferences } from "../promptPreferences";
import { useStudyLanguages } from "../studyLanguages";
import type { ContentDialogRecord } from "../types";
import BlockingLoadingOverlay from "./BlockingLoadingOverlay";
import DialogsCatalogList from "./dialogs/DialogsCatalogList";
import DialogGlobalControls from "./dialogs/DialogGlobalControls";
import DialogItemSavingModals from "./dialogs/DialogItemSavingModals";
import NewItem from "./NewItem";
import useDialogPlaybackFocus from "./useDialogPlaybackFocus";
import DialogsFilterBar from "./dialogs/DialogsFilterBar";
import useDialogsCatalog, { mergeDialogRecord } from "./dialogs/useDialogsCatalog";
import useDialogTurnPlayback, { type DialogTurnAudioMode } from "./dialogs/useDialogTurnPlayback";
import { useDialogItemSaving } from "./dialogs/useDialogItemSaving";

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
  const {
    registerDialogRef,
    registerTurnRef,
    focusDialogTurn,
  } = useDialogPlaybackFocus();
  const hideDialogText = targetPromptMode === "audio" && !showDialogText;
  const {
    wordActionStatus,
    phraseActionStatus,
    phraseActionError,
    pendingWordAdd,
    addingWord,
    openedLinkedWord,
    loadingLinkedWord,
    isSaving,
    setPendingWordAdd,
    setOpenedLinkedWord,
    resetItemSaving,
    openLinkedWordItem,
    requestAddWordFromDialogToken,
    confirmAddWordFromDialog,
    addWholeTurnPhraseFromDialog,
    wholeTurnPhraseKey,
  } = useDialogItemSaving({ sourceLanguage, targetLanguage });

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

  useEffect(() => {
    setExpandedDialogId(null);
    resetItemSaving();
    stopCurrentPlayback();
  }, [search, topic, context, page]);

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
    <BlockingLoadingOverlay loading={isSaving} message={t("loading.savingItem")} fullScreen>
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
              token,
              token,
              dialogId,
              turnIndex,
              sourceText,
              targetText,
            ),
            playTurn: (dialogId, turnIndex, audioUrl, mode) => void playTurn(dialogId, turnIndex, audioUrl, mode),
            registerDialogRef,
            renderDialogActionButtons,
            wholeTurnPhraseKey,
          }}
          />
        </div>

        <DialogItemSavingModals
          pendingWordAdd={pendingWordAdd}
          addingWord={addingWord}
          openedItemContent={openedLinkedWord && <NewItem item={openedLinkedWord} readOnly onClose={() => setOpenedLinkedWord(null)} />}
          onCancelWordAdd={() => setPendingWordAdd(null)}
          onConfirmWordAdd={() => void confirmAddWordFromDialog()}
        />
      </main>
    </BlockingLoadingOverlay>
  );
}
