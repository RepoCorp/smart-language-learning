import { useEffect, useRef } from "react";

interface UseConversationScrollParams {
  started: boolean;
  conversationTurnsCount: number;
  conversationLoading: boolean;
  conversationRecording: boolean;
}

interface UseConversationScrollResult {
  historyRef: React.MutableRefObject<HTMLDivElement | null>;
  scrollConversationToBottom: () => void;
}

export function useConversationScroll({
  started,
  conversationTurnsCount,
  conversationLoading,
  conversationRecording,
}: UseConversationScrollParams): UseConversationScrollResult {
  const STICKY_CONTROLS_CLEARANCE_PX = 132;
  const historyRef = useRef<HTMLDivElement | null>(null);
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
    historyRef,
    scrollConversationToBottom,
  };
}
