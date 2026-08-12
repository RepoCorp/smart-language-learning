import { useI18n } from "../../i18n";

type CompareEntry = {
  key: string;
  targetWord: string;
  sourceWord: string;
  difference: string;
  mistake: string;
  targetExample: string;
  targetTranslation: string;
  comparisonExample: string;
  comparisonTranslation: string;
};

function CompareCard({
  entry,
  selected,
  onToggle,
  disabled,
}: {
  entry: CompareEntry;
  selected: boolean;
  onToggle: (entry: CompareEntry) => void;
  disabled: boolean;
}): JSX.Element {
  return (
    <button
      type="button"
      className={`strategy-content-card ${selected ? "strategy-content-card-selected" : ""}`}
      onClick={() => onToggle(entry)}
      disabled={disabled}
    >
      <p className="strategy-content-word">
        <strong>{entry.targetWord}</strong>
      </p>
      <p className="strategy-content-translation">{entry.sourceWord}</p>
      <p className="strategy-content-explanation">{entry.difference}</p>
      <p className="strategy-content-explanation">
        <strong>{entry.mistake}</strong>
      </p>
      <p className="strategy-content-example-target">{entry.targetExample}</p>
      <p className="strategy-content-example-source">
        {entry.targetTranslation}
      </p>
      <p className="strategy-content-example-target">
        {entry.comparisonExample}
      </p>
      <p className="strategy-content-example-source">
        {entry.comparisonTranslation}
      </p>
    </button>
  );
}

export default function CompareStrategyPanel({
  entries,
  selectedKeys,
  onToggleEntry,
  exerciseRunning,
  isLoading,
  error,
}: {
  entries: CompareEntry[];
  selectedKeys: string[];
  onToggleEntry: (entry: CompareEntry) => void;
  exerciseRunning: boolean;
  isLoading: boolean;
  error: string;
}): JSX.Element {
  const { t } = useI18n();

  return (
    <div className="strategy-content-panel">
      <p className="hint exercise-modal-description">
        {t("newItem.compareDescription")}
      </p>
      {isLoading && <p className="hint">{t("newItem.compareGenerating")}</p>}
      {error && <p className="error">{error}</p>}
      {!isLoading && !error && entries.length === 0 && (
        <p className="hint">{t("newItem.compareEmpty")}</p>
      )}
      {!!entries.length && (
        <div className="strategy-content-grid">
          {entries.map((entry) => (
            <CompareCard
              key={entry.key}
              entry={entry}
              selected={selectedKeys.includes(entry.key)}
              onToggle={onToggleEntry}
              disabled={exerciseRunning}
            />
          ))}
        </div>
      )}
    </div>
  );
}
