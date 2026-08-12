import { useI18n } from "../../i18n";
import type { RelatedWordCard } from "./RelatedStrategyPanel";

function DecodeRelatedCard({
  entry,
  selected,
  onToggle,
  disabled,
}: {
  entry: RelatedWordCard & { why: string };
  selected: boolean;
  onToggle: (entry: RelatedWordCard & { why: string }) => void;
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
      <p className="strategy-content-explanation">{entry.why}</p>
      <p className="strategy-content-example-target">{entry.exampleTarget}</p>
      <p className="strategy-content-example-source">{entry.exampleSource}</p>
    </button>
  );
}

export default function DecodeStrategyPanel({
  linguistic,
  memory,
  related,
  selectedKeys,
  onToggleEntry,
  exerciseRunning,
  isLoading,
  error,
}: {
  linguistic: {
    prefix?: string;
    root?: string;
    suffix?: string;
    lemma?: string;
    explanation?: string;
  } | null;
  memory: {
    decomposition?: string;
    explanation?: string;
  } | null;
  related: Array<RelatedWordCard & { why: string }>;
  selectedKeys: string[];
  onToggleEntry: (entry: RelatedWordCard & { why: string }) => void;
  exerciseRunning: boolean;
  isLoading: boolean;
  error: string;
}): JSX.Element {
  const { t } = useI18n();
  const hasAnalysis = Boolean(linguistic || memory || related.length > 0);

  return (
    <div className="strategy-content-panel">
      <p className="hint exercise-modal-description">
        {t("newItem.decodeDescription")}
      </p>
      {isLoading && <p className="hint">{t("newItem.decodeGenerating")}</p>}
      {error && <p className="error">{error}</p>}
      {!isLoading && !error && !hasAnalysis && (
        <p className="hint">{t("newItem.decodeEmpty")}</p>
      )}
      {!!linguistic && (
        <section className="decode-analysis-card">
          <p className="strategy-content-section-title">
            <strong>{t("newItem.decodeLinguisticTitle")}</strong>
          </p>
          <div className="decode-analysis-parts">
            {!!linguistic.prefix && (
              <p>
                <strong>{t("newItem.decodePrefixLabel")}</strong>{" "}
                {linguistic.prefix}
              </p>
            )}
            {!!linguistic.root && (
              <p>
                <strong>{t("newItem.decodeRootLabel")}</strong>{" "}
                {linguistic.root}
              </p>
            )}
            {!!linguistic.suffix && (
              <p>
                <strong>{t("newItem.decodeSuffixLabel")}</strong>{" "}
                {linguistic.suffix}
              </p>
            )}
            {!!linguistic.lemma && (
              <p>
                <strong>{t("newItem.decodeLemmaLabel")}</strong>{" "}
                {linguistic.lemma}
              </p>
            )}
          </div>
          {!!linguistic.explanation && (
            <p className="strategy-content-explanation">
              {linguistic.explanation}
            </p>
          )}
        </section>
      )}
      {!!memory && (
        <section className="decode-analysis-card">
          <p className="strategy-content-section-title">
            <strong>{t("newItem.decodeMemoryTitle")}</strong>
          </p>
          {!!memory.decomposition && (
            <p>
              <strong>{memory.decomposition}</strong>
            </p>
          )}
          {!!memory.explanation && (
            <p className="strategy-content-explanation">{memory.explanation}</p>
          )}
        </section>
      )}
      {!!related.length && (
        <section className="strategy-content-section">
          <p className="strategy-content-section-title">
            <strong>{t("newItem.decodeRelatedTitle")}</strong>
          </p>
          <div className="strategy-content-grid">
            {related.map((entry) => (
              <DecodeRelatedCard
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
