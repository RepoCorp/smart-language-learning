import { useI18n } from "../i18n";
import { useStudyLanguages } from "../studyLanguages";
import { FullScreenLoadingOverlay } from "./BlockingLoadingOverlay";
import DialogTurnText from "./DialogTurnText";
import LegacyItemView from "./LegacyItemView";
import DialogItemSavingModals from "../features/dialogs/components/DialogItemSavingModals";
import { useDialogItemSaving } from "../features/dialogs/components/useDialogItemSaving";

interface InteractiveTargetPhraseProps {
  className?: string;
  targetText: string;
  sourceText: string;
  hideTargetText?: boolean;
  dialogId?: number;
  turnIndex?: number;
  statusKeyPrefix: string;
  allowPhraseSaving?: boolean;
}

export default function InteractiveTargetPhrase({
  className,
  targetText,
  sourceText,
  hideTargetText = false,
  dialogId,
  turnIndex,
  statusKeyPrefix,
  allowPhraseSaving = false,
}: InteractiveTargetPhraseProps): JSX.Element {
  const { t } = useI18n();
  const { sourceLanguage, targetLanguage } = useStudyLanguages();
  const {
    wordActionStatus,
    phraseActionStatus,
    phraseActionError,
    pendingWordAdd,
    addingWord,
    openedLinkedWord,
    isSaving,
    setPendingWordAdd,
    setOpenedLinkedWord,
    openLinkedWordItem,
    requestAddWordFromDialogToken,
    confirmAddWordFromDialog,
    addWholeTurnPhraseFromDialog,
    wholeTurnPhraseKey,
  } = useDialogItemSaving({ sourceLanguage, targetLanguage });
  const phraseKey = wholeTurnPhraseKey(dialogId, turnIndex);

  return (
    <>
      <div className={className}>
        <DialogTurnText
          dialogId={dialogId}
          turnIndex={turnIndex}
          sourceText={sourceText}
          targetText={targetText}
          sourceLanguage={sourceLanguage}
          targetLanguage={targetLanguage}
          tokenStatus={wordActionStatus}
          statusKeyPrefix={statusKeyPrefix}
          hideTargetText={hideTargetText}
          showPhraseSelection={allowPhraseSaving}
          showSavingOverlay={allowPhraseSaving && !isSaving}
          wholePhraseSaveAction={allowPhraseSaving ? {
            onSave: () => addWholeTurnPhraseFromDialog(dialogId, { source_text: sourceText, target_text: targetText }, turnIndex),
            status: phraseActionStatus[phraseKey],
            error: phraseActionError[phraseKey],
          } : undefined}
          onOpenItem={openLinkedWordItem}
          onTokenClick={(key, token) => void requestAddWordFromDialogToken(
            key,
            token,
            token,
            dialogId,
            turnIndex,
            sourceText,
            targetText,
          )}
        />
      </div>
      <DialogItemSavingModals
        pendingWordAdd={pendingWordAdd}
        addingWord={addingWord}
        openedItemContent={openedLinkedWord && (
          <LegacyItemView item={openedLinkedWord} readOnly onClose={() => setOpenedLinkedWord(null)} />
        )}
        onCancelWordAdd={() => setPendingWordAdd(null)}
        onConfirmWordAdd={() => void confirmAddWordFromDialog()}
      />
      <FullScreenLoadingOverlay loading={isSaving} message={t("loading.savingItem")} />
    </>
  );
}
