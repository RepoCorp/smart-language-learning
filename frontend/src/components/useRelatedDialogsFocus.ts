import { useEffect, useRef } from "react";

type RelatedDialogLike = {
  dialog_id: number;
};

type PlayingTurn = {
  dialogId: number;
  turnIndex: number;
} | null;

type UseRelatedDialogsFocusArgs<TDialog extends RelatedDialogLike> = {
  showDialogsModal: boolean;
  relatedDialogs: TDialog[];
  showAllDialogs: boolean;
  playingRelatedDialogId: number | null;
  playingRelatedDialogTurn: PlayingTurn;
};

type UseRelatedDialogsFocusResult = {
  registerRelatedDialogCardRef: (dialogId: number, element: HTMLDivElement | null) => void;
  scrollToNextRelatedDialog: (visibleDialogIds: number[], currentDialogId?: number) => void;
};

export default function useRelatedDialogsFocus<TDialog extends RelatedDialogLike>({
  showDialogsModal,
  relatedDialogs,
  showAllDialogs,
  playingRelatedDialogId,
  playingRelatedDialogTurn,
}: UseRelatedDialogsFocusArgs<TDialog>): UseRelatedDialogsFocusResult {
  const relatedDialogCardRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const previousShowDialogsModalRef = useRef<boolean>(false);

  useEffect(() => {
    if (!showDialogsModal) {
      previousShowDialogsModalRef.current = false;
      return;
    }

    const openedModal = !previousShowDialogsModalRef.current;
    previousShowDialogsModalRef.current = true;

    if (!openedModal && playingRelatedDialogId === null && playingRelatedDialogTurn === null) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      if (playingRelatedDialogId !== null) {
        const activeDialogElement = relatedDialogCardRefs.current.get(playingRelatedDialogId);
        if (activeDialogElement) {
          const activeTurn = activeDialogElement.querySelector(".turn-active-highlight");
          if (activeTurn instanceof HTMLElement) {
            activeTurn.scrollIntoView({ behavior: "smooth", block: "center" });
            return;
          }
          const matchedTurn = activeDialogElement.querySelector(".turn-highlight");
          if (matchedTurn instanceof HTMLElement) {
            matchedTurn.scrollIntoView({ behavior: "smooth", block: "center" });
            return;
          }
        }
        return;
      }

      const visibleDialogs = showAllDialogs ? relatedDialogs : relatedDialogs.slice(0, 2);
      for (const dialog of visibleDialogs) {
        const dialogElement = relatedDialogCardRefs.current.get(dialog.dialog_id);
        const matchedTurn = dialogElement?.querySelector(".turn-highlight");
        if (matchedTurn instanceof HTMLElement) {
          matchedTurn.scrollIntoView({ behavior: "smooth", block: "center" });
          return;
        }
      }
    }, 30);
    return () => window.clearTimeout(timeoutId);
  }, [showDialogsModal, relatedDialogs, showAllDialogs, playingRelatedDialogId, playingRelatedDialogTurn]);

  const registerRelatedDialogCardRef = (dialogId: number, element: HTMLDivElement | null): void => {
    if (element) {
      relatedDialogCardRefs.current.set(dialogId, element);
      return;
    }
    relatedDialogCardRefs.current.delete(dialogId);
  };

  const scrollToNextRelatedDialog = (visibleDialogIds: number[], currentDialogId?: number): void => {
    if (!visibleDialogIds.length) {
      return;
    }
    const currentIndex = currentDialogId === undefined ? -1 : visibleDialogIds.indexOf(currentDialogId);
    const nextDialogId = currentIndex >= 0
      ? visibleDialogIds[(currentIndex + 1) % visibleDialogIds.length]
      : visibleDialogIds[0];
    relatedDialogCardRefs.current.get(nextDialogId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return {
    registerRelatedDialogCardRef,
    scrollToNextRelatedDialog,
  };
}
