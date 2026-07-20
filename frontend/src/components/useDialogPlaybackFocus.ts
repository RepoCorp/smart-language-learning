import { useRef } from "react";

type FocusDialogTurnOptions = {
  fallbackToDialog?: boolean;
};

type UseDialogPlaybackFocusResult = {
  registerDialogRef: (dialogId: number, element: HTMLLIElement | null) => void;
  registerTurnRef: (dialogId: number, turnIndex: number, element: HTMLLIElement | null) => void;
  focusDialog: (dialogId: number) => void;
  focusDialogTurn: (
    dialogId: number,
    turnIndex: number,
    setExpandedDialogId: (dialogId: number | null) => void,
    options?: FocusDialogTurnOptions,
  ) => void;
};

function turnRefKey(dialogId: number, turnIndex: number): string {
  return `${dialogId}:${turnIndex}`;
}

export default function useDialogPlaybackFocus(): UseDialogPlaybackFocusResult {
  const dialogRefs = useRef<Map<number, HTMLLIElement>>(new Map());
  const turnRefs = useRef<Map<string, HTMLLIElement>>(new Map());

  const focusDialog = (dialogId: number): void => {
    window.setTimeout(() => {
      const dialogElement = dialogRefs.current.get(dialogId);
      if (!dialogElement) {
        return;
      }
      dialogElement.scrollIntoView({ behavior: "smooth", block: "center" });
      dialogElement.focus({ preventScroll: true });
    }, 0);
  };

  const registerDialogRef = (dialogId: number, element: HTMLLIElement | null): void => {
    if (element) {
      dialogRefs.current.set(dialogId, element);
      return;
    }
    dialogRefs.current.delete(dialogId);
  };

  const registerTurnRef = (dialogId: number, turnIndex: number, element: HTMLLIElement | null): void => {
    const key = turnRefKey(dialogId, turnIndex);
    if (element) {
      turnRefs.current.set(key, element);
      return;
    }
    turnRefs.current.delete(key);
  };

  const focusDialogTurn = (
    dialogId: number,
    turnIndex: number,
    setExpandedDialogId: (dialogId: number | null) => void,
    options?: FocusDialogTurnOptions,
  ): void => {
    setExpandedDialogId(dialogId);
    window.setTimeout(() => {
      const turnElement = turnRefs.current.get(turnRefKey(dialogId, turnIndex));
      if (!turnElement) {
        if (options?.fallbackToDialog !== false) {
          focusDialog(dialogId);
        }
        return;
      }
      turnElement.scrollIntoView({ behavior: "smooth", block: "center" });
      turnElement.focus({ preventScroll: true });
    }, 0);
  };

  return {
    registerDialogRef,
    registerTurnRef,
    focusDialog,
    focusDialogTurn,
  };
}
