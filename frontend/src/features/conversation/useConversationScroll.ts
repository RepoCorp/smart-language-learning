import { useEffect, useRef } from "react";

interface UseConversationScrollParams {
  started: boolean;
  helpHistoryCount: number;
  helpLoading: boolean;
  helpOpen: boolean;
  conversationTurnsCount: number;
  conversationLoading: boolean;
  conversationRecording: boolean;
}

interface UseConversationScrollResult {
  helpModalRef: React.MutableRefObject<HTMLDivElement | null>;
  historyRef: React.MutableRefObject<HTMLDivElement | null>;
  scrollConversationToBottom: () => void;
}

export function useConversationScroll({
  started,
  helpHistoryCount,
  helpLoading,
  helpOpen,
  conversationTurnsCount,
  conversationLoading,
  conversationRecording,
}: UseConversationScrollParams): UseConversationScrollResult {
  const STICKY_CONTROLS_CLEARANCE_PX = 132;
  const historyRef = useRef<HTMLDivElement | null>(null);
  const helpModalRef = useRef<HTMLDivElement | null>(null);
  const previousStartedRef = useRef<boolean>(started);

  const scrollConversationToBottom = (): void => {
    const historyElement = historyRef.current;
    if (!historyElement) {
      return;
    }
    window.requestAnimationFrame(() => {
      historyElement.scrollTo({ top: historyElement.scrollHeight, behavior: "smooth" });
      window.requestAnimationFrame(() => {
        const historyRect = historyElement.getBoundingClientRect();
        const visibleBottom = window.innerHeight - STICKY_CONTROLS_CLEARANCE_PX;
        const overflow = historyRect.bottom - visibleBottom;
        if (overflow > 0) {
          window.scrollBy({ top: overflow, behavior: "smooth" });
        }
      });
    });
  };

  useEffect(() => {
    if (!helpOpen) {
      return;
    }
    const helpElement = helpModalRef.current;
    if (!helpElement) {
      return;
    }
    helpElement.scrollTo({ top: helpElement.scrollHeight, behavior: "smooth" });
  }, [helpOpen, helpHistoryCount, helpLoading]);

  useEffect(() => {
    scrollConversationToBottom();
  }, [conversationTurnsCount, conversationLoading, conversationRecording]);

  useEffect(() => {
    const wasStarted = previousStartedRef.current;
    previousStartedRef.current = started;
    if (!started || wasStarted) {
      return;
    }

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        scrollConversationToBottom();
      });
    });
  }, [started]);

  return {
    helpModalRef,
    historyRef,
    scrollConversationToBottom,
  };
}
