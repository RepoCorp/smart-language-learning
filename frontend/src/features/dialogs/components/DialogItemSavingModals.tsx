import WordAddConfirmation from "./WordAddConfirmation";
import type { ReactNode } from "react";


import type { PendingWordAdd } from "./useDialogItemSaving";

export default function DialogItemSavingModals({
  pendingWordAdd,
  addingWord,
  openedItemContent,
  onCancelWordAdd,
  onConfirmWordAdd,
}: {
  pendingWordAdd: PendingWordAdd | null;
  addingWord: boolean;
  openedItemContent: ReactNode;
  onCancelWordAdd: () => void;
  onConfirmWordAdd: () => void;
}): JSX.Element {

  return (
    <>
      {pendingWordAdd && <WordAddConfirmation item={pendingWordAdd} saving={addingWord} onCancel={onCancelWordAdd} onConfirm={onConfirmWordAdd} />}
      {openedItemContent && (
        <div className="blocking-modal-overlay" role="dialog" aria-modal="true">
          <div className="blocking-modal words-item-modal">
            {openedItemContent}
          </div>
        </div>
      )}
    </>
  );
}
