import { useCallback, useEffect, useRef, type MutableRefObject } from "react";

type Args = {
  isSubmitting: boolean;
};

type Result = {
  inputRef: MutableRefObject<HTMLInputElement | null>;
  focusInput: () => void;
  scheduleRefocus: () => void;
  blurInputOnMobileCompletion: () => void;
};

function isLikelyMobileKeyboardContext(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia("(pointer: coarse)").matches;
}

export function useWordChallengeInputFocus({ isSubmitting }: Args): Result {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const pendingRefocusRef = useRef<boolean>(false);

  const focusInput = useCallback((): void => {
    inputRef.current?.focus({ preventScroll: true });
  }, []);

  const scheduleRefocus = useCallback((): void => {
    pendingRefocusRef.current = true;
  }, []);

  const blurInputOnMobileCompletion = useCallback((): void => {
    if (!isLikelyMobileKeyboardContext()) {
      return;
    }
    const input = inputRef.current;
    if (!input) {
      return;
    }
    if (typeof document !== "undefined" && document.activeElement !== input) {
      return;
    }
    input.blur();
  }, []);

  useEffect(() => {
    if (!pendingRefocusRef.current || isSubmitting) {
      return;
    }
    pendingRefocusRef.current = false;
    window.setTimeout(() => {
      inputRef.current?.focus({ preventScroll: true });
    }, 0);
  }, [isSubmitting]);

  return {
    inputRef,
    focusInput,
    scheduleRefocus,
    blurInputOnMobileCompletion,
  };
}
