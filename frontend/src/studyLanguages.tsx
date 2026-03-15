import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { StudyLanguageCode } from "./types";
export type { StudyLanguageCode } from "./types";

const SOURCE_STORAGE_KEY = "study_source_language";
const TARGET_STORAGE_KEY = "study_target_language";

const SUPPORTED_STUDY_LANGUAGES: StudyLanguageCode[] = [
  "spanish",
  "english",
  "german",
  "french",
  "italian",
  "portuguese",
];

interface StudyLanguagesContextValue {
  sourceLanguage: StudyLanguageCode;
  targetLanguage: StudyLanguageCode;
  setSourceLanguage: (code: StudyLanguageCode) => void;
  setTargetLanguage: (code: StudyLanguageCode) => void;
  supportedLanguages: StudyLanguageCode[];
}

function normalizeLanguage(value: string | null, fallback: StudyLanguageCode): StudyLanguageCode {
  if (!value) {
    return fallback;
  }
  return SUPPORTED_STUDY_LANGUAGES.includes(value as StudyLanguageCode) ? (value as StudyLanguageCode) : fallback;
}

function getInitialSourceLanguage(): StudyLanguageCode {
  if (typeof window === "undefined") {
    return "spanish";
  }
  return normalizeLanguage(window.localStorage.getItem(SOURCE_STORAGE_KEY), "spanish");
}

function getInitialTargetLanguage(sourceLanguage: StudyLanguageCode): StudyLanguageCode {
  if (typeof window === "undefined") {
    return sourceLanguage === "german" ? "english" : "german";
  }
  const stored = normalizeLanguage(window.localStorage.getItem(TARGET_STORAGE_KEY), "german");
  if (stored !== sourceLanguage) {
    return stored;
  }
  return sourceLanguage === "german" ? "english" : "german";
}

const defaultContext: StudyLanguagesContextValue = {
  sourceLanguage: "spanish",
  targetLanguage: "german",
  setSourceLanguage: () => {},
  setTargetLanguage: () => {},
  supportedLanguages: SUPPORTED_STUDY_LANGUAGES,
};

const StudyLanguagesContext = createContext<StudyLanguagesContextValue>(defaultContext);

export function StudyLanguagesProvider({ children }: { children: ReactNode }): JSX.Element {
  const [sourceLanguage, setSourceLanguageState] = useState<StudyLanguageCode>(getInitialSourceLanguage);
  const [targetLanguage, setTargetLanguageState] = useState<StudyLanguageCode>(() =>
    getInitialTargetLanguage(getInitialSourceLanguage()),
  );

  const persist = (source: StudyLanguageCode, target: StudyLanguageCode): void => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(SOURCE_STORAGE_KEY, source);
    window.localStorage.setItem(TARGET_STORAGE_KEY, target);
  };

  const setSourceLanguage = (nextSource: StudyLanguageCode): void => {
    let nextTarget = targetLanguage;
    if (nextSource === nextTarget) {
      nextTarget = sourceLanguage;
    }
    setSourceLanguageState(nextSource);
    setTargetLanguageState(nextTarget);
    persist(nextSource, nextTarget);
  };

  const setTargetLanguage = (nextTarget: StudyLanguageCode): void => {
    let nextSource = sourceLanguage;
    if (nextTarget === nextSource) {
      nextSource = targetLanguage;
    }
    setSourceLanguageState(nextSource);
    setTargetLanguageState(nextTarget);
    persist(nextSource, nextTarget);
  };

  const value = useMemo<StudyLanguagesContextValue>(
    () => ({
      sourceLanguage,
      targetLanguage,
      setSourceLanguage,
      setTargetLanguage,
      supportedLanguages: SUPPORTED_STUDY_LANGUAGES,
    }),
    [sourceLanguage, targetLanguage],
  );

  return <StudyLanguagesContext.Provider value={value}>{children}</StudyLanguagesContext.Provider>;
}

export function useStudyLanguages(): StudyLanguagesContextValue {
  return useContext(StudyLanguagesContext);
}
