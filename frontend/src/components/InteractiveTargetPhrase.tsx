import { useI18n } from "../i18n";
import { useStudyLanguages } from "../studyLanguages";
import { FullScreenLoadingOverlay } from "./BlockingLoadingOverlay";
import DialogTurnText from "./DialogTurnText";
import NewItem from "./NewItem";
import DialogItemSavingModals from "./dialogs/DialogItemSavingModals";
import { useDialogItemSaving } from "./dialogs/useDialogItemSaving";

interface InteractiveTargetPhraseProps {
  className?: string;
  targetText: string;
  sourceText: string;
  hideTargetText?: boolean;
  dialogId?: number;
  turnIndex?: number;
  statusKeyPrefix: string;
}

export default function InteractiveTargetPhrase({
  className,
  targetText,
  sourceText,
  hideTargetText = false,
  dialogId,
  turnIndex,
  statusKeyPrefix,
}: InteractiveTargetPhraseProps): JSX.Element {
  const { t } = useI18n();
  const { sourceLanguage, targetLanguage } = useStudyLanguages();
  const {
    wordActionStatus,
    pendingWordAdd,
    addingWord,
    openedLinkedWord,
    isSaving,
    setPendingWordAdd,
    setOpenedLinkedWord,
    openLinkedWordItem,
    requestAddWordFromDialogToken,
    confirmAddWordFromDialog,
  } = useDialogItemSaving({ sourceLanguage, targetLanguage });

  return (
    <>
      <div className={className}>
        <DialogTurnText
          dialogId={dialogId ?? -1}
          turnIndex={turnIndex ?? -1}
          sourceText={sourceText}
          targetText={targetText}
          sourceLanguage={sourceLanguage}
          targetLanguage={targetLanguage}
          tokenStatus={wordActionStatus}
          statusKeyPrefix={statusKeyPrefix}
          hideTargetText={hideTargetText}
          showPhraseSelection={false}
          showSavingOverlay={false}
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
          <NewItem item={openedLinkedWord} readOnly onClose={() => setOpenedLinkedWord(null)} />
        )}
        onCancelWordAdd={() => setPendingWordAdd(null)}
        onConfirmWordAdd={() => void confirmAddWordFromDialog()}
      />
      <FullScreenLoadingOverlay loading={isSaving} message={t("loading.savingItem")} />
    </>
  );
}
