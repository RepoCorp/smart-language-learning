import type { ReactNode } from "react";

import { useI18n } from "../i18n";

export const DOCUMENTATION_TOPICS = ["idea", "spacedRepetition"] as const;

export type DocumentationTopic = (typeof DOCUMENTATION_TOPICS)[number];

function renderInlineFormatting(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).filter(Boolean).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return <em key={index}>{part.slice(1, -1)}</em>;
    }
    return part;
  });
}

interface DocumentationModalProps {
  topic: DocumentationTopic | null;
  onClose: () => void;
}

export default function DocumentationModal({ topic, onClose }: DocumentationModalProps): JSX.Element | null {
  const { t } = useI18n();

  if (!topic) {
    return null;
  }

  const title = t(`config.documentation.${topic}.title`);
  const paragraphs = t(`config.documentation.${topic}.body`).split("\n\n");
  return (
    <div className="blocking-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="documentation-modal-title">
      <section className="blocking-modal documentation-modal">
        <button type="button" className="modal-corner-close" aria-label={t("config.documentationClose")} onClick={onClose}>
          x
        </button>
        <h2 id="documentation-modal-title">{title}</h2>
        <div className="documentation-modal-copy">
          {paragraphs.map((paragraph, index) => {
            const listItems = paragraph.split("\n").filter((line) => line.startsWith("- "));
            if (listItems.length) {
              return <ul key={index}>{listItems.map((item) => <li key={item}>{renderInlineFormatting(item.slice(2))}</li>)}</ul>;
            }
            return <p key={index}>{renderInlineFormatting(paragraph)}</p>;
          })}
        </div>
        <div className="documentation-modal-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            {t("config.documentationClose")}
          </button>
        </div>
      </section>
    </div>
  );
}
