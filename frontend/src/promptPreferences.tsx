import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export type TargetPromptMode = "text" | "audio";

const TARGET_PROMPT_MODE_STORAGE_KEY = "target_prompt_mode";

interface PromptPreferencesContextValue {
  targetPromptMode: TargetPromptMode;
  setTargetPromptMode: (mode: TargetPromptMode) => void;
}

function getInitialTargetPromptMode(): TargetPromptMode {
  if (typeof window === "undefined") {
    return "text";
  }
  const stored = window.localStorage.getItem(TARGET_PROMPT_MODE_STORAGE_KEY);
  return stored === "audio" ? "audio" : "text";
}

const defaultContext: PromptPreferencesContextValue = {
  targetPromptMode: "text",
  setTargetPromptMode: () => {},
};

const PromptPreferencesContext = createContext<PromptPreferencesContextValue>(defaultContext);

export function PromptPreferencesProvider({ children }: { children: ReactNode }): JSX.Element {
  const [targetPromptMode, setTargetPromptModeState] = useState<TargetPromptMode>(getInitialTargetPromptMode);

  const setTargetPromptMode = (mode: TargetPromptMode): void => {
    setTargetPromptModeState(mode);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(TARGET_PROMPT_MODE_STORAGE_KEY, mode);
    }
  };

  const value = useMemo<PromptPreferencesContextValue>(
    () => ({
      targetPromptMode,
      setTargetPromptMode,
    }),
    [targetPromptMode],
  );

  return <PromptPreferencesContext.Provider value={value}>{children}</PromptPreferencesContext.Provider>;
}

export function usePromptPreferences(): PromptPreferencesContextValue {
  return useContext(PromptPreferencesContext);
}
