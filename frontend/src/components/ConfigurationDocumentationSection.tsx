import { useI18n } from "../i18n";

interface ConfigurationDocumentationSectionProps {
  onOpenGuides: () => void;
}

export default function ConfigurationDocumentationSection({
  onOpenGuides,
}: ConfigurationDocumentationSectionProps): JSX.Element {
  const { language } = useI18n();

  return (
    <section className="card settings-card documentation-section">
      <h2 className="settings-title">{language === "es" ? "Conoce la aplicación paso a paso" : "Learn the app step by step"}</h2>
      <button type="button" className="getting-started-open-button" onClick={onOpenGuides}>
        <span>{language === "es" ? "Abrir guías" : "Open guides"}</span>
      </button>
    </section>
  );
}
