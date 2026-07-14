import { FormEvent, useEffect, useState } from "react";

import {
  fetchAuthBootstrapStatus,
  loginWithPin,
  submitRegistrationRequest,
  type AuthUser,
} from "../authApi";
import { useI18n } from "../i18n";

interface AuthLandingProps {
  onAuthenticated: (user: AuthUser) => void;
}

export default function AuthLanding({ onAuthenticated }: AuthLandingProps): JSX.Element {
  const { t } = useI18n();
  const [identifier, setIdentifier] = useState("");
  const [pin, setPin] = useState("");
  const [authError, setAuthError] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [registerUsername, setRegisterUsername] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerError, setRegisterError] = useState("");
  const [registerSuccess, setRegisterSuccess] = useState("");
  const [registerBusy, setRegisterBusy] = useState(false);
  const [canSubmitRegistrationRequest, setCanSubmitRegistrationRequest] = useState(false);

  useEffect(() => {
    let mounted = true;
    const load = async (): Promise<void> => {
      const status = await fetchAuthBootstrapStatus();
      if (mounted) {
        setCanSubmitRegistrationRequest(status);
      }
    };
    void load();
    return () => {
      mounted = false;
    };
  }, []);

  const handleLogin = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setAuthError("");
    setAuthBusy(true);
    try {
      const user = await loginWithPin(identifier, pin);
      onAuthenticated(user);
      setPin("");
      setShowRegister(false);
    } catch {
      setAuthError("Invalid username/email or PIN.");
    } finally {
      setAuthBusy(false);
    }
  };

  const handleRegisterRequest = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setRegisterError("");
    setRegisterSuccess("");
    setRegisterBusy(true);
    try {
      const message = await submitRegistrationRequest(registerUsername, registerEmail);
      setRegisterSuccess(message);
      setRegisterUsername("");
      setRegisterEmail("");
      setShowRegister(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to submit registration request.";
      setRegisterError(message);
    } finally {
      setRegisterBusy(false);
    }
  };

  return (
    <main className="auth-landing">
      <section className="auth-landing-hero">
        <div className="auth-landing-brand">
          <span className="auth-landing-brand-mark" aria-hidden="true">
            <span className="auth-landing-brand-dot" />
          </span>
          <span className="auth-landing-brand-text">Smart Learn</span>
        </div>
        <p className="auth-landing-kicker">{t("authLanding.kicker")}</p>
        <h1 className="auth-landing-title">{t("authLanding.title")}</h1>
        <p className="auth-landing-description">{t("authLanding.description")}</p>
        <div className="auth-landing-feature-grid">
          <article className="auth-landing-feature-card">
            <h2>{t("authLanding.feature1Title")}</h2>
            <p>{t("authLanding.feature1Body")}</p>
          </article>
          <article className="auth-landing-feature-card">
            <h2>{t("authLanding.feature2Title")}</h2>
            <p>{t("authLanding.feature2Body")}</p>
          </article>
          <article className="auth-landing-feature-card">
            <h2>{t("authLanding.feature3Title")}</h2>
            <p>{t("authLanding.feature3Body")}</p>
          </article>
        </div>
      </section>
      <section className="auth-card" aria-label={t("authLanding.signInTitle")}>
        <p className="auth-card-kicker">{t("authLanding.signInKicker")}</p>
        <h2 className="auth-card-title">{t("authLanding.signInTitle")}</h2>
        <p className="auth-card-description">{t("authLanding.signInDescription")}</p>
        <form className="auth-card-form" onSubmit={handleLogin}>
          <input
            type="text"
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            placeholder={t("authLanding.identifierPlaceholder")}
            autoComplete="username"
            required
          />
          <input
            type="password"
            value={pin}
            onChange={(event) => setPin(event.target.value)}
            placeholder={t("authLanding.pinPlaceholder")}
            autoComplete="current-password"
            required
          />
          <button type="submit" disabled={authBusy}>
            {authBusy ? t("authLanding.signingIn") : t("authLanding.signIn")}
          </button>
        </form>
        {authError ? <div className="auth-bar-error">{authError}</div> : null}
        {canSubmitRegistrationRequest ? (
          <div className="auth-card-register">
            <button type="button" className="secondary-button" onClick={() => setShowRegister((value) => !value)}>
              {showRegister ? t("authLanding.cancelRegister") : t("authLanding.requestAccess")}
            </button>
            <p className="auth-card-register-hint">{t("authLanding.requestAccessHint")}</p>
          </div>
        ) : null}
        {showRegister && canSubmitRegistrationRequest ? (
          <form className="register-form auth-card-form" onSubmit={handleRegisterRequest}>
            <input
              type="text"
              value={registerUsername}
              onChange={(event) => setRegisterUsername(event.target.value)}
              placeholder={t("authLanding.usernamePlaceholder")}
              autoComplete="username"
              required
            />
            <input
              type="email"
              value={registerEmail}
              onChange={(event) => setRegisterEmail(event.target.value)}
              placeholder={t("authLanding.emailPlaceholder")}
              autoComplete="email"
              required
            />
            <button type="submit" disabled={registerBusy}>
              {registerBusy ? t("authLanding.submittingRequest") : t("authLanding.submitRequest")}
            </button>
          </form>
        ) : null}
        {registerError ? <div className="auth-bar-error">{registerError}</div> : null}
        {registerSuccess ? <div className="hint">{registerSuccess}</div> : null}
      </section>
    </main>
  );
}
