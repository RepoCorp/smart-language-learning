import WordAddConfirmation from "../../../dialogs/components/WordAddConfirmation";
import { useI18n } from "../../../../i18n";
import type { SessionItem } from "../../../../types";
import NewItem from "../../../../components/NewItem";
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
      {pendingWordAdd && <WordAddConfirmation item={pendingWordAdd} saving={addingWord} onCancel={onClosePendingWordAdd} onConfirm={() => void onConfirmWordAdd()} />}
      {openedLinkedWord && (
        <div className="blocking-modal-overlay" role="dialog" aria-modal="true">
          <div className="blocking-modal words-item-modal"><NewItem item={openedLinkedWord} readOnly onClose={onCloseOpenedLinkedWord} /></div>
        </div>
      )}
      {loadingLinkedWord && <p className="hint">{t("session.loading")}</p>}
    </>
  );
}
