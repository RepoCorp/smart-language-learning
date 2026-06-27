import { useEffect, useMemo, useRef, useState } from "react";

import { shouldAutoplayPrompt, suppressPromptAutoplayForAudio } from "../audioAutoplayGuard";
import { useDebugTools } from "../debugTools";
import { deterministicSort } from "../deterministic";
import { useI18n } from "../i18n";
import { usePromptPreferences } from "../promptPreferences";
import { type StudyLanguageCode, useStudyLanguages } from "../studyLanguages";
import type { SessionItem } from "../types";
import DangerousButton from "./DangerousButton";

interface PhraseReviewProps {
  item: SessionItem;
  onAnswered: (correct: boolean) => Promise<void>;
  onOpenItem?: (itemId: number) => void;
}

const FEEDBACK_DELAY_MS = 2000;

type PhraseToken = {
  id: string;
  text: string;
  originalIndex: number;
};

type DragPosition = {
  left: number;
  top: number;
};

type DragRect = DragPosition & {
  right: number;
  bottom: number;
  width: number;
  height: number;
};

type SpeechDebugLog = (event: string, details?: Record<string, unknown>) => void;

function phraseTokens(value: string): PhraseToken[] {
  return value
    .trim()
    .split(/\s+/)
    .filter((part) => part.length > 0)
    .map((part, index) => ({
      id: `${index}-${part}`,
      text: part,
      originalIndex: index,
    }));
}

