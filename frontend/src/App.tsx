import { useEffect, useRef, useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";

import {
  completeGettingStarted,
  getStoredAuthUser,
  logoutFromPinSession,
  type AuthSession,
  type AuthUser,
} from "./authApi";
import AuthLanding from "./components/AuthLanding";
import AdminPage from "./components/AdminPage";
import AIQuotaNotice from "./components/AIQuotaNotice";
import ConfigurationsPage from "./components/ConfigurationsPage";
import GettingStartedGuideModal from "./components/GettingStartedGuideModal";
import GuidedTour from "./guides/GuidedTour";
import { GUIDED_TOUR_START_EVENT, notifyGuidedTourAction, type GuidedTourId } from "./guides/guidedTourEvents";
import PinSetupPage from "./components/PinSetupPage";
import ContentCreatePage from "./components/ContentCreatePage";
import ContentManagePage from "./components/ContentManagePage";
import DialogsPage from "./components/DialogsPage";
import OverviewStatsBar from "./components/OverviewStatsBar";
import LearningStreakControl from "./components/LearningStreakControl";
import ProgressPage from "./components/ProgressPage";
import SessionPage from "./components/SessionPage";
import { DebugToolsPanel } from "./debugTools";
import ConversationPage from "./features/conversation/ConversationPage";
import GlobalSessionEndPrompt from "./features/session/GlobalSessionEndPrompt";
import { useI18n } from "./i18n";
import { usePromptPreferences } from "./promptPreferences";

const FIRST_GUIDE_COMPLETED_STORAGE_KEY = "first_learning_guide_completed";

function hasCompletedFirstGuide(): boolean {
  return typeof window !== "undefined" && window.localStorage.getItem(FIRST_GUIDE_COMPLETED_STORAGE_KEY) === "true";
}

export default function App(): JSX.Element {
  const { t } = useI18n();
  const { showTutorialContinueButton } = usePromptPreferences();
  const location = useLocation();
  const navigate = useNavigate();
  const [authUser, setAuthUser] = useState<AuthUser | null>(() => getStoredAuthUser());
  const [authBusy, setAuthBusy] = useState(false);
  const [showGettingStarted, setShowGettingStarted] = useState(false);
  const [showGuidedSetup, setShowGuidedSetup] = useState(false);
  const [guidedTourStep, setGuidedTourStep] = useState(0);
  const [guidedTourId, setGuidedTourId] = useState<GuidedTourId>("basics");
  const [firstGuideCompleted, setFirstGuideCompleted] = useState(hasCompletedFirstGuide);
  const [showPageMenu, setShowPageMenu] = useState(false);
  const pageMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setShowPageMenu(false);
  }, [location.pathname]);

  useEffect(() => {
    const startRequestedGuide = (event: Event): void => {
      const guideId = (event as CustomEvent<{ guideId?: GuidedTourId }>).detail?.guideId;
      if (!guideId) return;
      setGuidedTourId(guideId);
      setGuidedTourStep(0);
      setShowGuidedSetup(true);
    };
    window.addEventListener(GUIDED_TOUR_START_EVENT, startRequestedGuide);
    return () => window.removeEventListener(GUIDED_TOUR_START_EVENT, startRequestedGuide);
  }, []);

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

  const handleAuthenticated = (session: AuthSession): void => {
    setAuthUser(session.user);
    setShowGettingStarted(session.show_getting_started);
  };

  const closeGettingStarted = (): void => {
    setShowGettingStarted(false);
    void completeGettingStarted();
  };

  const startGuidedSetup = (): void => {
    setShowGettingStarted(false);
    void completeGettingStarted();
    setGuidedTourId("basics");
    setGuidedTourStep(0);
    setShowGuidedSetup(true);
  };

  const startConversationGuide = (): void => {
    setGuidedTourId("conversation");
    setGuidedTourStep(0);
    setShowGuidedSetup(true);
  };

  const configPath = "/configurations";
  const pageOptions = [
    { path: "/session", label: t("menu.session") },
    { path: "/dialogs", label: t("menu.dialogs") },
    { path: "/conversation", label: t("menu.conversation") },
    { path: "/content/manage", label: t("menu.manageContent") },
    { path: "/content/create", label: t("menu.createContent") },
    { path: configPath, label: t("menu.configuration") },
  ];
  const selectedPagePath = pageOptions.some((option) => option.path === location.pathname) ? location.pathname : "/session";

  return (
    <>
      {!authUser && location.pathname === "/set-pin" ? <PinSetupPage onAuthenticated={handleAuthenticated} /> : null}
      {!authUser && location.pathname !== "/set-pin" ? <AuthLanding onAuthenticated={handleAuthenticated} /> : null}
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
                  <LearningStreakControl />
                  <div className="top-nav" ref={pageMenuRef}>
                    <button
                      type="button"
                      className="top-nav-menu-button"
                      data-guide-target="main-menu"
                      onClick={() => {
                        setShowPageMenu((value) => !value);
                        notifyGuidedTourAction("menu-opened");
                      }}
                      aria-expanded={showPageMenu}
                      aria-haspopup="menu"
                      aria-label={t("menu.open")}
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
                            data-guide-target={option.path === "/content/create" ? "menu-create-content" : option.path === "/session" ? "menu-session" : option.path === "/conversation" ? "menu-conversation" : undefined}
                            onClick={() => {
                              setShowPageMenu(false);
                              if (location.pathname !== option.path) {
                                navigate(option.path);
                              }
                            }}
                            role="menuitem"
                            aria-current={selectedPagePath === option.path ? "page" : undefined}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
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
            <Route path="/progress" element={<ProgressPage />} />
            <Route
              path="/configurations"
              element={(
                <ConfigurationsPage
                  canCreateUsers={Boolean(authUser?.is_superuser)}
                  authUser={authUser}
                  authBusy={authBusy}
                  onLogout={handleLogout}
                  onOpenAdmin={() => navigate("/admin")}
                  onStartGuidedSetup={startGuidedSetup}
                  onStartConversationGuide={startConversationGuide}
                />
              )}
            />
            <Route path="/admin" element={authUser.is_superuser ? <AdminPage authUser={authUser} /> : <Navigate to="/configurations" replace />} />
            <Route path="*" element={<Navigate to="/session" replace />} />
          </Routes>
          <GlobalSessionEndPrompt />
          <AIQuotaNotice />
          <GettingStartedGuideModal open={showGettingStarted} onClose={closeGettingStarted} onStartGuidedSetup={startGuidedSetup} />
          {showTutorialContinueButton && !firstGuideCompleted && !showGettingStarted && !showGuidedSetup ? (
            <button type="button" className="guided-tour-continue-button" onClick={startGuidedSetup}>
              {t("config.tutorialStart")}
            </button>
          ) : null}
          <GuidedTour
            open={showGuidedSetup}
            onFinish={() => {
              setShowGuidedSetup(false);
              setGuidedTourStep(0);
              if (guidedTourId === "basics") {
                setFirstGuideCompleted(true);
                window.localStorage.setItem(FIRST_GUIDE_COMPLETED_STORAGE_KEY, "true");
              }
            }}
            stepIndex={guidedTourStep}
            onStepChange={setGuidedTourStep}
            guideId={guidedTourId}
          />
          {authUser.is_superuser && <DebugToolsPanel />}
        </>
      ) : null}
    </>
  );
}
