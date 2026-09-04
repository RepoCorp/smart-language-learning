import type { ReactNode } from "react";

import { useI18n } from "../../i18n";

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
  const { t } = useI18n();

  return (
    <>
      {pendingWordAdd && (
        <div className="blocking-modal-overlay" role="dialog" aria-modal="true">
          <div className="blocking-modal add-word-modal">
            <p className="add-word-modal-title"><strong>{t("newItem.wordAddTitle")}</strong></p>
            <p className="add-word-modal-word">{pendingWordAdd.target}</p>
            <p className="add-word-modal-meaning">
              {t("newItem.wordAddMeaning", { translation: pendingWordAdd.source })}
            </p>
            <p className="add-word-modal-type">
              <strong>{t("newItem.wordAddType", { type: pendingWordAdd.wordType })}</strong>
            </p>
            <p className="hint">{t("newItem.wordAddPrompt")}</p>
            <div className="actions">
              <button type="button" className="secondary-button" onClick={onCancelWordAdd} disabled={addingWord}>
                {t("newItem.wordAddCancel")}
              </button>
              <button type="button" onClick={onConfirmWordAdd} disabled={addingWord}>
                {addingWord ? t("newItem.wordAddSaving") : t("newItem.wordAddConfirmButton")}
              </button>
            </div>
          </div>
        </div>
      )}
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
