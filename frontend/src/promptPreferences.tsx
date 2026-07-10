import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export type TargetPromptMode = "text" | "audio";

const TARGET_PROMPT_MODE_STORAGE_KEY = "target_prompt_mode";
const MOBILE_ACTION_LABELS_STORAGE_KEY = "mobile_action_labels";

interface PromptPreferencesContextValue {
  targetPromptMode: TargetPromptMode;
  setTargetPromptMode: (mode: TargetPromptMode) => void;
  showMobileActionLabels: boolean;
  setShowMobileActionLabels: (enabled: boolean) => void;
}

function getInitialTargetPromptMode(): TargetPromptMode {
  if (typeof window === "undefined") {
    return "text";
  }
  const stored = window.localStorage.getItem(TARGET_PROMPT_MODE_STORAGE_KEY);
  return stored === "audio" ? "audio" : "text";
}

function getInitialShowMobileActionLabels(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return window.localStorage.getItem(MOBILE_ACTION_LABELS_STORAGE_KEY) === "true";
}

const defaultContext: PromptPreferencesContextValue = {
  targetPromptMode: "text",
  setTargetPromptMode: () => {},
  showMobileActionLabels: false,
  setShowMobileActionLabels: () => {},
};

const PromptPreferencesContext = createContext<PromptPreferencesContextValue>(defaultContext);

export function PromptPreferencesProvider({ children }: { children: ReactNode }): JSX.Element {
  const [targetPromptMode, setTargetPromptModeState] = useState<TargetPromptMode>(getInitialTargetPromptMode);
  const [showMobileActionLabels, setShowMobileActionLabelsState] = useState<boolean>(getInitialShowMobileActionLabels);

  const setTargetPromptMode = (mode: TargetPromptMode): void => {
    setTargetPromptModeState(mode);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(TARGET_PROMPT_MODE_STORAGE_KEY, mode);
    }
  };

  const setShowMobileActionLabels = (enabled: boolean): void => {
    setShowMobileActionLabelsState(enabled);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(MOBILE_ACTION_LABELS_STORAGE_KEY, String(enabled));
    }
  };

  const value = useMemo<PromptPreferencesContextValue>(
    () => ({
      targetPromptMode,
      setTargetPromptMode,
      showMobileActionLabels,
      setShowMobileActionLabels,
    }),
    [targetPromptMode, showMobileActionLabels],
  );

  return <PromptPreferencesContext.Provider value={value}>{children}</PromptPreferencesContext.Provider>;
}

export function usePromptPreferences(): PromptPreferencesContextValue {
  return useContext(PromptPreferencesContext);
}
