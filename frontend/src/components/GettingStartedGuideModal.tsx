import { useNavigate } from "react-router-dom";

import { useI18n } from "../i18n";

type Props = {
  open: boolean;
  onClose: () => void;
};

const STEP_KEYS = ["languages", "content", "save", "session", "conversation"] as const;
const STEP_PATHS: Record<(typeof STEP_KEYS)[number], string> = {
  languages: "/configurations",
  content: "/content/create",
  save: "/dialogs",
  session: "/session",
  conversation: "/conversation",
};

export default function GettingStartedGuideModal({ open, onClose }: Props): JSX.Element | null {
  const { t } = useI18n();
  const navigate = useNavigate();

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
              <button
                type="button"
                className="getting-started-step"
                onClick={() => {
                  onClose();
                  navigate(STEP_PATHS[key]);
                }}
              >
                <span className="getting-started-step-number" aria-hidden="true">{index + 1}</span>
                <span className="getting-started-step-copy">
                  <strong>{t(`config.gettingStarted.${key}.title`)}</strong>
                  <span>{t(`config.gettingStarted.${key}.body`)}</span>
                </span>
              </button>
            </li>
          ))}
        </ol>
        <p className="getting-started-note">{t("config.gettingStartedNote")}</p>
        <p className="getting-started-reopen">{t("config.gettingStartedReopen")}</p>
        <div className="getting-started-close-action">
          <button type="button" className="secondary-button" onClick={onClose}>
            {t("config.gettingStartedClose")}
          </button>
        </div>
      </section>
    </div>
  );
}
