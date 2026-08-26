import { useI18n } from "../../i18n";
import type { ContentDialogRecord } from "../../types";
import DangerousButton from "../DangerousButton";
import DialogActionIcon from "../DialogActionIcon";
import DialogTurnAudioModeButton from "./DialogTurnAudioModeButton";
import type { DialogTurnAudioMode } from "./useDialogTurnPlayback";

type Props = {
  dialog: ContentDialogRecord;
  hasTurns: boolean;
  isPaused: boolean;
  isPlaying: boolean;
  loading: boolean;
  showText: boolean;
  targetPromptMode: "audio" | "text";
  turnAudioMode: DialogTurnAudioMode;
  regenerating: boolean;
  deleting: boolean;
  onPlay: () => void;
  onTogglePause: () => void;
  onToggleText: () => void;
  onToggleTurnAudioMode: () => void;
  onCollapse: () => void;
  onRegenerate: () => void;
  onDelete: () => void;
};

export default function DialogGlobalControls({
  dialog,
  hasTurns,
  isPaused,
  isPlaying,
  loading,
  showText,
  targetPromptMode,
  turnAudioMode,
  regenerating,
  deleting,
  onPlay,
  onTogglePause,
  onToggleText,
  onToggleTurnAudioMode,
  onCollapse,
  onRegenerate,
  onDelete,
}: Props): JSX.Element {
  const { t } = useI18n();
  const playbackLabel = isPaused
    ? t("dialogs.resumeDialog")
    : t("dialogs.pauseDialog");

  return (
    <>
      <div className="item-action-group" aria-label={t("newItem.actionGroupExplore")}>
        {hasTurns ? (
          <button
            type="button"
            className="secondary-button exercise-action-icon-button dialog-list-action-button"
            onClick={isPlaying ? onTogglePause : onPlay}
            disabled={loading}
            aria-label={isPlaying ? playbackLabel : t("dialogs.playDialog")}
            title={isPlaying ? playbackLabel : t("dialogs.playDialog")}
            data-mobile-label={isPlaying ? playbackLabel : t("dialogs.playDialog")}
          >
            <DialogActionIcon name={isPlaying ? (isPaused ? "play" : "pause") : "play"} />
          </button>
        ) : (
          <span className="manage-item-meta">{t("dialogs.noAudio")}</span>
        )}
        {targetPromptMode === "audio" && hasTurns && (
          <button
            type="button"
            className="secondary-button exercise-action-icon-button dialog-list-action-button"
            onClick={onToggleText}
            aria-label={showText ? t("prompt.hideText") : t("prompt.showText")}
            title={showText ? t("prompt.hideText") : t("prompt.showText")}
            data-mobile-label={showText ? t("prompt.hideText") : t("prompt.showText")}
            aria-pressed={showText}
          >
            <DialogActionIcon name="text" />
          </button>
        )}
        {hasTurns && <DialogTurnAudioModeButton mode={turnAudioMode} onToggle={onToggleTurnAudioMode} />}
        <button type="button" className="secondary-button exercise-action-icon-button dialog-list-action-button" onClick={onCollapse} aria-label={t("dialogs.hideDialog")} title={t("dialogs.hideDialog")} data-mobile-label={t("dialogs.hideDialog")}>
          <DialogActionIcon name="collapse" />
        </button>
      </div>
      <div className="item-action-group item-action-group-danger" aria-label={t("newItem.actionGroupDanger")}>
        {hasTurns && (
          <DangerousButton type="button" className="secondary-button exercise-action-icon-button dialog-list-action-button" onConfirm={onRegenerate} disabled={regenerating} aria-label={regenerating ? t("dialogs.loading") : t("manage.regenerateAudio")} title={regenerating ? t("dialogs.loading") : t("manage.regenerateAudio")} data-mobile-label={regenerating ? t("dialogs.loading") : t("manage.regenerateAudio")}>
            <DialogActionIcon name="refresh" />
          </DangerousButton>
        )}
        <DangerousButton type="button" className="secondary-button exercise-action-icon-button dialog-list-action-button" onConfirm={onDelete} disabled={deleting} aria-label={t("dialogs.delete")} title={t("dialogs.delete")} data-mobile-label={t("dialogs.delete")}>
          <DialogActionIcon name="delete" />
        </DangerousButton>
      </div>
    </>
  );
}
