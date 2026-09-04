import { useI18n } from "../i18n";

type Props = {
  open: boolean;
  onClose: () => void;
  onStartGuidedSetup: () => void;
};

export default function GettingStartedGuideModal({ open, onClose, onStartGuidedSetup }: Props): JSX.Element | null {
  const { language, t } = useI18n();

  if (!open) {
    return null;
  }

  return (
    <div className="blocking-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="getting-started-title">
      <section className="blocking-modal getting-started-modal">
        <button type="button" className="modal-corner-close" aria-label={t("config.gettingStartedClose")} onClick={onClose}>
          ×
        </button>
        <h2 id="getting-started-title">{t("config.gettingStartedTitle")}</h2>
        <p className="getting-started-intro">{t("config.gettingStartedIntro")}</p>
        <div className="getting-started-close-action" style={{ justifyContent: "center" }}>
          <button type="button" className="primary-button" onClick={onStartGuidedSetup}>
            {language === "es" ? "Empezar configuración guiada" : "Start guided setup"}
          </button>
        </div>
        <p className="getting-started-reopen">{t("config.gettingStartedReopen")}</p>
      </section>
    </div>
  );
}
