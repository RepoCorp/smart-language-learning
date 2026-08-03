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
  highlightTargetText = "",
}: {
  entries: PhraseSelectionEntry[];
  selectedKeys: string[];
  onToggleEntry: (entry: PhraseSelectionEntry) => void;
  disabled: boolean;
  highlightTargetText?: string;
}): JSX.Element {
  const highlightTarget = (text: string): JSX.Element | string => {
    const target = highlightTargetText.trim();
    const index = target ? text.toLocaleLowerCase().indexOf(target.toLocaleLowerCase()) : -1;
    if (index < 0) {
      return text;
    }
    const end = index + target.length;
    return <>{text.slice(0, index)}<mark className="exercise-phrase-target-highlight">{text.slice(index, end)}</mark>{text.slice(end)}</>;
  };

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
              <strong>{highlightTarget(entry.target)}</strong>
              <small>{entry.source}</small>
            </span>
          </button>
        );
      })}
    </div>
  );
}
