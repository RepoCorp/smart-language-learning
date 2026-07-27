import DangerousButton from "../DangerousButton";
import { useI18n } from "../../i18n";

export default function ManageTopicsSection({
  topics,
  selectedTopics,
  deletingTopic,
  busy,
  onToggleAllTopics,
  allTopicsSelected,
  onRemoveSelectedTopics,
  onToggleTopicSelection,
}: {
  topics: string[];
  selectedTopics: Record<string, boolean>;
  deletingTopic: string;
  busy: boolean;
  onToggleAllTopics: () => void;
  allTopicsSelected: boolean;
  onRemoveSelectedTopics: () => void;
  onToggleTopicSelection: (topic: string) => void;
}): JSX.Element {
  const { t } = useI18n();

  return (
    <section className="card">
      <h2>{t("manage.topics")}</h2>
      {!topics.length && <p>{t("manage.emptyTopics")}</p>}
      {!!topics.length && (
        <ul className="manage-list">
          <li className="manage-actions-row">
            <button className="manage-toggle-all-button" onClick={onToggleAllTopics} disabled={busy}>
              {allTopicsSelected ? t("manage.unselectAll") : t("manage.selectAll")}
            </button>
            <DangerousButton
              className="dangerous-action-button"
              onConfirm={onRemoveSelectedTopics}
              disabled={busy || !topics.some((topic) => selectedTopics[topic])}
            >
              {deletingTopic ? t("manage.deleting") : t("manage.deleteSelectedTopics")}
            </DangerousButton>
          </li>
          {topics.map((topic) => (
            <li key={topic} className="manage-row">
              <label className="manage-checkbox">
                <input
                  type="checkbox"
                  checked={Boolean(selectedTopics[topic])}
                  onChange={() => onToggleTopicSelection(topic)}
                  disabled={busy}
                />
                {topic}
              </label>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
