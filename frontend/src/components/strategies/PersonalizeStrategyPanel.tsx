import { useI18n } from "../../i18n";
import PhraseSelectionList from "./PhraseSelectionList";

interface PersonalizeEntry {
  key: string;
  source: string;
  target: string;
}

export default function PersonalizeStrategyPanel({
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
  entries: PersonalizeEntry[];
  selectedKeys: string[];
  onToggleEntry: (entry: PersonalizeEntry) => void;
  exerciseRunning: boolean;
}): JSX.Element {
  const { t } = useI18n();

  return (
    <div className="personalize-strategy-panel">
      <p className="hint exercise-modal-description">{t("newItem.personalizeDescription")}</p>
      <div className="personalize-strategy-form">
        <textarea
          className="personalize-strategy-input"
          value={inputValue}
          onChange={(event) => onInputChange(event.target.value)}
          placeholder={t("newItem.personalizePlaceholder")}
          rows={3}
        />
        <button type="button" onClick={onGenerate} disabled={isGenerating || !inputValue.trim()}>
          {isGenerating ? t("newItem.personalizeGenerating") : t("newItem.personalizeAdd")}
        </button>
      </div>
      {error && <p className="error">{error}</p>}
      {entries.length === 0 && !isGenerating && (
        <p className="hint">{t("newItem.personalizeEmpty")}</p>
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
