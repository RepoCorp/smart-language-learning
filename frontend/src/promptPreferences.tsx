import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { StudyLanguageCode } from "./studyLanguages";

export type TargetPromptMode = "text" | "audio";

const TARGET_PROMPT_MODE_STORAGE_KEY = "target_prompt_mode";
const MOBILE_ACTION_LABELS_STORAGE_KEY = "mobile_action_labels";
const BROWSER_VOICE_PREFERENCES_STORAGE_KEY = "browser_voice_preferences";

interface PromptPreferencesContextValue {
  targetPromptMode: TargetPromptMode;
  setTargetPromptMode: (mode: TargetPromptMode) => void;
  showMobileActionLabels: boolean;
  setShowMobileActionLabels: (enabled: boolean) => void;
  preferredBrowserVoiceURIByLanguage: Partial<Record<StudyLanguageCode, string>>;
  setPreferredBrowserVoiceURI: (language: StudyLanguageCode, voiceURI: string) => void;
  clearPreferredBrowserVoiceURIs: () => void;
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

function getInitialPreferredBrowserVoiceURIByLanguage(): Partial<Record<StudyLanguageCode, string>> {
  if (typeof window === "undefined") {
    return {};
  }
  const stored = window.localStorage.getItem(BROWSER_VOICE_PREFERENCES_STORAGE_KEY);
  if (!stored) {
    return {};
  }
  try {
    const parsed = JSON.parse(stored) as Partial<Record<StudyLanguageCode, string>>;
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

const defaultContext: PromptPreferencesContextValue = {
  targetPromptMode: "text",
  setTargetPromptMode: () => {},
  showMobileActionLabels: false,
  setShowMobileActionLabels: () => {},
  preferredBrowserVoiceURIByLanguage: {},
  setPreferredBrowserVoiceURI: () => {},
  clearPreferredBrowserVoiceURIs: () => {},
};

const PromptPreferencesContext = createContext<PromptPreferencesContextValue>(defaultContext);

export function PromptPreferencesProvider({ children }: { children: ReactNode }): JSX.Element {
  const [targetPromptMode, setTargetPromptModeState] = useState<TargetPromptMode>(getInitialTargetPromptMode);
  const [showMobileActionLabels, setShowMobileActionLabelsState] = useState<boolean>(getInitialShowMobileActionLabels);
  const [preferredBrowserVoiceURIByLanguage, setPreferredBrowserVoiceURIByLanguage] = useState<Partial<Record<StudyLanguageCode, string>>>(
    getInitialPreferredBrowserVoiceURIByLanguage,
  );

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

  const setPreferredBrowserVoiceURI = (language: StudyLanguageCode, voiceURI: string): void => {
    setPreferredBrowserVoiceURIByLanguage((current) => {
      const next = { ...current };
      if (voiceURI.trim()) {
        next[language] = voiceURI;
      } else {
        delete next[language];
      }
      if (typeof window !== "undefined") {
        window.localStorage.setItem(BROWSER_VOICE_PREFERENCES_STORAGE_KEY, JSON.stringify(next));
      }
      return next;
    });
  };

  const clearPreferredBrowserVoiceURIs = (): void => {
    setPreferredBrowserVoiceURIByLanguage({});
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(BROWSER_VOICE_PREFERENCES_STORAGE_KEY);
    }
  };

  const value = useMemo<PromptPreferencesContextValue>(
    () => ({
      targetPromptMode,
      setTargetPromptMode,
      showMobileActionLabels,
      setShowMobileActionLabels,
      preferredBrowserVoiceURIByLanguage,
      setPreferredBrowserVoiceURI,
      clearPreferredBrowserVoiceURIs,
    }),
    [targetPromptMode, showMobileActionLabels, preferredBrowserVoiceURIByLanguage],
  );

  return <PromptPreferencesContext.Provider value={value}>{children}</PromptPreferencesContext.Provider>;
}

export function usePromptPreferences(): PromptPreferencesContextValue {
  return useContext(PromptPreferencesContext);
}
