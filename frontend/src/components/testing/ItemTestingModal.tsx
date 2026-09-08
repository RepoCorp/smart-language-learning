import { useMemo, type ReactNode } from "react";

import { useI18n } from "../../i18n";

type TestingAction = {
  key: string;
  label: string;
};

export default function ItemTestingModal({
  itemType,
  selectedActionKey,
  onSelectedActionKeyChange,
  onClose,
  testingContent,
}: {
  itemType: "word" | "phrase";
  selectedActionKey: string;
  onSelectedActionKeyChange: (value: string) => void;
  onClose: () => void;
  testingContent: ReactNode;
}): JSX.Element {
  const { t } = useI18n();

  const actions = useMemo<TestingAction[]>(() => {
    if (itemType === "phrase") {
      return [
        {
          key: "progressive-blocks",
          label: t("newItem.phraseProgressiveBlocksTitle"),
        },
        {
          key: "builder",
          label: t("newItem.phraseBuilderTitle"),
        },
      ];
    }

    return [
      {
        key: "test",
        label: t("newItem.openItemTest"),
      },
      {
        key: "warmup",
        label: t("newItem.wordIntroPracticeTitle"),
      },
      {
        key: "letters",
        label: t("newItem.wordLetterPracticeTitle"),
      },
      {
        key: "parts",
        label: t("newItem.wordPartsPracticeTitle"),
      },
    ];
  }, [itemType, t]);

  const selectedAction = actions.find((action) => action.key === selectedActionKey) || actions[0] || null;

  return (
    <div className="blocking-modal-overlay" role="dialog" aria-modal="true">
      <div className="blocking-modal related-dialogs-modal word-strategies-modal">
        <button type="button" className="modal-corner-close" aria-label={t("newItem.closeRelatedDialogs")} onClick={onClose}>
          ×
        </button>
        <p className="exercise-modal-header">
          <strong>{t("newItem.testingTitle")}</strong>
        </p>
        <p className="hint exercise-modal-description">{t("newItem.testingDescription")}</p>
        <div className="word-strategies-body">
          <label className="word-strategies-select-group" htmlFor="item-testing-select">
            <select
              id="item-testing-select"
              className="word-strategies-select"
              value={selectedAction?.key || ""}
              onChange={(event) => onSelectedActionKeyChange(event.target.value)}
            >
              {actions.map((action, index) => (
                <option key={action.key} value={action.key}>
                  {index + 1}. {action.label}
                </option>
              ))}
            </select>
          </label>
          {selectedAction && (
            <div className="word-strategies-placeholder-card">
              <div className="testing-action-content">
                {testingContent}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
