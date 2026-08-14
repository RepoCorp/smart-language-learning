import { useI18n } from "../../i18n";
import type { PhraseSelectionEntry } from "./PhraseSelectionList";

export type GrammarPhraseExampleEntry = PhraseSelectionEntry & {
  itemId: number;
};

export default function GrammarPhraseExampleList({
  entries,
  selectedKeys,
  onToggleEntry,
  onOpenItem,
  disabled,
}: {
  entries: GrammarPhraseExampleEntry[];
  selectedKeys: string[];
  onToggleEntry: (entry: GrammarPhraseExampleEntry) => void;
  onOpenItem: (itemId: number) => void;
  disabled: boolean;
}): JSX.Element {
  const { t } = useI18n();
  return (
    <div className="exercise-phrase-list">
      {entries.map((entry) => {
        const selected = selectedKeys.includes(entry.key);
        return (
          <div className="grammar-phrase-example-row" key={entry.key}>
            <button
              type="button"
              className={`exercise-phrase-row ${selected ? "exercise-phrase-row-selected" : ""}`}
              onClick={() => onToggleEntry(entry)}
              disabled={disabled}
            >
              <span>
                <strong>{entry.target}</strong>
                <small>{entry.source}</small>
              </span>
            </button>
            <button
              type="button"
              className="secondary-button grammar-phrase-example-open-button"
              onClick={() => onOpenItem(entry.itemId)}
              aria-label={t("words.openItem")}
              title={t("words.openItem")}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M14 4h6v6M20 4l-9 9M19 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5" />
              </svg>
            </button>
          </div>
        );
      })}
    </div>
  );
}
