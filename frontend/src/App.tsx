import { FormEvent, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import { getStoredAuthUser, loginWithPin, logoutFromPinSession, type AuthUser } from "./api";
import ContentCreatePage from "./components/ContentCreatePage";
import ContentManagePage from "./components/ContentManagePage";
import ConversationPage from "./components/ConversationPage";
import OverviewStatsBar from "./components/OverviewStatsBar";
import SessionPage from "./components/SessionPage";

export default function App(): JSX.Element {
  const [authUser, setAuthUser] = useState<AuthUser | null>(() => getStoredAuthUser());
  const [identifier, setIdentifier] = useState("");
  const [pin, setPin] = useState("");
  const [authError, setAuthError] = useState("");
  const [authBusy, setAuthBusy] = useState(false);

  const handleLogin = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setAuthError("");
    setAuthBusy(true);
    try {
      const user = await loginWithPin(identifier, pin);
      setAuthUser(user);
      setPin("");
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
      setAuthBusy(false);
    }
  };

  return (
    <>
      <header className="auth-bar">
        <div className="auth-bar-title">Session User</div>
        {authUser ? (
          <div className="auth-bar-session">
            <span>{authUser.email || authUser.username}</span>
            <button type="button" onClick={handleLogout} disabled={authBusy}>
              Log out
            </button>
          </div>
        ) : (
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
          </form>
        )}
        {authError ? <div className="auth-bar-error">{authError}</div> : null}
      </header>
      {authUser ? (
        <>
          <OverviewStatsBar />
          <Routes>
            <Route path="/session" element={<SessionPage />} />
            <Route path="/content/create" element={<ContentCreatePage />} />
            <Route path="/content/manage" element={<ContentManagePage />} />
            <Route path="/conversation" element={<ConversationPage />} />
            <Route path="*" element={<Navigate to="/session" replace />} />
          </Routes>
        </>
      ) : null}
    </>
  );
}
