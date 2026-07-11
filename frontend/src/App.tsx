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
  const [showPageMenu, setShowPageMenu] = useState(false);

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

  useEffect(() => {
    setShowPageMenu(false);
  }, [location.pathname]);

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
  ];
  const configPath = "/configurations";
  const selectedPagePath = pageOptions.some((option) => option.path === location.pathname) ? location.pathname : "/session";
  const userBadgeLabel = authUser?.username?.trim().charAt(0).toUpperCase()
    || authUser?.email?.trim().charAt(0).toUpperCase()
    || "U";

  return (
    <>
      {!authUser ? (
        <header className="auth-bar">
          <div className="auth-bar-title">Session User</div>
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
          {showRegister && canPublicRegister ? (
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
      ) : null}
      {authUser ? (
        <>
          <OverviewStatsBar
            showFutureReviews={false}
            showWordCount={false}
            topBarControl={(
              <div className="app-top-bar">
                <div className="app-top-bar-brand" aria-label="Smart Learn">
                  <span className="app-top-bar-brand-mark" aria-hidden="true">
                    <span className="app-top-bar-brand-mark-dot" />
                  </span>
                  <span className="app-top-bar-brand-text">Smart Learn</span>
                </div>
                <div className="app-top-bar-actions">
                  <div className="top-nav">
                    <button
                      type="button"
                      className="top-nav-menu-button"
                      onClick={() => setShowPageMenu((value) => !value)}
                      aria-expanded={showPageMenu}
                      aria-haspopup="menu"
                      aria-label="Open page menu"
                    >
                      <span className="top-nav-menu-icon" aria-hidden="true">
                        <span />
                        <span />
                        <span />
                      </span>
                    </button>
                    {showPageMenu ? (
                      <div className="top-nav-menu" role="menu" aria-label="Pages">
                        {pageOptions.map((option) => (
                          <button
                            key={option.path}
                            type="button"
                            className={`top-nav-menu-item ${selectedPagePath === option.path ? "active" : ""}`}
                            onClick={() => navigate(option.path)}
                            role="menuitem"
                            aria-current={selectedPagePath === option.path ? "page" : undefined}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    className={`app-top-bar-user-badge ${location.pathname === configPath ? "active" : ""}`}
                    aria-label={authUser?.username || authUser?.email || "User"}
                    aria-current={location.pathname === configPath ? "page" : undefined}
                    onClick={() => navigate(configPath)}
                  >
                    {userBadgeLabel}
                  </button>
                </div>
              </div>
            )}
          />
          <Routes>
            <Route path="/session" element={<SessionPage />} />
            <Route path="/content/create" element={<ContentCreatePage />} />
            <Route path="/content/manage" element={<ContentManagePage />} />
            <Route path="/dialogs" element={<DialogsPage />} />
            <Route path="/conversation" element={<ConversationPage />} />
            <Route
              path="/configurations"
              element={(
                <ConfigurationsPage
                  canCreateUsers={Boolean(authUser?.is_superuser)}
                  authUser={authUser}
                  authBusy={authBusy}
                  onLogout={handleLogout}
                />
              )}
            />
            <Route path="*" element={<Navigate to="/session" replace />} />
          </Routes>
          <DebugToolsPanel />
        </>
      ) : null}
    </>
  );
}