function shufflePhraseTokens(tokens: PhraseToken[], seed: string): PhraseToken[] {
  if (tokens.length < 2) {
    return tokens;
  }
  const shuffled = deterministicSort(tokens, seed, (token) => `${token.id}:${token.text}`);
  const keptOriginalOrder = shuffled.every((token, index) => token.originalIndex === index);
  return keptOriginalOrder ? [...shuffled].reverse() : shuffled;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function smoothstep(value: number): number {
  const clamped = clamp(value, 0, 1);
  return clamped * clamped * (3 - 2 * clamped);
}

function isLikelyIOSDevice(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

const speechLangByCode: Record<StudyLanguageCode, string> = {
  spanish: "es-ES",
  english: "en-US",
  german: "de-DE",
  french: "fr-FR",
  italian: "it-IT",
  portuguese: "pt-PT",
};

let speechVoicesReadyPromise: Promise<SpeechSynthesisVoice[]> | null = null;
const activeSpeechUtterances = new Set<SpeechSynthesisUtterance>();

function speechSynthesisAvailable(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";
}

function speechSynthesisSnapshot(): Record<string, unknown> {
  if (!speechSynthesisAvailable()) {
    return { available: false };
  }
  return {
    available: true,
    speaking: window.speechSynthesis.speaking,
    pending: window.speechSynthesis.pending,
    paused: window.speechSynthesis.paused,
    voices: window.speechSynthesis.getVoices().length,
  };
}

function loadSpeechSynthesisVoices(timeoutMs = 1200, debugLog?: SpeechDebugLog): Promise<SpeechSynthesisVoice[]> {
  if (!speechSynthesisAvailable()) {
    debugLog?.("voices.unavailable");
    return Promise.resolve([]);
  }
  const speechSynthesis = window.speechSynthesis;
  const loadedVoices = speechSynthesis.getVoices();
  debugLog?.("voices.initial", { count: loadedVoices.length, ...speechSynthesisSnapshot() });
  if (loadedVoices.length > 0) {
    return Promise.resolve(loadedVoices);
  }
  if (speechVoicesReadyPromise) {
    debugLog?.("voices.wait_existing");
    return speechVoicesReadyPromise;
  }
  speechVoicesReadyPromise = new Promise((resolve) => {
    let settled = false;
    const finish = (reason: string): void => {
      if (settled) {
        return;
      }
      settled = true;
      window.clearTimeout(timeout);
      speechSynthesis.removeEventListener("voiceschanged", onVoicesChanged);
      const voices = speechSynthesis.getVoices();
      debugLog?.("voices.ready", { reason, count: voices.length, ...speechSynthesisSnapshot() });
      resolve(voices);
    };
    const onVoicesChanged = (): void => finish("voiceschanged");
    const timeout = window.setTimeout(() => finish("timeout"), timeoutMs);
    speechSynthesis.addEventListener("voiceschanged", onVoicesChanged);
  });
  return speechVoicesReadyPromise;
}

function warmSpeechSynthesis(debugLog?: SpeechDebugLog): void {
  if (!speechSynthesisAvailable()) {
    debugLog?.("warm.unavailable");
    return;
  }
  debugLog?.("warm.start", speechSynthesisSnapshot());
  void loadSpeechSynthesisVoices(1200, debugLog);
  window.speechSynthesis.resume();
  debugLog?.("warm.resume", speechSynthesisSnapshot());
}

function stopBrowserSpeechSynthesis(debugLog?: SpeechDebugLog): void {
  if (!speechSynthesisAvailable()) {
    debugLog?.("stop.unavailable");
    return;
  }
  const speechSynthesis = window.speechSynthesis;
  debugLog?.("stop.before", speechSynthesisSnapshot());
  speechSynthesis.cancel();
  activeSpeechUtterances.clear();
  speechSynthesis.resume();
  window.setTimeout(() => {
    speechSynthesis.cancel();
    activeSpeechUtterances.clear();
    debugLog?.("stop.after", speechSynthesisSnapshot());
  }, 0);
}

async function speakBrowserText({
  text,
  lang,
  rate,
  preferredVoiceURI,
  debugLog,
  onStart,
}: {
  text: string;
  lang: string;
  rate: number;
  preferredVoiceURI: string;
  debugLog?: SpeechDebugLog;
  onStart?: () => void;
}): Promise<string> {
  const trimmedText = text.trim();
  if (!trimmedText || !speechSynthesisAvailable()) {
    debugLog?.("speak.skipped", { hasText: Boolean(trimmedText), ...speechSynthesisSnapshot() });
    return preferredVoiceURI;
  }
  const speechSynthesis = window.speechSynthesis;
  debugLog?.("speak.start", { text: trimmedText, lang, rate, preferredVoiceURI, ...speechSynthesisSnapshot() });
  let voices = speechSynthesis.getVoices();
  debugLog?.("speak.voices_sync", { count: voices.length, ...speechSynthesisSnapshot() });
  if (voices.length === 0) {
    voices = await loadSpeechSynthesisVoices(1200, debugLog);
  }
  const langPrefix = lang.split("-")[0].toLowerCase();
  const matchingVoices = voices.filter((voice) => voice.lang.toLowerCase().startsWith(langPrefix));
  const selectedVoice = matchingVoices.find((voice) => voice.voiceURI === preferredVoiceURI) || matchingVoices[0];
  debugLog?.("speak.voice_selected", {
    voices: voices.length,
    matchingVoices: matchingVoices.length,
    selectedVoice: selectedVoice?.voiceURI || "",
    selectedLang: selectedVoice?.lang || "",
  });

  return new Promise((resolve) => {
    let resolved = false;
    const utterance = new SpeechSynthesisUtterance(trimmedText);
    activeSpeechUtterances.add(utterance);
    const finish = (reason: string, forceStop = false): void => {
      if (resolved) {
        return;
      }
      resolved = true;
      window.clearTimeout(fallbackTimeout);
      window.clearInterval(resumeInterval);
      activeSpeechUtterances.delete(utterance);
      debugLog?.("speak.finish", { reason, forceStop, ...speechSynthesisSnapshot() });
      if (forceStop) {
        stopBrowserSpeechSynthesis(debugLog);
      }
      resolve(selectedVoice?.voiceURI || preferredVoiceURI);
    };
    const fallbackTimeout = window.setTimeout(() => finish("fallback_timeout", true), Math.min(12000, Math.max(3000, trimmedText.length * 180)));
    const resumeInterval = window.setInterval(() => {
      if (speechSynthesis.paused) {
        debugLog?.("speak.resume_interval", speechSynthesisSnapshot());
        speechSynthesis.resume();
      }
    }, 250);

    speechSynthesis.resume();
    utterance.lang = lang;
    utterance.rate = rate;
    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }
    utterance.onstart = () => {
      onStart?.();
      debugLog?.("speak.onstart", speechSynthesisSnapshot());
    };
    utterance.onboundary = (event) => debugLog?.("speak.onboundary", {
      charIndex: event.charIndex,
      elapsedTime: event.elapsedTime,
      name: event.name,
      ...speechSynthesisSnapshot(),
    });
    utterance.onend = () => finish("onend");
    utterance.onerror = (event) => finish(`onerror:${(event as SpeechSynthesisErrorEvent).error}`, true);
    try {
      speechSynthesis.speak(utterance);
      debugLog?.("speak.speak_called", {
        retainedUtterances: activeSpeechUtterances.size,
        ...speechSynthesisSnapshot(),
      });
    } catch (error) {
      finish(error instanceof Error ? `throw:${error.message}` : "throw", true);
      return;
    }
    window.setTimeout(() => speechSynthesis.resume(), 120);
  });
}

export default function PhraseReview({ item, onAnswered, onOpenItem }: PhraseReviewProps): JSX.Element {
  const { t } = useI18n();
  const debugTools = useDebugTools();
  const { targetPromptMode } = usePromptPreferences();
  const { sourceLanguage, targetLanguage } = useStudyLanguages();
  const languageKeyByCode: Record<StudyLanguageCode, Parameters<typeof t>[0]> = {
    spanish: "study.language.spanish",
    english: "study.language.english",
    german: "study.language.german",
    french: "study.language.french",
    italian: "study.language.italian",
    portuguese: "study.language.portuguese",
  };
  const [feedback, setFeedback] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [showPromptText, setShowPromptText] = useState<boolean>(targetPromptMode === "text");
  const [answerRevealed, setAnswerRevealed] = useState<boolean>(false);
  const [placedPhraseTokens, setPlacedPhraseTokens] = useState<PhraseToken[]>([]);
  const [wrongPhraseTokenId, setWrongPhraseTokenId] = useState<string>("");
  const [draggingPhraseTokenId, setDraggingPhraseTokenId] = useState<string>("");
  const [draggingPhraseTokenPosition, setDraggingPhraseTokenPosition] = useState<{ left: number; top: number } | null>(null);
  const [activeLatchSlotIndex, setActiveLatchSlotIndex] = useState<number | null>(null);
  const [phraseBuilderComplete, setPhraseBuilderComplete] = useState<boolean>(false);
  const [phraseBuilderSpeechPrimed, setPhraseBuilderSpeechPrimed] = useState<boolean>(false);
  const [phraseBuilderSpeechPriming, setPhraseBuilderSpeechPriming] = useState<boolean>(false);
  const [phraseBuilderSpeechPrimeAvailable, setPhraseBuilderSpeechPrimeAvailable] = useState<boolean>(false);
  const draggingPhraseTokenIdRef = useRef<string>("");
  const phraseSlotsRef = useRef<HTMLDivElement | null>(null);
  const placedPhraseTokenCountRef = useRef<number>(0);
  const phraseBuilderCompleteRef = useRef<boolean>(false);
  const isSubmittingRef = useRef<boolean>(false);
  const phraseBuilderCompletionAudioPlayedRef = useRef<boolean>(false);
  const activePointerIdRef = useRef<number | null>(null);
  const activeLatchSlotIndexRef = useRef<number | null>(null);
  const placedTokenVoiceRef = useRef<string>("");
  const placedTokenAudioActiveRef = useRef<boolean>(false);
  const completedPhraseShouldReadRef = useRef<boolean>(true);
  const pendingGesturePhraseAudioRef = useRef<{ phraseText: string; completesPhrase: boolean } | null>(null);
  const waitingForGestureCompletionAudioRef = useRef<boolean>(false);
  const pendingPlacedTokenAudioTimeoutRef = useRef<number | null>(null);
  const pointerDragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const draggingPhraseTokenSizeRef = useRef<{ width: number; height: number }>({ width: 0, height: 0 });
  const isSpanishToGerman = item.direction !== "de_to_es";
  const allowPromptAudio = !isSpanishToGerman;
  const promptText = isSpanishToGerman ? item.spanish_text : item.german_text;
  const expectedAnswer = isSpanishToGerman ? item.german_text : item.spanish_text;
  const itemDeterministicKey = `${item.item_type}:${item.spanish_text.trim().toLowerCase()}=>${item.german_text.trim().toLowerCase()}`;
  const expectedPhraseTokens = useMemo(() => phraseTokens(expectedAnswer), [expectedAnswer]);
  const phraseBuilderTokens = useMemo(
    () => shufflePhraseTokens(expectedPhraseTokens, `phrase-builder:${itemDeterministicKey}`),
    [expectedPhraseTokens, itemDeterministicKey],
  );
  const languageLabel = isSpanishToGerman
    ? t(languageKeyByCode[targetLanguage])
    : t(languageKeyByCode[sourceLanguage]);
  const hidePromptText = targetPromptMode === "audio" && allowPromptAudio && !showPromptText;
  const useRepeatPlaceholder = Boolean(item.repeatedAfterFailure);
  const usePhraseBuilder = useRepeatPlaceholder && (item.repeatPracticeStep === "phrase_builder" || (!item.repeatPracticeStep && isSpanishToGerman));
  const shouldOfferPhraseBuilderSpeechPrime = usePhraseBuilder && phraseBuilderSpeechPrimeAvailable && !phraseBuilderSpeechPrimed;
  const shouldSuppressPromptAudio = false;

  const logSpeechDebug: SpeechDebugLog = (event, details = {}) => {
    debugTools.log("speech", event, details);
  };

  const markPhraseBuilderSpeechPrimed = (): void => {
    setPhraseBuilderSpeechPrimed(true);
  };

  const primePhraseBuilderSpeech = async (): Promise<void> => {
    if (!speechSynthesisAvailable() || phraseBuilderSpeechPriming) {
      return;
    }
    setPhraseBuilderSpeechPriming(true);
    const speechSynthesis = window.speechSynthesis;
    const lang = speechLangByCode[targetLanguage] || "de-DE";
    const langPrefix = lang.split("-")[0].toLowerCase();
    const voices = speechSynthesis.getVoices();
    const matchingVoices = voices.filter((voice) => voice.lang.toLowerCase().startsWith(langPrefix));
    const selectedVoice = matchingVoices.find((voice) => voice.voiceURI === placedTokenVoiceRef.current) || matchingVoices[0] || voices[0];

    await new Promise<void>((resolve) => {
      let resolved = false;
      const utterance = new SpeechSynthesisUtterance("ja");
      activeSpeechUtterances.add(utterance);
      const finish = (reason: string, extra: Record<string, unknown> = {}): void => {
        if (resolved) {
          return;
        }
        resolved = true;
        window.clearTimeout(fallbackTimeout);
        activeSpeechUtterances.delete(utterance);
        logSpeechDebug("prime.finish", {
          reason,
          retainedUtterances: activeSpeechUtterances.size,
          ...extra,
          ...speechSynthesisSnapshot(),
        });
        resolve();
      };
      const fallbackTimeout = window.setTimeout(() => finish("fallback_timeout"), 4000);
      utterance.lang = selectedVoice?.lang || lang;
      utterance.rate = 1.2;
      utterance.volume = 0.7;
      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }
      utterance.onstart = () => {
        placedTokenVoiceRef.current = selectedVoice?.voiceURI || placedTokenVoiceRef.current;
        markPhraseBuilderSpeechPrimed();
        logSpeechDebug("prime.onstart", {
          selectedVoice: selectedVoice?.voiceURI || "",
          selectedLang: selectedVoice?.lang || "",
          ...speechSynthesisSnapshot(),
        });
      };
      utterance.onend = () => finish("onend");
      utterance.onerror = (event) => finish("onerror", { error: (event as SpeechSynthesisErrorEvent).error });
      logSpeechDebug("prime.start", {
        selectedVoice: selectedVoice?.voiceURI || "",
        selectedLang: selectedVoice?.lang || "",
        retainedUtterances: activeSpeechUtterances.size,
        ...speechSynthesisSnapshot(),
      });
      speechSynthesis.resume();
      try {
        speechSynthesis.speak(utterance);
        logSpeechDebug("prime.speak_called", speechSynthesisSnapshot());
      } catch (error) {
        finish("throw", { error: error instanceof Error ? error.message : String(error) });
      }
    });
    setPhraseBuilderSpeechPriming(false);
  };

  const playPromptAudio = (): void => {
    if (!allowPromptAudio || !item.audio_url || shouldSuppressPromptAudio) {
      return;
    }
    const audio = new Audio(item.audio_url);
    void audio.play().catch(() => {});
  };

  const playPhraseAudio = async (): Promise<boolean> => {
    if (!item.audio_url) {
      return false;
    }
    stopBrowserSpeechSynthesis(logSpeechDebug);
    const audio = new Audio(item.audio_url);
    suppressPromptAutoplayForAudio(audio);
    await new Promise<void>((resolve) => {
      const finish = (): void => resolve();
      audio.onended = finish;
      audio.onerror = finish;
      audio.onabort = finish;
      void audio.play().catch(finish);
    });
    return true;
  };

  const isPlacedTokenAudioRunning = (): boolean => {
    return placedTokenAudioActiveRef.current || (speechSynthesisAvailable() && window.speechSynthesis.speaking);
  };

  const waitForPlacedTokenAudioToFinish = async (): Promise<void> => {
    if (!isPlacedTokenAudioRunning()) {
      return;
    }
    await new Promise<void>((resolve) => {
      const startedAt = Date.now();
      const check = (): void => {
        if (!isPlacedTokenAudioRunning() || Date.now() - startedAt > 6500) {
          logSpeechDebug("wait_audio.finish", {
            elapsedMs: Date.now() - startedAt,
            ...speechSynthesisSnapshot(),
          });
          resolve();
          return;
        }
        window.setTimeout(check, 120);
      };
      check();
    });
  };

  const playPlacedPhraseTokenAudio = async (phraseText: string): Promise<void> => {
    const trimmedPhraseText = phraseText.trim();
    if (!trimmedPhraseText) {
      return;
    }
    placedTokenAudioActiveRef.current = true;
    try {
      placedTokenVoiceRef.current = await speakBrowserText({
        text: trimmedPhraseText,
        lang: speechLangByCode[targetLanguage] || "de-DE",
        rate: 0.7,
        preferredVoiceURI: placedTokenVoiceRef.current,
        debugLog: logSpeechDebug,
        onStart: markPhraseBuilderSpeechPrimed,
      });
    } finally {
      placedTokenAudioActiveRef.current = false;
    }
  };

  const schedulePlacedPhraseTokenAudio = async (phraseText: string): Promise<boolean> => {
    if (pendingPlacedTokenAudioTimeoutRef.current !== null) {
      window.clearTimeout(pendingPlacedTokenAudioTimeoutRef.current);
      pendingPlacedTokenAudioTimeoutRef.current = null;
    }
    if (isPlacedTokenAudioRunning()) {
      logSpeechDebug("schedule.skip_running", { phraseText, ...speechSynthesisSnapshot() });
      return false;
    }
    logSpeechDebug("schedule.play", { phraseText, ...speechSynthesisSnapshot() });
    await playPlacedPhraseTokenAudio(phraseText);
    return true;
  };

  const completePhraseBuilder = async (phraseText: string, options: { skipPlacedAudio?: boolean } = {}): Promise<void> => {
    if (isSubmittingRef.current || phraseBuilderCompletionAudioPlayedRef.current) {
      return;
    }
    phraseBuilderCompletionAudioPlayedRef.current = true;
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    try {
      if (options.skipPlacedAudio) {
        logSpeechDebug("complete.skip_placed_audio", { phraseText, ...speechSynthesisSnapshot() });
      } else if (completedPhraseShouldReadRef.current) {
        await schedulePlacedPhraseTokenAudio(phraseText);
      } else {
        await waitForPlacedTokenAudioToFinish();
      }
      stopBrowserSpeechSynthesis(logSpeechDebug);
      await playPhraseAudio();
      await onAnswered(true);
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const submitWithFeedback = async (correct: boolean, message: string): Promise<void> => {
    if (isSubmitting) {
      return;
    }
    setIsSubmitting(true);
    setFeedback(message);
    try {
      const played = await playPhraseAudio();
      if (!played) {
        await new Promise((resolve) => setTimeout(resolve, FEEDBACK_DELAY_MS));
      }
      await onAnswered(correct);
    } finally {
      setIsSubmitting(false);
    }
  };

  const markSelfGradedAnswer = async (correct: boolean): Promise<void> => {
    if (isSubmitting || !answerRevealed) {
      return;
    }
    await submitWithFeedback(correct, correct ? t("phrase.feedback.correct") : t("phrase.feedback.markedWrong", { answer: expectedAnswer }));
  };

  const markWrongPhraseToken = (tokenId: string): void => {
    setWrongPhraseTokenId(tokenId);
    window.setTimeout(() => setWrongPhraseTokenId((current) => (current === tokenId ? "" : current)), 450);
  };

  const clearPhraseDrag = (): void => {
    activePointerIdRef.current = null;
    draggingPhraseTokenIdRef.current = "";
    pointerDragOffsetRef.current = { x: 0, y: 0 };
    draggingPhraseTokenSizeRef.current = { width: 0, height: 0 };
    setDraggingPhraseTokenId("");
    setDraggingPhraseTokenPosition(null);
    activeLatchSlotIndexRef.current = null;
    setActiveLatchSlotIndex(null);
  };

  const handlePhraseBuilderDrop = (tokenId: string, slotIndex: number, placedCount = placedPhraseTokenCountRef.current): boolean => {
    if (isSubmittingRef.current || phraseBuilderCompleteRef.current) {
      return false;
    }
    const token = phraseBuilderTokens.find((candidate) => candidate.id === tokenId);
    if (!token) {
      return false;
    }
    if (placedPhraseTokens.some((placedToken) => placedToken.id === token.id)) {
      return false;
    }
    if (slotIndex !== placedCount) {
      markWrongPhraseToken(token.id);
      return true;
    }
    const expectedToken = expectedPhraseTokens[placedCount];
    if (!expectedToken || token.text !== expectedToken.text) {
      markWrongPhraseToken(token.id);
      return true;
    }
    const nextPlacedTokens = [...placedPhraseTokens, token];
    const completedPhrase = nextPlacedTokens.length === expectedPhraseTokens.length;
    const placedPhraseText = nextPlacedTokens.map((placedToken) => placedToken.text).join(" ");
    const shouldReadPlacedPhrase = !isPlacedTokenAudioRunning();
    logSpeechDebug("drop.correct", {
      token: token.text,
      slotIndex,
      completedPhrase,
      placedPhraseText,
      shouldReadPlacedPhrase,
      ...speechSynthesisSnapshot(),
    });
    setPlacedPhraseTokens(nextPlacedTokens);
    setWrongPhraseTokenId("");
    if (shouldReadPlacedPhrase) {
      pendingGesturePhraseAudioRef.current = { phraseText: placedPhraseText, completesPhrase: completedPhrase };
      waitingForGestureCompletionAudioRef.current = completedPhrase;
      logSpeechDebug("gesture_audio.pending", {
        phraseText: placedPhraseText,
        completesPhrase: completedPhrase,
        ...speechSynthesisSnapshot(),
      });
    }
    if (completedPhrase) {
      completedPhraseShouldReadRef.current = false;
      setPhraseBuilderComplete(true);
      return true;
    }
    return true;
  };

  const updateActiveLatchSlotIndex = (nextSlotIndex: number | null): void => {
    if (activeLatchSlotIndexRef.current === nextSlotIndex) {
      return;
    }
    activeLatchSlotIndexRef.current = nextSlotIndex;
    setActiveLatchSlotIndex(nextSlotIndex);
  };

  const getPhraseBuilderDragState = (draggedRect: DragRect): { position: DragPosition; shouldLatch: boolean; slotIndex: number | null } => {
    const basePosition = { left: draggedRect.left, top: draggedRect.top };
    if (!draggingPhraseTokenIdRef.current || isSubmittingRef.current || phraseBuilderCompleteRef.current) {
      updateActiveLatchSlotIndex(null);
      return { position: basePosition, shouldLatch: false, slotIndex: null };
    }
    const placedCount = placedPhraseTokenCountRef.current;
    const nextSlot = phraseSlotsRef.current?.querySelector(`[data-slot-index="${placedCount}"]`);
    if (!(nextSlot instanceof HTMLElement)) {
      updateActiveLatchSlotIndex(null);
      return { position: basePosition, shouldLatch: false, slotIndex: null };
    }
    const rect = nextSlot.getBoundingClientRect();
    const draggedCenterX = draggedRect.left + (draggedRect.width / 2);
    const draggedCenterY = draggedRect.top + (draggedRect.height / 2);
    const slotCenterX = rect.left + (rect.width / 2);
    const slotCenterY = rect.top + (rect.height / 2);
    const deltaX = slotCenterX - draggedCenterX;
    const deltaY = slotCenterY - draggedCenterY;
    const distance = Math.hypot(deltaX, deltaY);
    const captureRadius = Math.max(draggedRect.width, draggedRect.height, rect.width, rect.height) * 1.9;
    if (distance > captureRadius) {
      updateActiveLatchSlotIndex(null);
      return { position: basePosition, shouldLatch: false, slotIndex: null };
    }

    updateActiveLatchSlotIndex(placedCount);
    const attractionProgress = 1 - (distance / captureRadius);
    const attractionStrength = smoothstep(attractionProgress) * 0.68;
    const targetLeft = rect.left + ((rect.width - draggedRect.width) / 2);
    const targetTop = rect.top + ((rect.height - draggedRect.height) / 2);
    const adjustedPosition = {
      left: basePosition.left + ((targetLeft - basePosition.left) * attractionStrength),
      top: basePosition.top + ((targetTop - basePosition.top) * attractionStrength),
    };
    const slotMiddleBandWidth = rect.width * 0.36;
    const slotMiddleBandHeight = rect.height * 0.36;
    const slotMiddleLeft = slotCenterX - (slotMiddleBandWidth / 2);
    const slotMiddleRight = slotCenterX + (slotMiddleBandWidth / 2);
    const slotMiddleTop = slotCenterY - (slotMiddleBandHeight / 2);
    const slotMiddleBottom = slotCenterY + (slotMiddleBandHeight / 2);
    const coversMiddleHorizontally = draggedRect.right >= slotMiddleLeft && draggedRect.left <= slotMiddleRight;
    const coversMiddleVertically = draggedRect.bottom >= slotMiddleTop && draggedRect.top <= slotMiddleBottom;
    const latchRadius = Math.max(20, Math.min(draggedRect.width, draggedRect.height, rect.width, rect.height) * 0.22);
    return {
      position: adjustedPosition,
      shouldLatch: (coversMiddleHorizontally && coversMiddleVertically) || distance <= latchRadius,
      slotIndex: placedCount,
    };
  };

  const startPointerPhraseDrag = (tokenId: string, pointerId: number, clientX: number, clientY: number, rect: DOMRect): void => {
    if (isSubmittingRef.current || phraseBuilderCompleteRef.current) {
      return;
    }
    warmSpeechSynthesis(logSpeechDebug);
    activePointerIdRef.current = pointerId;
    draggingPhraseTokenIdRef.current = tokenId;
    pointerDragOffsetRef.current = { x: clientX - rect.left, y: clientY - rect.top };
    draggingPhraseTokenSizeRef.current = { width: rect.width, height: rect.height };
    setDraggingPhraseTokenId(tokenId);
    setDraggingPhraseTokenPosition({ left: rect.left, top: rect.top });
  };

  const movePointerPhraseDrag = (pointerId: number, clientX: number, clientY: number): void => {
    if (activePointerIdRef.current !== pointerId) {
      return;
    }
    const nextPosition: DragPosition = {
      left: clientX - pointerDragOffsetRef.current.x,
      top: clientY - pointerDragOffsetRef.current.y,
    };
    const draggedRect: DragRect = {
      ...nextPosition,
      right: nextPosition.left + draggingPhraseTokenSizeRef.current.width,
      bottom: nextPosition.top + draggingPhraseTokenSizeRef.current.height,
      width: draggingPhraseTokenSizeRef.current.width,
      height: draggingPhraseTokenSizeRef.current.height,
    };
    const { position, shouldLatch, slotIndex } = getPhraseBuilderDragState(draggedRect);
    setDraggingPhraseTokenPosition(position);
    if (shouldLatch && slotIndex !== null && handlePhraseBuilderDrop(draggingPhraseTokenIdRef.current, slotIndex, slotIndex)) {
      clearPhraseDrag();
    }
  };

  const endPointerPhraseDrag = (pointerId: number): void => {
    if (activePointerIdRef.current !== pointerId) {
      return;
    }
    clearPhraseDrag();
  };

  const flushPendingGesturePhraseAudio = async (): Promise<void> => {
    const pending = pendingGesturePhraseAudioRef.current;
    if (!pending) {
      return;
    }
    pendingGesturePhraseAudioRef.current = null;
    logSpeechDebug("gesture_audio.flush", {
      phraseText: pending.phraseText,
      completesPhrase: pending.completesPhrase,
      ...speechSynthesisSnapshot(),
    });
    if (isPlacedTokenAudioRunning()) {
      logSpeechDebug("gesture_audio.skip_running", {
        phraseText: pending.phraseText,
        completesPhrase: pending.completesPhrase,
        ...speechSynthesisSnapshot(),
      });
      if (pending.completesPhrase) {
        waitingForGestureCompletionAudioRef.current = false;
        await completePhraseBuilder(pending.phraseText);
      }
      return;
    }
    await playPlacedPhraseTokenAudio(pending.phraseText);
    if (pending.completesPhrase) {
      waitingForGestureCompletionAudioRef.current = false;
      await completePhraseBuilder(pending.phraseText, { skipPlacedAudio: true });
    }
  };

  useEffect(() => {
    placedPhraseTokenCountRef.current = placedPhraseTokens.length;
  }, [placedPhraseTokens.length]);

  useEffect(() => {
    phraseBuilderCompleteRef.current = phraseBuilderComplete;
  }, [phraseBuilderComplete]);

  useEffect(() => {
    if (!usePhraseBuilder || !phraseBuilderComplete) {
      return;
    }
    const placedPhraseText = placedPhraseTokens.map((placedToken) => placedToken.text).join(" ");
    if (!placedPhraseText.trim()) {
      return;
    }
    if (waitingForGestureCompletionAudioRef.current) {
      logSpeechDebug("complete.waiting_for_gesture_audio", { placedPhraseText, ...speechSynthesisSnapshot() });
      return;
    }
    void completePhraseBuilder(placedPhraseText);
  }, [usePhraseBuilder, phraseBuilderComplete, placedPhraseTokens]);

  useEffect(() => {
    if (!usePhraseBuilder || typeof document === "undefined") {
      return undefined;
    }
    const handlePointerUp = (): void => {
      void flushPendingGesturePhraseAudio();
    };
    document.addEventListener("pointerup", handlePointerUp, true);
    return () => {
      document.removeEventListener("pointerup", handlePointerUp, true);
    };
  }, [usePhraseBuilder, placedPhraseTokens, phraseBuilderComplete]);

  useEffect(() => {
    if (!usePhraseBuilder) {
      setPhraseBuilderSpeechPrimeAvailable(false);
      return;
    }
    let cancelled = false;
    const timeoutIds: number[] = [];
    const refreshPrimeAvailability = (reason: string): void => {
      if (cancelled) {
        return;
      }
      const available = isLikelyIOSDevice() && speechSynthesisAvailable();
      setPhraseBuilderSpeechPrimeAvailable(available);
      logSpeechDebug("prime_control.availability", { reason, available, ...speechSynthesisSnapshot() });
    };

    setPhraseBuilderSpeechPrimed(false);
    setPhraseBuilderSpeechPriming(false);
    refreshPrimeAvailability("phrase_builder_start");
    [0, 250, 1000].forEach((delayMs) => {
      timeoutIds.push(window.setTimeout(() => refreshPrimeAvailability(`delay_${delayMs}`), delayMs));
    });
    if (!speechSynthesisAvailable()) {
      return () => {
        cancelled = true;
        timeoutIds.forEach((timeoutId) => window.clearTimeout(timeoutId));
      };
    }
    const handleVoicesChanged = (): void => refreshPrimeAvailability("voiceschanged");
    window.speechSynthesis.addEventListener("voiceschanged", handleVoicesChanged);
    return () => {
      cancelled = true;
      timeoutIds.forEach((timeoutId) => window.clearTimeout(timeoutId));
      window.speechSynthesis.removeEventListener("voiceschanged", handleVoicesChanged);
    };
  }, [usePhraseBuilder, item.id, item.direction, expectedAnswer]);

  useEffect(() => {
    if (!usePhraseBuilder) {
      return;
    }
    warmSpeechSynthesis(logSpeechDebug);
  }, [usePhraseBuilder, targetLanguage]);

  useEffect(() => {
    isSubmittingRef.current = isSubmitting;
  }, [isSubmitting]);

  useEffect(() => {
    setShowPromptText(targetPromptMode === "text");
  }, [targetPromptMode]);

  useEffect(() => {
    setFeedback("");
    setAnswerRevealed(false);
    setPlacedPhraseTokens([]);
    setWrongPhraseTokenId("");
    setPhraseBuilderComplete(false);
    setDraggingPhraseTokenId("");
    setDraggingPhraseTokenPosition(null);
    activeLatchSlotIndexRef.current = null;
    setActiveLatchSlotIndex(null);
    draggingPhraseTokenIdRef.current = "";
    activePointerIdRef.current = null;
    pointerDragOffsetRef.current = { x: 0, y: 0 };
    draggingPhraseTokenSizeRef.current = { width: 0, height: 0 };
    phraseBuilderCompletionAudioPlayedRef.current = false;
    placedTokenAudioActiveRef.current = false;
    completedPhraseShouldReadRef.current = true;
    pendingGesturePhraseAudioRef.current = null;
    waitingForGestureCompletionAudioRef.current = false;
    placedTokenVoiceRef.current = "";
    if (pendingPlacedTokenAudioTimeoutRef.current !== null) {
      window.clearTimeout(pendingPlacedTokenAudioTimeoutRef.current);
      pendingPlacedTokenAudioTimeoutRef.current = null;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      stopBrowserSpeechSynthesis(logSpeechDebug);
    }
  }, [item.id, item.direction]);

  useEffect(() => {
    return () => {
      if (pendingPlacedTokenAudioTimeoutRef.current !== null) {
        window.clearTimeout(pendingPlacedTokenAudioTimeoutRef.current);
        pendingPlacedTokenAudioTimeoutRef.current = null;
      }
      placedTokenAudioActiveRef.current = false;
      pendingGesturePhraseAudioRef.current = null;
      waitingForGestureCompletionAudioRef.current = false;
      stopBrowserSpeechSynthesis();
    };
  }, []);

  useEffect(() => {
    if (targetPromptMode !== "audio") {
      return;
    }
    if (!allowPromptAudio) {
      return;
    }
    if (shouldSuppressPromptAudio) {
      return;
    }
    const autoplayKey = `phrase:${item.id}:${item.audio_url || ""}:${targetPromptMode}`;
    if (!shouldAutoplayPrompt(autoplayKey)) {
      return;
    }
    playPromptAudio();
  }, [targetPromptMode, item.id, item.audio_url, allowPromptAudio, shouldSuppressPromptAudio]);

  if (usePhraseBuilder) {
    const placedIds = new Set(placedPhraseTokens.map((token) => token.id));
    return (
      <div className="phrase-builder-review">
        <p className="prompt prompt-light test-instruction">{t("phrase.builderPrompt", { language: languageLabel })}</p>
        <p className="test-source-phrase">{promptText}</p>
        {shouldOfferPhraseBuilderSpeechPrime && (
          <div className="phrase-builder-audio-prime">
            <button
              type="button"
              className="secondary-button"
              onClick={() => void primePhraseBuilderSpeech()}
              disabled={phraseBuilderSpeechPriming}
            >
              {phraseBuilderSpeechPriming ? t("phrase.builderAudioEnabling") : t("phrase.builderEnableAudio")}
            </button>
            <span className="hint">{t("phrase.builderEnableAudioHint")}</span>
          </div>
        )}
        <div className="phrase-builder-target-zone">
          <div
            ref={phraseSlotsRef}
            className="phrase-builder-slots"
            aria-label={t("phrase.builderAnswerLabel")}
          >
            {expectedPhraseTokens.map((token, index) => (
              <span
                key={token.id}
                data-slot-index={index}
                className={`phrase-builder-slot${placedPhraseTokens[index] ? " phrase-builder-slot-filled" : ""}${!placedPhraseTokens[index] && activeLatchSlotIndex === index ? " phrase-builder-slot-latching" : ""}`}
              >
                <span className="phrase-builder-slot-size">{token.text}</span>
                <span className="phrase-builder-slot-value">
                  {placedPhraseTokens[index]?.text || "\u00a0"}
                </span>
              </span>
            ))}
          </div>
        </div>
        <div className="phrase-builder-bank-scroll">
          <div className="phrase-builder-bank" aria-label={t("phrase.builderBankLabel")}>
            {phraseBuilderTokens.map((token) => {
              const isPlaced = placedIds.has(token.id);
              const isDragging = draggingPhraseTokenId === token.id;
              return (
                <span
                  key={token.id}
                  className="phrase-builder-token-shell"
                  aria-hidden={isPlaced ? true : undefined}
                >
                  <span className="phrase-builder-token-placeholder" aria-hidden="true">
                    <span className="phrase-builder-token-text">{token.text}</span>
                  </span>
                  <button
                    type="button"
                    className={`phrase-builder-token${isPlaced ? " phrase-builder-token-placed" : ""}${wrongPhraseTokenId === token.id ? " phrase-builder-token-wrong" : ""}${isDragging ? " phrase-builder-token-dragging" : ""}`}
                    style={isDragging && draggingPhraseTokenPosition
                      ? {
                        left: draggingPhraseTokenPosition.left,
                        top: draggingPhraseTokenPosition.top,
                      }
                      : undefined}
                    onPointerDown={(event) => {
                      if (isPlaced || isSubmitting || phraseBuilderComplete) {
                        return;
                      }
                      event.preventDefault();
                      event.currentTarget.setPointerCapture(event.pointerId);
                      startPointerPhraseDrag(token.id, event.pointerId, event.clientX, event.clientY, event.currentTarget.getBoundingClientRect());
                    }}
                    onPointerMove={(event) => {
                      if (activePointerIdRef.current !== event.pointerId) {
                        return;
                      }
                      event.preventDefault();
                      movePointerPhraseDrag(event.pointerId, event.clientX, event.clientY);
                    }}
                    onPointerUp={(event) => {
                      event.preventDefault();
                      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                        event.currentTarget.releasePointerCapture(event.pointerId);
                      }
                      void flushPendingGesturePhraseAudio();
                      endPointerPhraseDrag(event.pointerId);
                    }}
                    onPointerCancel={(event) => {
                      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                        event.currentTarget.releasePointerCapture(event.pointerId);
                      }
                      endPointerPhraseDrag(event.pointerId);
                    }}
                    disabled={isPlaced || isSubmitting || phraseBuilderComplete}
                    tabIndex={isPlaced ? -1 : undefined}
                  >
                    <span className="phrase-builder-token-text">{token.text}</span>
                  </button>
                </span>
              );
            })}
          </div>
        </div>
        {phraseBuilderComplete && <p className="phrase-builder-success">{t("phrase.builderComplete")}</p>}
        <div className="actions">
          {onOpenItem ? (
            <button type="button" className="secondary-button" onClick={() => onOpenItem(item.id)}>
              {t("words.openItem")}
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div>
      {targetPromptMode === "audio" && allowPromptAudio && (
        <div className="prompt-visibility-controls">
          <button type="button" className="secondary-button" onClick={() => setShowPromptText((value) => !value)}>
            {showPromptText ? t("prompt.hideText") : t("prompt.showText")}
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={playPromptAudio}
            disabled={!allowPromptAudio || !item.audio_url}
          >
            {t("prompt.playAudio")}
          </button>
        </div>
      )}
      {hidePromptText ? (
        <p className="prompt prompt-audio-placeholder">{t("prompt.audioOnly")}</p>
      ) : (
        <>
          <p className="prompt prompt-light test-instruction">{t("phrase.promptInstruction", { language: languageLabel })}</p>
          <p className="test-source-phrase">{promptText}</p>
        </>
      )}
      {answerRevealed && (
        <p className="revealed-answer">
          <span>{t("review.answerLabel")}</span> {expectedAnswer}
        </p>
      )}
      <div className="actions">
        {!answerRevealed ? (
          <>
            {onOpenItem ? (
              <button type="button" className="secondary-button" onClick={() => onOpenItem(item.id)}>
                {t("words.openItem")}
              </button>
            ) : null}
            <button type="button" onClick={() => setAnswerRevealed(true)} disabled={isSubmitting}>
              {t("review.revealAnswer")}
            </button>
          </>
        ) : (
          <>
            {onOpenItem ? (
              <button type="button" className="secondary-button" onClick={() => onOpenItem(item.id)}>
                {t("words.openItem")}
              </button>
            ) : null}
            <button type="button" className="item-got-it-button" onClick={() => void markSelfGradedAnswer(true)} disabled={isSubmitting}>
              {t("review.passed")}
            </button>
            <DangerousButton className="dangerous-primary-button" onConfirm={() => markSelfGradedAnswer(false)} disabled={isSubmitting}>
              {t("review.failed")}
            </DangerousButton>
          </>
        )}
      </div>
      {feedback && <p>{feedback}</p>}
    </div>
  );
}
