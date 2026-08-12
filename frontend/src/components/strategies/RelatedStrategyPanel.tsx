import { useI18n } from "../../i18n";

export interface RelatedWordCard {
  key: string;
  targetWord: string;
  sourceWord: string;
  exampleTarget: string;
  exampleSource: string;
  explanation?: string;
}

function RelatedCard({
  entry,
  selected,
  onToggle,
  disabled,
}: {
  entry: RelatedWordCard;
  selected: boolean;
  onToggle: (entry: RelatedWordCard) => void;
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
      <p className="strategy-content-example-target">{entry.exampleTarget}</p>
      <p className="strategy-content-example-source">{entry.exampleSource}</p>
      {!!entry.explanation && (
        <p className="strategy-content-explanation">{entry.explanation}</p>
      )}
    </button>
  );
}

export default function RelatedStrategyPanel({
  sameFamily,
  selectedKeys,
  onToggleEntry,
  exerciseRunning,
  isLoading,
  error,
}: {
  sameFamily: RelatedWordCard[];
  selectedKeys: string[];
  onToggleEntry: (entry: RelatedWordCard) => void;
  exerciseRunning: boolean;
  isLoading: boolean;
  error: string;
}): JSX.Element {
  const { t } = useI18n();

  return (
    <div className="strategy-content-panel">
      <p className="hint exercise-modal-description">
        {t("newItem.relatedDescription")}
      </p>
      {isLoading && <p className="hint">{t("newItem.relatedGenerating")}</p>}
      {error && <p className="error">{error}</p>}
      {!isLoading && !error && sameFamily.length === 0 && (
        <p className="hint">{t("newItem.relatedEmpty")}</p>
      )}
      {!!sameFamily.length && (
        <section className="strategy-content-section">
          <div className="strategy-content-grid">
            {sameFamily.map((entry) => (
              <RelatedCard
                key={entry.key}
                entry={entry}
                selected={selectedKeys.includes(entry.key)}
                onToggle={onToggleEntry}
                disabled={exerciseRunning}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
