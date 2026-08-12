import { useI18n } from "../../i18n";
import type { SessionItem } from "../../types";
import NewItem from "../NewItem";
import type { PendingWordAdd } from "./useSavedDialogInteractions";

type Props = {
  pendingWordAdd: PendingWordAdd | null;
  addingWord: boolean;
  openedLinkedWord: SessionItem | null;
  loadingLinkedWord: boolean;
  onClosePendingWordAdd: () => void;
  onConfirmWordAdd: () => Promise<void>;
  onCloseOpenedLinkedWord: () => void;
};

export default function SavedDialogModals({
  pendingWordAdd,
  addingWord,
  openedLinkedWord,
  loadingLinkedWord,
  onClosePendingWordAdd,
  onConfirmWordAdd,
  onCloseOpenedLinkedWord,
}: Props): JSX.Element {
  const { t } = useI18n();

  return (
    <>
      {pendingWordAdd && (
        <div className="blocking-modal-overlay" role="dialog" aria-modal="true">
          <div className="blocking-modal add-word-modal">
            <p className="add-word-modal-title"><strong>{t("newItem.wordAddTitle")}</strong></p>
            <p className="add-word-modal-word">{pendingWordAdd.target}</p>
            <p className="add-word-modal-meaning">{t("newItem.wordAddMeaning", { translation: pendingWordAdd.source })}</p>
            <p className="add-word-modal-type"><strong>{t("newItem.wordAddType", { type: pendingWordAdd.wordType })}</strong></p>
            {pendingWordAdd.note && <p className="hint">{t("newItem.wordAddNote", { note: pendingWordAdd.note })}</p>}
            <p className="hint">{t("newItem.wordAddPrompt")}</p>
            <div className="actions">
              <button type="button" className="secondary-button" onClick={onClosePendingWordAdd} disabled={addingWord}>{t("newItem.wordAddCancel")}</button>
              <button type="button" onClick={() => void onConfirmWordAdd()} disabled={addingWord}>{addingWord ? t("newItem.wordAddSaving") : t("newItem.wordAddConfirmButton")}</button>
            </div>
          </div>
        </div>
      )}
      {openedLinkedWord && (
        <div className="blocking-modal-overlay" role="dialog" aria-modal="true">
          <div className="blocking-modal words-item-modal"><NewItem item={openedLinkedWord} readOnly onClose={onCloseOpenedLinkedWord} /></div>
        </div>
      )}
      {loadingLinkedWord && <p className="hint">{t("session.loading")}</p>}
    </>
  );
}
