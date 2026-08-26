import { useState } from "react";

import { useI18n } from "../i18n";
import DocumentationModal, { DOCUMENTATION_TOPICS, type DocumentationTopic } from "./DocumentationModal";

interface ConfigurationDocumentationSectionProps {
  onOpenGettingStarted: () => void;
}

export default function ConfigurationDocumentationSection({
  onOpenGettingStarted,
}: ConfigurationDocumentationSectionProps): JSX.Element {
  const { t } = useI18n();
  const [selectedTopic, setSelectedTopic] = useState<DocumentationTopic | null>(null);

  return (
    <section className="card settings-card documentation-section">
      <h2 className="settings-title">{t("config.documentationTitle")}</h2>
      <div className="documentation-topics">
        {DOCUMENTATION_TOPICS.map((key) => (
          <button
            key={key}
            type="button"
            className="documentation-topic-button"
            onClick={() => setSelectedTopic(key)}
          >
            <span>{t(`config.documentation.${key}.title`)}</span>
          </button>
        ))}
      </div>
      <button type="button" className="getting-started-open-button" onClick={onOpenGettingStarted}>
        <span>{t("config.gettingStartedOpen")}</span>
      </button>
      <DocumentationModal topic={selectedTopic} onClose={() => setSelectedTopic(null)} />
    </section>
  );
}
