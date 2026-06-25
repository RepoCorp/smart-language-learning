import { FormEvent, useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";

import { fetchAuthBootstrapStatus, getStoredAuthUser, loginWithPin, logoutFromPinSession, registerWithPin, type AuthUser } from "./api";
import ConfigurationsPage from "./components/ConfigurationsPage";
import ContentCreatePage from "./components/ContentCreatePage";
import ContentManagePage from "./components/ContentManagePage";
import ConversationPage from "./components/ConversationPage";
import DialogsPage from "./components/DialogsPage";
import OverviewStatsBar from "./components/OverviewStatsBar";
import SessionPage from "./components/SessionPage";
import { DebugToolsPanel } from "./debugTools";

export default function App(): JSX.Element {
  const location = useLocation();
  const navigate = useNavigate();
  const [authUser, setAuthUser] = useState<AuthUser | null>(() => getStoredAuthUser());
  const [identifier, setIdentifier] = useState("");
  const [pin, setPin] = useState("");
  const [authError, setAuthError] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [registerUsername, setRegisterUsername] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPin, setRegisterPin] = useState("");
  const [registerError, setRegisterError] = useState("");
  const [registerBusy, setRegisterBusy] = useState(false);
  const [canPublicRegister, setCanPublicRegister] = useState(false);

  useEffect(() => {
    let mounted = true;
    const load = async (): Promise<void> => {
      const status = await fetchAuthBootstrapStatus();
      if (mounted) {
        setCanPublicRegister(status);
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
      setAuthUser(user);
      setPin("");
      setShowRegister(false);
    } catch {
      setAuthError("Invalid username/email or PIN.");
    } finally {
      setAuthBusy(false);
    }
  };

  const handleLogout = async (): Promise<void> => {
    setAuthBusy(true);
    try {
      await logoutFromPinSession();
    } finally {
      setAuthUser(null);
      setShowRegister(false);
      setAuthBusy(false);
    }
  };

  const handleRegister = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setRegisterError("");
    setRegisterBusy(true);
    try {
      const user = await registerWithPin(registerUsername, registerEmail, registerPin);
      if (!authUser) {
        setAuthUser(user);
      }
      setCanPublicRegister(false);
      setRegisterUsername("");
      setRegisterEmail("");
      setRegisterPin("");
      setShowRegister(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create user.";
      setRegisterError(message);
    } finally {
      setRegisterBusy(false);
    }
  };

  const canShowCreateUserButton = !authUser && canPublicRegister;
  const pageOptions = [
    { path: "/session", label: "Session" },
    { path: "/content/create", label: "Create content" },
    { path: "/content/manage", label: "Manage content" },
    { path: "/dialogs", label: "Dialogs" },
    { path: "/conversation", label: "Conversation" },
    { path: "/configurations", label: "Configurations" },
  ];
  const selectedPagePath = pageOptions.some((option) => option.path === location.pathname) ? location.pathname : "/session";

  return (
    <>
      <header className="auth-bar">
        <div className="auth-bar-title">Session User</div>
        {authUser ? (
          <div className="auth-bar-session">
            <span>{authUser.email || authUser.username}</span>
          </div>
        ) : (
          <div className="auth-bar-guest">
            <form className="auth-bar-form" onSubmit={handleLogin}>
              <input
                type="text"
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
                placeholder="Username or email"
                autoComplete="username"
                required
              />
              <input
                type="password"
                value={pin}
                onChange={(event) => setPin(event.target.value)}
                placeholder="PIN"
                autoComplete="current-password"
                required
              />
              <button type="submit" disabled={authBusy}>
                {authBusy ? "Signing in..." : "Sign in"}
              </button>
              {canShowCreateUserButton ? (
                <button type="button" onClick={() => setShowRegister((value) => !value)}>
                  {showRegister ? "Cancel" : "Create user"}
                </button>
              ) : null}
            </form>
          </div>
        )}
        {showRegister && !authUser && canPublicRegister ? (
          <form className="register-form" onSubmit={handleRegister}>
            <input
              type="text"
              value={registerUsername}
              onChange={(event) => setRegisterUsername(event.target.value)}
              placeholder="Username"
              autoComplete="username"
              required
            />
            <input
              type="email"
              value={registerEmail}
              onChange={(event) => setRegisterEmail(event.target.value)}
              placeholder="Email"
              autoComplete="email"
              required
            />
            <input
              type="password"
              value={registerPin}
              onChange={(event) => setRegisterPin(event.target.value)}
              placeholder="PIN"
              autoComplete="new-password"
              required
            />
            <button type="submit" disabled={registerBusy}>
              {registerBusy ? "Creating..." : "Create"}
            </button>
          </form>
        ) : null}
        {authError ? <div className="auth-bar-error">{authError}</div> : null}
        {registerError ? <div className="auth-bar-error">{registerError}</div> : null}
      </header>
      {authUser ? (
        <>
          <OverviewStatsBar
            topBarControl={(
              <div className="top-nav">
                <div className="top-nav-pages" role="tablist" aria-label="Pages">
                  {pageOptions.map((option) => (
                    <button
                      key={option.path}
                      type="button"
                      className={`top-nav-page-button ${selectedPagePath === option.path ? "active" : ""}`}
                      onClick={() => navigate(option.path)}
                      role="tab"
                      aria-selected={selectedPagePath === option.path}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <button type="button" className="secondary-button top-nav-logout" onClick={handleLogout} disabled={authBusy}>
                  {authBusy ? "Logging out..." : "Log out"}
                </button>
              </div>
            )}
          />
          <Routes>
            <Route path="/session" element={<SessionPage />} />
            <Route path="/content/create" element={<ContentCreatePage />} />
            <Route path="/content/manage" element={<ContentManagePage />} />
            <Route path="/dialogs" element={<DialogsPage />} />
            <Route path="/conversation" element={<ConversationPage />} />
            <Route path="/configurations" element={<ConfigurationsPage canCreateUsers={Boolean(authUser?.is_superuser)} />} />
            <Route path="*" element={<Navigate to="/session" replace />} />
          </Routes>
          <DebugToolsPanel />
        </>
      ) : null}
    </>
  );
}
