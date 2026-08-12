import { useI18n } from "../../i18n";

type EncounterEntry = {
  key: string;
  title: string;
  description: string;
  source: string;
  target: string;
};

function EncounterCard({
  entry,
  selected,
  onToggle,
  disabled,
}: {
  entry: EncounterEntry;
  selected: boolean;
  onToggle: (entry: EncounterEntry) => void;
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
        <strong>{entry.title}</strong>
      </p>
      <p className="strategy-content-explanation">{entry.description}</p>
      <p className="strategy-content-example-target">{entry.target}</p>
      <p className="strategy-content-example-source">{entry.source}</p>
    </button>
  );
}

export default function EncounterStrategyPanel({
  entries,
  selectedKeys,
  onToggleEntry,
  exerciseRunning,
  isLoading,
  error,
}: {
  entries: EncounterEntry[];
  selectedKeys: string[];
  onToggleEntry: (entry: EncounterEntry) => void;
  exerciseRunning: boolean;
  isLoading: boolean;
  error: string;
}): JSX.Element {
  const { t } = useI18n();

  return (
    <div className="strategy-content-panel">
      <p className="hint exercise-modal-description">
        {t("newItem.encounterDescription")}
      </p>
      {isLoading && <p className="hint">{t("newItem.encounterGenerating")}</p>}
      {error && <p className="error">{error}</p>}
      {!isLoading && !error && entries.length === 0 && (
        <p className="hint">{t("newItem.encounterEmpty")}</p>
      )}
      {!!entries.length && (
        <div className="strategy-content-grid">
          {entries.map((entry) => (
            <EncounterCard
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
