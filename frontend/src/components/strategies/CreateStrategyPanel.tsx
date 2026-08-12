import { useI18n } from "../../i18n";
import PhraseSelectionList from "./PhraseSelectionList";

interface CreateEntry {
  key: string;
  source: string;
  target: string;
}

export default function CreateStrategyPanel({
  inputValue,
  onInputChange,
  onGenerate,
  isGenerating,
  error,
  entries,
  selectedKeys,
  onToggleEntry,
  exerciseRunning,
}: {
  inputValue: string;
  onInputChange: (value: string) => void;
  onGenerate: () => void;
  isGenerating: boolean;
  error: string;
  entries: CreateEntry[];
  selectedKeys: string[];
  onToggleEntry: (entry: CreateEntry) => void;
  exerciseRunning: boolean;
}): JSX.Element {
  const { t } = useI18n();

  return (
    <div className="create-strategy-panel">
      <p className="hint exercise-modal-description">
        {t("newItem.createDescription")}
      </p>
      <div className="create-strategy-form">
        <textarea
          className="create-strategy-input"
          value={inputValue}
          onChange={(event) => onInputChange(event.target.value)}
          placeholder={t("newItem.createPlaceholder")}
          rows={3}
        />
        <button
          type="button"
          onClick={onGenerate}
          disabled={isGenerating || !inputValue.trim()}
        >
          {isGenerating
            ? t("newItem.createGenerating")
            : t("newItem.createAdd")}
        </button>
      </div>
      {error && <p className="error">{error}</p>}
      {entries.length === 0 && !isGenerating && (
        <p className="hint">{t("newItem.createEmpty")}</p>
      )}
      <PhraseSelectionList
        entries={entries}
        selectedKeys={selectedKeys}
        onToggleEntry={onToggleEntry}
        disabled={exerciseRunning}
      />
    </div>
  );
}
