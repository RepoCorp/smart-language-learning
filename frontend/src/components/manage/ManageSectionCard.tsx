import { useI18n } from "../../i18n";
import type { ManageSection } from "./manageTypes";

export default function ManageSectionCard({
  currentSection,
  busy,
  onChangeSection,
}: {
  currentSection: ManageSection;
  busy: boolean;
  onChangeSection: (section: ManageSection) => void;
}): JSX.Element {
  const { t } = useI18n();

  return (
    <section className="card">
      <label className="prompt">{t("manage.sectionLabel")}</label>
      <div className="actions">
        <button
          type="button"
          className={currentSection === "words" ? "" : "secondary-button"}
          onClick={() => onChangeSection("words")}
          disabled={busy}
        >
          {t("manage.sectionWords")}
        </button>
        <button
          type="button"
          className={currentSection === "phrases" ? "" : "secondary-button"}
          onClick={() => onChangeSection("phrases")}
          disabled={busy}
        >
          {t("manage.sectionPhrases")}
        </button>
        <button
          type="button"
          className={currentSection === "topics" ? "" : "secondary-button"}
          onClick={() => onChangeSection("topics")}
          disabled={busy}
        >
          {t("manage.sectionTopics")}
        </button>
      </div>
    </section>
  );
}
