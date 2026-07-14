import { useEffect, useRef, useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";

import { getStoredAuthUser, logoutFromPinSession, type AuthUser } from "./authApi";
import AuthLanding from "./components/AuthLanding";
import ConfigurationsPage from "./components/ConfigurationsPage";
import ContentCreatePage from "./components/ContentCreatePage";
import ContentManagePage from "./components/ContentManagePage";
import DialogsPage from "./components/DialogsPage";
import OverviewStatsBar from "./components/OverviewStatsBar";
import SessionPage from "./components/SessionPage";
import { DebugToolsPanel } from "./debugTools";
import ConversationPage from "./features/conversation/ConversationPage";

export default function App(): JSX.Element {
  const location = useLocation();
  const navigate = useNavigate();
  const [authUser, setAuthUser] = useState<AuthUser | null>(() => getStoredAuthUser());
  const [authBusy, setAuthBusy] = useState(false);
  const [showPageMenu, setShowPageMenu] = useState(false);
  const pageMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setShowPageMenu(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!showPageMenu) {
      return;
    }

    const handlePointerDown = (event: MouseEvent | TouchEvent): void => {
      const menuElement = pageMenuRef.current;
      const targetNode = event.target;
      if (!menuElement || !(targetNode instanceof Node)) {
        return;
      }
      if (!menuElement.contains(targetNode)) {
        setShowPageMenu(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [showPageMenu]);

  const handleLogout = async (): Promise<void> => {
    setAuthBusy(true);
    try {
      await logoutFromPinSession();
    } finally {
      setAuthUser(null);
      setAuthBusy(false);
    }
  };

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
      {!authUser ? <AuthLanding onAuthenticated={setAuthUser} /> : null}
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
                  <div className="top-nav" ref={pageMenuRef}>
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
