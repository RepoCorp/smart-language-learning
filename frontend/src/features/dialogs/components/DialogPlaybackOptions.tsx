import { useI18n } from "../../../i18n";
import DialogTurnAudioModeButton from "./DialogTurnAudioModeButton";
import type { DialogTurnAudioMode } from "./useDialogTurnPlayback";

export default function DialogPlaybackOptions({ mode, speed, onToggleMode, onSpeedChange }: {
  mode: DialogTurnAudioMode;
  speed: number;
  onToggleMode: () => void;
  onSpeedChange: (speed: number) => void;
}): JSX.Element {
  const { t } = useI18n();
  return (
    <div className="dialog-playback-options">
      <DialogTurnAudioModeButton mode={mode} onToggle={onToggleMode} scope="dialog" />
      {mode === "clear" && (
        <label className="dialog-playback-speed">
          <span>{t("dialogs.playbackSpeed")}</span>
          <select value={speed} onChange={(event) => onSpeedChange(Number(event.target.value))}>
            <option value={1}>1×</option>
            <option value={0.9}>0.9×</option>
            <option value={0.75}>0.75×</option>
          </select>
        </label>
      )}
    </div>
  );
}
