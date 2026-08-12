import { useEffect, useRef } from "react";

import { recordLearningStudyTime } from "../apiProgress";
import type { StudyLanguageCode } from "../types";

const REPORT_INTERVAL_MS = 60_000;

export default function useSessionStudyActivity(
  active: boolean,
  sourceLanguage: StudyLanguageCode,
  targetLanguage: StudyLanguageCode,
): void {
  const lastVisibleAtRef = useRef<number>(Date.now());

  useEffect(() => {
    if (!active) {
      return;
    }
    lastVisibleAtRef.current = Date.now();
    const reportVisibleTime = (allowHidden = false): void => {
      if (!allowHidden && document.visibilityState !== "visible") {
        return;
      }
      const now = Date.now();
      const seconds = Math.floor((now - lastVisibleAtRef.current) / 1000);
      lastVisibleAtRef.current = now;
      if (seconds > 0) {
        void recordLearningStudyTime(seconds, sourceLanguage, targetLanguage).catch(() => undefined);
      }
    };
    const onVisibilityChange = (): void => {
      if (document.visibilityState === "hidden") {
        reportVisibleTime(true);
      } else {
        lastVisibleAtRef.current = Date.now();
      }
    };
    const intervalId = window.setInterval(reportVisibleTime, REPORT_INTERVAL_MS);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      reportVisibleTime();
    };
  }, [active, sourceLanguage, targetLanguage]);
}
