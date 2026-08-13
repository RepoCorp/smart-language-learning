import { useEffect, useState } from "react";

import { useI18n } from "../../i18n";
import { useStudyLanguages } from "../../studyLanguages";
import {
  activeSessionStorageKey,
  readStoredSessionState,
  updateStoredSessionState,
} from "./sessionStorage";

export default function GlobalSessionEndPrompt(): JSX.Element | null {
  const { t } = useI18n();
  const { sourceLanguage, targetLanguage } = useStudyLanguages();
  const storageKey = activeSessionStorageKey(sourceLanguage, targetLanguage);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const checkSessionEnd = (): void => {
      const snapshot = readStoredSessionState(storageKey);
      const isActive = snapshot?.sessionDurationMinutes != null
        && snapshot.sessionOutcome == null
        && typeof snapshot.sessionEndsAtMs === "number";
      if (!isActive || !snapshot) {
        setIsVisible(false);
        return;
      }
      if (snapshot.sessionEndsAtMs <= Date.now() && !snapshot.showExtendPrompt) {
        updateStoredSessionState(storageKey, (current) => ({
          ...current,
          remainingSeconds: 0,
          showExtendPrompt: true,
        }), true);
        setIsVisible(true);
        return;
      }
      setIsVisible(Boolean(snapshot.showExtendPrompt));
    };

    checkSessionEnd();
    const intervalId = window.setInterval(checkSessionEnd, 1000);
    return () => window.clearInterval(intervalId);
  }, [storageKey]);

  if (!isVisible) {
    return null;
  }

  const extendSession = (): void => {
    updateStoredSessionState(storageKey, (snapshot) => ({
      ...snapshot,
      sessionEndsAtMs: Date.now() + 5 * 60 * 1000,
      remainingSeconds: 5 * 60,
      showExtendPrompt: false,
    }), true);
    setIsVisible(false);
  };

  const endSession = (): void => {
    updateStoredSessionState(storageKey, (snapshot) => ({
      ...snapshot,
      sessionOutcome: "time_up",
      showExtendPrompt: false,
    }), true);
    setIsVisible(false);
  };

  return (
    <div className="blocking-modal-overlay session-extend-overlay" role="dialog" aria-modal="true">
      <section className="blocking-modal">
        <p className="error">{t("session.extendPromptTitle")}</p>
        <p>{t("session.extendPromptMessage")}</p>
        <div className="actions">
          <button onClick={extendSession}>{t("session.extendYes")}</button>
          <button className="secondary-button" onClick={endSession}>
            {t("session.extendNo")}
          </button>
        </div>
      </section>
    </div>
  );
}
