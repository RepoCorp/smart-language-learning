import type { FormEvent } from "react";

import { useI18n } from "../../i18n";

interface SessionStartCardProps {
  durationInput: string;
  error: string;
  onDurationChange: (value: string) => void;
  onStart: (event: FormEvent<HTMLFormElement>) => void;
}

export default function SessionStartCard({
  durationInput,
  error,
  onDurationChange,
  onStart,
}: SessionStartCardProps): JSX.Element {
  const { t } = useI18n();

  return (
    <main className="container session-start-page" data-testid="session-start-form" data-guide-target="session-start">
      <section className="card session-start-card">
        <div className="session-start-intro">
          <p className="session-start-eyebrow">{t("session.title")}</p>
          <h1>{t("session.durationPrompt")}</h1>
        </div>
        <form className="session-start-form" onSubmit={onStart}>
          <div className="session-start-controls">
            <label className="session-duration-field" htmlFor="duration-minutes">
              <span>{t("session.durationLabel")}</span>
              <input
                id="duration-minutes"
                data-testid="duration-minutes-input"
                type="number"
                min={1}
                max={180}
                value={durationInput}
                onChange={(event) => onDurationChange(event.target.value)}
              />
            </label>
          </div>

          {error && <p className="error">{t("session.error", { message: error })}</p>}
          <div className="actions session-start-actions">
            <button type="submit">{t("session.startButton")}</button>
          </div>
        </form>
      </section>
    </main>
  );
}
