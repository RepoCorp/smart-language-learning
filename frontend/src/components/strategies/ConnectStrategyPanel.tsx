import { useI18n } from "../../i18n";

export interface ConnectWordCard {
  key: string;
  targetWord: string;
  sourceWord: string;
  exampleTarget: string;
  exampleSource: string;
  explanation?: string;
}

function ConnectCard({
  entry,
  selected,
  onToggle,
  disabled,
}: {
  entry: ConnectWordCard;
  selected: boolean;
  onToggle: (entry: ConnectWordCard) => void;
  disabled: boolean;
}): JSX.Element {
  return (
    <button
      type="button"
      className={`connect-strategy-card ${selected ? "connect-strategy-card-selected" : ""}`}
      onClick={() => onToggle(entry)}
      disabled={disabled}
    >
      <p className="connect-strategy-word">
        <strong>{entry.targetWord}</strong>
      </p>
      <p className="connect-strategy-translation">{entry.sourceWord}</p>
      <p className="connect-strategy-example-target">{entry.exampleTarget}</p>
      <p className="connect-strategy-example-source">{entry.exampleSource}</p>
      {!!entry.explanation && <p className="connect-strategy-explanation">{entry.explanation}</p>}
    </button>
  );
}

export default function ConnectStrategyPanel({
  sameFamily,
  relatedOrConfusing,
  selectedKeys,
  onToggleEntry,
  exerciseRunning,
  isLoading,
  error,
}: {
  sameFamily: ConnectWordCard[];
  relatedOrConfusing: ConnectWordCard[];
  selectedKeys: string[];
  onToggleEntry: (entry: ConnectWordCard) => void;
  exerciseRunning: boolean;
  isLoading: boolean;
  error: string;
}): JSX.Element {
  const { t } = useI18n();

  return (
    <div className="connect-strategy-panel">
      <p className="hint exercise-modal-description">{t("newItem.connectDescription")}</p>
      {isLoading && <p className="hint">{t("newItem.connectGenerating")}</p>}
      {error && <p className="error">{error}</p>}
      {!isLoading && !error && sameFamily.length === 0 && relatedOrConfusing.length === 0 && (
        <p className="hint">{t("newItem.connectEmpty")}</p>
      )}
      {!!sameFamily.length && (
        <section className="connect-strategy-section">
          <p className="connect-strategy-section-title">
            <strong>{t("newItem.connectSameFamilyTitle")}</strong>
          </p>
          <div className="connect-strategy-grid">
            {sameFamily.map((entry) => (
              <ConnectCard
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
      {!!relatedOrConfusing.length && (
        <section className="connect-strategy-section">
          <p className="connect-strategy-section-title">
            <strong>{t("newItem.connectRelatedTitle")}</strong>
          </p>
          <div className="connect-strategy-grid">
            {relatedOrConfusing.map((entry) => (
              <ConnectCard
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
