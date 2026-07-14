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
    const historyElement = historyRef.current;
    if (!historyElement) {
      return;
    }
    historyElement.scrollTo({ top: historyElement.scrollHeight, behavior: "smooth" });
  }, [conversationTurnsCount, conversationLoading, conversationRecording]);

  useEffect(() => {
    const wasStarted = previousStartedRef.current;
    previousStartedRef.current = started;
    if (!started || wasStarted) {
      return;
    }

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" });
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
