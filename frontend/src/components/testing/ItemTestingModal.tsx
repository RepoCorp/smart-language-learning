import { useMemo, type ReactNode } from "react";

import { useI18n } from "../../i18n";

type TestingAction = {
  key: string;
  label: string;
  description: string;
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
          key: "test",
          label: t("newItem.openItemTest"),
          description: t("newItem.testingDirectTestDescription"),
        },
        {
          key: "builder",
          label: t("newItem.phraseBuilderTitle"),
          description: t("newItem.testingPhraseBuilderDescription"),
        },
      ];
    }

    return [
      {
        key: "test",
        label: t("newItem.openItemTest"),
        description: t("newItem.testingDirectTestDescription"),
      },
      {
        key: "warmup",
        label: t("newItem.wordIntroPracticeTitle"),
        description: t("newItem.testingWarmupDescription"),
      },
      {
        key: "letters",
        label: t("newItem.wordLetterPracticeTitle"),
        description: t("newItem.testingLetterPracticeDescription"),
      },
      {
        key: "parts",
        label: t("newItem.wordPartsPracticeTitle"),
        description: t("newItem.testingWordPartsDescription"),
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
            <span className="word-strategies-select-label">{t("newItem.testingSelectLabel")}</span>
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
              <p className="word-strategies-placeholder-title">
                <strong>{selectedAction.label}</strong>
              </p>
              <p className="hint testing-action-description">{selectedAction.description}</p>
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
