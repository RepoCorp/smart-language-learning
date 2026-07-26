import { useI18n } from "../../i18n";
import PhraseSelectionList, { type PhraseSelectionEntry } from "./PhraseSelectionList";

export default function VisualizeStrategyPanel({
  entry,
  selectedKeys,
  onToggleEntry,
  exerciseRunning,
  isLoading,
  error,
}: {
  entry: PhraseSelectionEntry | null;
  selectedKeys: string[];
  onToggleEntry: (entry: PhraseSelectionEntry) => void;
  exerciseRunning: boolean;
  isLoading: boolean;
  error: string;
}): JSX.Element {
  const { t } = useI18n();

  return (
    <div className="practice-strategy-panel">
      <p className="hint exercise-modal-description">{t("newItem.visualizeDescription")}</p>
      {isLoading && <p className="hint">{t("newItem.visualizeGenerating")}</p>}
      {error && <p className="error">{error}</p>}
      {!isLoading && !error && !entry && (
        <p className="hint">{t("newItem.visualizeEmpty")}</p>
      )}
      {!!entry?.imageUrl && (
        <div className="visualize-strategy-image-card">
          <img src={entry.imageUrl} alt={entry.target} className="visualize-strategy-image" />
          <p className="visualize-strategy-word">
            <strong>{entry.target}</strong>
          </p>
        </div>
      )}
      {!!entry && (
        <PhraseSelectionList
          entries={[entry]}
          selectedKeys={selectedKeys}
          onToggleEntry={onToggleEntry}
          disabled={exerciseRunning}
        />
      )}
    </div>
  );
}
