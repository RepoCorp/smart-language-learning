import { createContext, useContext, useLayoutEffect, useState, type ReactNode } from "react";

export const STUDY_TEXT_SIZES = [1, 1.25, 1.5, 2] as const;
export type StudyTextSize = typeof STUDY_TEXT_SIZES[number];
const STORAGE_KEY = "study_text_scale";
const isSize = (value: number): value is StudyTextSize => STUDY_TEXT_SIZES.some(size => size === value);

function readSize(): StudyTextSize {
  try {
    const value = Number(window.localStorage.getItem(STORAGE_KEY));
    return isSize(value) ? value : 1;
  } catch {
    // Storage can be blocked; accessibility must still work for this visit.
    return 1;
  }
}

const StudyTextSizeContext = createContext<{ size: StudyTextSize; setSize: (size: StudyTextSize) => void }>({
  size: 1, setSize: () => {},
});

export function StudyTextSizeProvider({ children }: { children: ReactNode }): JSX.Element {
  const [size, setState] = useState<StudyTextSize>(readSize);
  useLayoutEffect(() => {
    const style = document.documentElement.style;
    const previous = style.getPropertyValue("--study-text-scale");
    style.setProperty("--study-text-scale", String(size));
    return () => {
      if (previous) style.setProperty("--study-text-scale", previous);
      else style.removeProperty("--study-text-scale");
    };
  }, [size]);

  const setSize = (value: StudyTextSize): void => {
    if (!isSize(value)) return;
    setState(value);
    try { window.localStorage.setItem(STORAGE_KEY, String(value)); }
    catch { /* Keep the selected size for this visit when storage is unavailable. */ }
  };

  return <StudyTextSizeContext.Provider value={{ size, setSize }}>{children}</StudyTextSizeContext.Provider>;
}

export const useStudyTextSize = () => useContext(StudyTextSizeContext);
