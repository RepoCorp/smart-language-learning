import { useI18n } from "../i18n";
import DangerousButton from "./DangerousButton";

type Props = {
  open: boolean;
  isWord: boolean;
  isLearned: boolean;
  activeAction: string | null;
  message: string;
  error: string;
  onClose: () => void;
  onRegenerateItem: () => Promise<void>;
  onRescanDialogs: () => Promise<void>;
  onRegenerateAudio: () => Promise<void>;
  onToggleLearned: () => Promise<void>;
  onDelete: () => Promise<void>;
};

export default function ItemAdminActionsModal({
  open,
  isWord,
  isLearned,
  activeAction,
  message,
  error,
  onClose,
  onRegenerateItem,
  onRescanDialogs,
  onRegenerateAudio,
  onToggleLearned,
  onDelete,
}: Props): JSX.Element | null {
  const { t } = useI18n();
  if (!open) {
    return null;
  }
  const busy = activeAction !== null;

  return (
    <div className="blocking-modal-overlay" role="dialog" aria-modal="true">
      <div className="blocking-modal related-dialogs-modal item-admin-actions-modal">
        <button type="button" className="modal-corner-close" aria-label={t("newItem.closeRelatedDialogs")} onClick={onClose}>
          ×
        </button>
        <h3>Item actions</h3>
        <div className="item-admin-actions-list">
          <DangerousButton className="secondary-button dangerous-action-button" onConfirm={onRegenerateItem} disabled={busy}>
            {activeAction === "regenerate" ? t("newItem.itemRegenerating") : t("newItem.regenerateItem")}
          </DangerousButton>
          {isWord && (
            <DangerousButton className="secondary-button dangerous-action-button" onConfirm={onRescanDialogs} disabled={busy}>
              {activeAction === "rescan" ? t("newItem.wordRefreshRunning") : t("newItem.wordRefresh")}
            </DangerousButton>
          )}
          <DangerousButton className="secondary-button dangerous-action-button" onConfirm={onRegenerateAudio} disabled={busy}>
            {activeAction === "audio" ? t("manage.regeneratingAudio") : t("manage.regenerateAudio")}
          </DangerousButton>
          <DangerousButton className="secondary-button dangerous-action-button" onConfirm={onToggleLearned} disabled={busy}>
            {activeAction === "learned" ? t("content.saving") : isLearned ? t("manage.unmarkLearned") : t("manage.markLearned")}
          </DangerousButton>
          <DangerousButton className="secondary-button dangerous-action-button" onConfirm={onDelete} disabled={busy}>
            {activeAction === "delete" ? t("manage.deleting") : t("manage.deleteItem")}
          </DangerousButton>
        </div>
        {message && <p className="hint">{message}</p>}
        {error && <p className="error">{error}</p>}
      </div>
    </div>
  );
}
