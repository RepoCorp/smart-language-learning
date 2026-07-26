export interface PhraseSelectionEntry {
  key: string;
  source: string;
  target: string;
}

export default function PhraseSelectionList({
  entries,
  selectedKeys,
  onToggleEntry,
  disabled,
}: {
  entries: PhraseSelectionEntry[];
  selectedKeys: string[];
  onToggleEntry: (entry: PhraseSelectionEntry) => void;
  disabled: boolean;
}): JSX.Element {
  return (
    <div className="exercise-phrase-list">
      {entries.map((entry) => {
        const checked = selectedKeys.includes(entry.key);
        return (
          <button
            type="button"
            className={`exercise-phrase-row ${checked ? "exercise-phrase-row-selected" : ""}`}
            key={entry.key}
            onClick={() => onToggleEntry(entry)}
            disabled={disabled}
          >
            <span>
              <strong>{entry.target}</strong>
              <small>{entry.source}</small>
            </span>
          </button>
        );
      })}
    </div>
  );
}
