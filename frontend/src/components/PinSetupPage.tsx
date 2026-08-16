import { FormEvent, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { completePinSetup, type AuthSession } from "../authApi";
import { useI18n } from "../i18n";

type Props = {
  onAuthenticated: (session: AuthSession) => void;
};

export default function PinSetupPage({ onAuthenticated }: Props): JSX.Element {
  const { t } = useI18n();
  const [searchParams] = useSearchParams();
  const [pin, setPin] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const token = searchParams.get("token")?.trim() || "";

  const submit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError("");
    if (!token) {
      setError(t("auth.pinSetupMissingToken"));
      return;
    }
    if (pin.length < 4) {
      setError(t("auth.pinSetupMinLength"));
      return;
    }
    if (pin !== confirmation) {
      setError(t("auth.pinSetupMismatch"));
      return;
    }

    setSubmitting(true);
    try {
      onAuthenticated(await completePinSetup(token, pin));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : t("auth.pinSetupFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="pin-setup-page">
      <section className="auth-card pin-setup-card">
        <div className="auth-landing-brand">
          <span className="auth-landing-brand-mark" aria-hidden="true"><span className="auth-landing-brand-dot" /></span>
          <span className="auth-landing-brand-text">Smart Learn</span>
        </div>
        <h1 className="auth-card-title">{t("auth.pinSetupTitle")}</h1>
        <p className="auth-card-description">{t("auth.pinSetupDescription")}</p>
        <form className="auth-card-form" onSubmit={submit}>
          <label>
            {t("auth.pinSetupPin")}
            <input type="password" value={pin} onChange={(event) => setPin(event.target.value)} autoComplete="new-password" required />
          </label>
          <label>
            {t("auth.pinSetupConfirm")}
            <input type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="new-password" required />
          </label>
          <button type="submit" disabled={submitting || !token}>
            {submitting ? t("auth.pinSetupSubmitting") : t("auth.pinSetupSubmit")}
          </button>
        </form>
        {error ? <p className="auth-bar-error">{error}</p> : null}
      </section>
    </main>
  );
}
