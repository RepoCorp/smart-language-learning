import { useI18n } from "../i18n";

type Props = {
  open: boolean;
  onClose: () => void;
};

const STEP_KEYS = ["languages", "content", "save", "session", "conversation"] as const;

export default function GettingStartedGuideModal({ open, onClose }: Props): JSX.Element | null {
  const { t } = useI18n();

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
        <ol className="getting-started-steps">
          {STEP_KEYS.map((key, index) => (
            <li key={key}>
              <span className="getting-started-step-number" aria-hidden="true">{index + 1}</span>
              <div>
                <strong>{t(`config.gettingStarted.${key}.title`)}</strong>
                <p>{t(`config.gettingStarted.${key}.body`)}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="getting-started-note">{t("config.gettingStartedNote")}</p>
      </section>
    </div>
  );
}
