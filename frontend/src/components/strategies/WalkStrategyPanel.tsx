import { useI18n } from "../../i18n";
import PhraseSelectionList, {
  type PhraseSelectionEntry,
} from "./PhraseSelectionList";

export default function WalkStrategyPanel({
  challenge,
  targetWord,
  entries,
  selectedKeys,
  onToggleEntry,
  exerciseRunning,
  isLoading,
  error,
}: {
  challenge: string;
  targetWord: string;
  entries: PhraseSelectionEntry[];
  selectedKeys: string[];
  onToggleEntry: (entry: PhraseSelectionEntry) => void;
  exerciseRunning: boolean;
  isLoading: boolean;
  error: string;
}): JSX.Element {
  const { t } = useI18n();

  return (
    <div className="strategy-content-panel">
      <p className="hint exercise-modal-description">
        {t("newItem.walkDescription")}
      </p>
      {isLoading && <p className="hint">{t("newItem.walkGenerating")}</p>}
      {error && <p className="error">{error}</p>}
      {!!challenge && (
        <div className="walk-strategy-challenge">
          <strong>{t("newItem.walkChallengeTitle")}</strong>
          <p>{challenge}</p>
        </div>
      )}
      {!isLoading && !error && entries.length === 0 && (
        <p className="hint">{t("newItem.walkEmpty")}</p>
      )}
      {!!entries.length && (
        <PhraseSelectionList
          entries={entries}
          selectedKeys={selectedKeys}
          onToggleEntry={onToggleEntry}
          disabled={exerciseRunning}
          highlightTargetText={targetWord}
        />
      )}
    </div>
  );
}
