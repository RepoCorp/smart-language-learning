import { useI18n } from "../i18n";

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
      <div className="exercise-phrase-list">
        {entries.map((entry) => {
          const checked = selectedKeys.includes(entry.key);
          return (
            <button
              type="button"
              className={`exercise-phrase-row ${checked ? "exercise-phrase-row-selected" : ""}`}
              key={entry.key}
              onClick={() => onToggleEntry(entry)}
              disabled={exerciseRunning}
            >
              <span>
                <strong>{entry.target}</strong>
                <small>{entry.source}</small>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
