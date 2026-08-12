import { useI18n } from "../../i18n";
import PhraseSelectionList, {
  type PhraseSelectionEntry,
} from "./PhraseSelectionList";

export default function ExamplesStrategyPanel({
  entries,
  selectedKeys,
  onToggleEntry,
  exerciseRunning,
  isLoading,
  error,
}: {
  entries: PhraseSelectionEntry[];
  selectedKeys: string[];
  onToggleEntry: (entry: PhraseSelectionEntry) => void;
  exerciseRunning: boolean;
  isLoading: boolean;
  error: string;
}): JSX.Element {
  const { t } = useI18n();

  return (
    <div className="examples-strategy-panel">
      <p className="hint exercise-modal-description">
        {t("newItem.examplesDescription")}
      </p>
      {isLoading && <p className="hint">{t("newItem.examplesGenerating")}</p>}
      {error && <p className="error">{error}</p>}
      {!isLoading && !error && entries.length === 0 && (
        <p className="hint">{t("newItem.examplesEmpty")}</p>
      )}
      {!!entries.length && (
        <PhraseSelectionList
          entries={entries}
          selectedKeys={selectedKeys}
          onToggleEntry={onToggleEntry}
          disabled={exerciseRunning}
        />
      )}
    </div>
  );
}
