import { useI18n } from "../../i18n";
import PhraseSelectionList, {
  type PhraseSelectionEntry,
} from "./PhraseSelectionList";

export default function ActStrategyPanel({
  entry,
  selectedKeys,
  onToggleEntry,
  exerciseRunning,
  isLoading,
  error,
}: {
  entry: (PhraseSelectionEntry & { actions: string[] }) | null;
  selectedKeys: string[];
  onToggleEntry: (entry: PhraseSelectionEntry & { actions: string[] }) => void;
  exerciseRunning: boolean;
  isLoading: boolean;
  error: string;
}): JSX.Element {
  const { t } = useI18n();

  return (
    <div className="strategy-content-panel">
      <p className="hint exercise-modal-description">
        {t("newItem.actDescription")}
      </p>
      {isLoading && <p className="hint">{t("newItem.actGenerating")}</p>}
      {error && <p className="error">{error}</p>}
      {!isLoading && !error && !entry && (
        <p className="hint">{t("newItem.actEmpty")}</p>
      )}
      {!!entry?.actions.length && (
        <div className="act-strategy-actions-card">
          <p className="act-strategy-actions-title">
            <strong>{t("newItem.actActionsTitle")}</strong>
          </p>
          <ol className="act-strategy-actions-list">
            {entry.actions.map((action) => (
              <li key={action}>{action}</li>
            ))}
          </ol>
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
