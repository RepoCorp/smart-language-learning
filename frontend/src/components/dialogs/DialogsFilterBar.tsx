import { useI18n } from "../../i18n";

interface DialogsFilterBarProps {
  search: string;
  topic: string;
  context: string;
  level: string;
  topics: string[];
  contexts: string[];
  loading: boolean;
  onSearchChange: (value: string) => void;
  onTopicChange: (value: string) => void;
  onContextChange: (value: string) => void;
  onLevelChange: (value: string) => void;
}

export default function DialogsFilterBar({
  search,
  topic,
  context,
  level,
  topics,
  contexts,
  loading,
  onSearchChange,
  onTopicChange,
  onContextChange,
  onLevelChange,
}: DialogsFilterBarProps): JSX.Element {
  const { t } = useI18n();

  return (
    <div className="dialogs-filter-bar">
      <label className="form-field dialogs-search-field">
        <span>{t("dialogs.searchFilter")}</span>
        <input
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={t("dialogs.searchFilterPlaceholder")}
        />
      </label>
      <label className="form-field">
        <span>{t("content.level.label")}</span>
        <select value={level} onChange={(event) => onLevelChange(event.target.value)} disabled={loading}>
          <option value="">{t("dialogs.levelFilterPlaceholder")}</option>
          {['A1', 'A2', 'B1', 'B2'].map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      </label>
      <label className="form-field">
        <span>{t("dialogs.topicFilter")}</span>
        <select value={topic} onChange={(event) => onTopicChange(event.target.value)} disabled={loading}>
          <option value="">{t("dialogs.topicFilterPlaceholder")}</option>
          {topics.map((availableTopic) => (
            <option key={availableTopic} value={availableTopic}>{availableTopic}</option>
          ))}
        </select>
      </label>
      <label className="form-field">
        <span>{t("dialogs.contextFilter")}</span>
        <select
          value={context}
          onChange={(event) => onContextChange(event.target.value)}
          disabled={loading || !topic}
        >
          <option value="">{t("dialogs.contextFilterPlaceholder")}</option>
          {contexts.map((availableContext) => (
            <option key={availableContext} value={availableContext}>{availableContext}</option>
          ))}
        </select>
      </label>
    </div>
  );
}
