import { useI18n } from "../../i18n";
import DialogActionIcon from "../DialogActionIcon";
import type { DialogTurnAudioMode } from "./useDialogTurnPlayback";

export default function DialogTurnAudioModeButton({
  mode,
  onToggle,
}: {
  mode: DialogTurnAudioMode;
  onToggle: () => void;
}): JSX.Element {
  const { t } = useI18n();
  const label = mode === "natural" ? t("dialogs.turnAudioNaturalSelected") : t("dialogs.turnAudioClearSelected");

  return (
    <button
      type="button"
      className={`secondary-button exercise-action-icon-button dialog-list-action-button ${mode === "clear" ? "dialog-turn-audio-mode-selected" : ""}`}
      onClick={onToggle}
      aria-label={label}
      title={label}
      data-mobile-label={label}
      aria-pressed={mode === "clear"}
    >
      <DialogActionIcon name={mode === "natural" ? "speed-fast" : "speed-slow"} />
    </button>
  );
}
