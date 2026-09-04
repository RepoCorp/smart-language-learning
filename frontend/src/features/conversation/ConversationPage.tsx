import { useEffect, useState } from "react";

import {
  fetchContentItemDetail,
  fetchTopicConversationUserLiteralTranslation,
  regenerateTopicConversationGoal,
  quickAddPhraseFromConversation,
  quickAddWordFromDialog,
  sendTopicConversationHelpRequest,
  startTopicConversation,
} from "../../api";
import { useI18n } from "../../i18n";
import { usePromptPreferences } from "../../promptPreferences";
import { toItemViewSessionItem } from "../../itemViewItem";
import { STUDY_LANGUAGE_MESSAGE_KEY_BY_CODE } from "../../studyLanguageMetadata";
import { useStudyLanguages } from "../../studyLanguages";
import type { ContentItemConversationResponse, SessionItem } from "../../types";
import NewItem from "../../components/NewItem";
import ConversationActiveControls from "./ConversationActiveControls";
import {
  getInitialConversationResponseLevel,
  getInitialConversationSpeechSpeed,
  setStoredConversationResponseLevel,
  setStoredConversationSpeechSpeed,
} from "./conversationPreferences";
import ConversationSetupCard from "./ConversationSetupCard";
import ConversationReviewSection from "./ConversationReviewSection";
import { CONVERSATION_SEND_ENABLE_DELAY_SECONDS } from "./conversationConstants";
import { logRealtime, warnRealtime } from "./conversationRealtimeSupport";
import { CREATE_NEW_OPTION, RANDOM_TOPIC_OPTION } from "./conversationSetupOptions";
import ConversationTurns from "./ConversationTurns";
import { useConversationGoalEvaluation } from "./useConversationGoalEvaluation";
import { useConversationReview } from "./useConversationReview";
import { useConversationScroll } from "./useConversationScroll";
import { useConversationSetup } from "./useConversationSetup";
import {
  type ConversationPhase,
  type ConversationResponseLevel,
  type ConversationSpeechSpeed,
  type ConversationTransport,
  type GoalDifficulty,
  useConversationTransport,
} from "./useConversationTransport";

const CONVERSATION_ASSISTANT_HINT_LIMIT = 3;

type ConversationHelpEntry = {
  request_kind?: "coach" | "say";
  request_text: string;
  help_text: string;
  target_text?: string;
};

export default function ConversationPage(): JSX.Element {
  const { t } = useI18n();
  const { targetPromptMode } = usePromptPreferences();
  const { sourceLanguage, targetLanguage } = useStudyLanguages();

  const [speechSpeed, setSpeechSpeed] = useState<ConversationSpeechSpeed>(getInitialConversationSpeechSpeed);
  const [responseLevel, setResponseLevel] = useState<ConversationResponseLevel>(getInitialConversationResponseLevel);
  const conversationSetup = useConversationSetup({ sourceLanguage, targetLanguage });
  const {
    previousTopics,
    selectedTopic,
    customTopic,
    notes,
    role,
    goalDifficulty,
    selectedConversationMode,
    loadingTopics,
    goal: setupGoal,
    goalGenerating,
    goalError,
    resolvedTopic,
    setSelectedTopic,
    setCustomTopic,
    setNotes,
    setRole,
    setGoalDifficulty,
    setSelectedConversationMode,
    generateGoal,
  } = conversationSetup;

  const [started, setStarted] = useState<boolean>(false);
  const [activeTopic, setActiveTopic] = useState<string>("");
  const [activeTopicWasRandom, setActiveTopicWasRandom] = useState<boolean>(false);
  const [activeNotes, setActiveNotes] = useState<string>("");
  const [activeRole, setActiveRole] = useState<string>("");
  const [activeGoalDifficulty, setActiveGoalDifficulty] = useState<GoalDifficulty>("medium");
  const [conversationGoals, setConversationGoals] = useState<string[]>([]);
  const [currentGoalIndex, setCurrentGoalIndex] = useState<number>(0);
  const [conversationGoal, setConversationGoal] = useState<string>("");
  const [conversationPhase, setConversationPhase] = useState<ConversationPhase>("active");
  const [goalRegenerating, setGoalRegenerating] = useState<boolean>(false);
  const [goalResetKey, setGoalResetKey] = useState<number>(0);
  const [openingText, setOpeningText] = useState<string>("");
  const [openingAudioUrl, setOpeningAudioUrl] = useState<string>("");
  const [openingTranslation, setOpeningTranslation] = useState<string>("");
  const [showOpeningTranslation, setShowOpeningTranslation] = useState<boolean>(false);
  const [showTargetText, setShowTargetText] = useState<boolean>(targetPromptMode === "text");

  const [conversationTurns, setConversationTurns] = useState<ContentItemConversationResponse[]>([]);
  const [conversationLoading, setConversationLoading] = useState<boolean>(false);
  const [autoStartListening, setAutoStartListening] = useState<boolean>(false);
  const [conversationError, setConversationError] = useState<string>("");
  const [conversationPendingAssistantText, setConversationPendingAssistantText] = useState<string>("");
  const [conversationPendingUserTurn, setConversationPendingUserTurn] = useState<boolean>(false);
  const [conversationFinished, setConversationFinished] = useState<boolean>(false);
  const [conversationEnded, setConversationEnded] = useState<boolean>(false);
  const [assistantSpeaking, setAssistantSpeaking] = useState<boolean>(false);
  const [assistantHintsUsed, setAssistantHintsUsed] = useState<number>(0);
  const [assistantRevealUsedByTurn, setAssistantRevealUsedByTurn] = useState<Record<number, boolean>>({});
  const [helpOpen, setHelpOpen] = useState<boolean>(false);
  const [helpLoading, setHelpLoading] = useState<boolean>(false);
  const [helpError, setHelpError] = useState<string>("");
  const [helpInput, setHelpInput] = useState<string>("");
  const [helpSayInput, setHelpSayInput] = useState<string>("");
  const [helpHistory, setHelpHistory] = useState<ConversationHelpEntry[]>([]);
  const [conversationTranslationVisible, setConversationTranslationVisible] = useState<Record<number, boolean>>({});
  const [sentenceActionStatus, setSentenceActionStatus] = useState<Record<string, "idle" | "saving" | "added" | "exists" | "error" | "missing_source">>({});
  const [pendingSentenceAdd, setPendingSentenceAdd] = useState<{
    key: string;
    source: string;
    target: string;
    dialogId?: number;
    turnIndex?: number;
  } | null>(null);
  const [wordActionStatus, setWordActionStatus] = useState<Record<string, "idle" | "saving" | "added" | "exists" | "error">>({});
  const [pendingWordAdd, setPendingWordAdd] = useState<{
    key: string;
    source: string;
    target: string;
    wordType: string;
    dialogId?: number;
    turnIndex?: number;
    sourceLine: string;
    targetLine: string;
    clickedTargetToken: string;
    note: string;
  } | null>(null);
  const [addingWord, setAddingWord] = useState<boolean>(false);
  const [openedLinkedWord, setOpenedLinkedWord] = useState<SessionItem | null>(null);
  const [loadingLinkedWord, setLoadingLinkedWord] = useState<boolean>(false);
  const sourceLanguageLabel = t(STUDY_LANGUAGE_MESSAGE_KEY_BY_CODE[sourceLanguage]);
  const targetLanguageLabel = t(STUDY_LANGUAGE_MESSAGE_KEY_BY_CODE[targetLanguage]);
  const goalDifficultyLabelByCode: Record<GoalDifficulty, Parameters<typeof t>[0]> = {
    easy: "conversation.goalDifficultyEasy",
    medium: "conversation.goalDifficultyMedium",
    hard: "conversation.goalDifficultyHard",
  };
  const hideSourceText = targetPromptMode === "audio" && !showTargetText;
  const {
    reviewDialog: conversationReviewDialog,
    generateReview: generateConversationReview,
    resetReview: resetConversationReview,
    preparationRemainingCount: conversationReviewPreparationRemainingCount,
    preparationReady: conversationReviewPreparationReady,
    finishedTranscript,
    generatedReviewAnnotations,
  } = useConversationReview({
    enabled: started,
    topic: activeTopic,
    notes: activeNotes,
    roleText: activeRole,
    goalText: conversationGoal,
    turns: conversationTurns,
    setTurns: setConversationTurns,
    sourceLanguage,
    targetLanguage,
    setLoading: setConversationLoading,
    clearError: () => setConversationError(""),
    reportError: (error) => {
      const detail = error instanceof Error ? error.message : "";
      setConversationError(detail || t("newItem.questionsError"));
    },
    onReviewGenerated: () => setConversationEnded(true),
  });
  const {
    clearGoalAchievementMessage,
  } = useConversationGoalEvaluation({
    enabled: started && !conversationFinished && conversationPhase === "active",
    assistantSpeaking,
    topic: activeTopic,
    notes: activeNotes,
    roleText: activeRole,
    goalTexts: conversationGoals,
    currentGoalIndex,
    resetKey: goalResetKey,
    turns: conversationTurns,
    sourceLanguage,
    targetLanguage,
    onGoalAdvance: (nextGoalIndex, _nextGoalText) => {
      setCurrentGoalIndex(nextGoalIndex);
      setConversationPhase("closing");
    },
    onGoalsCompleted: () => {
      setCurrentGoalIndex(conversationGoals.length);
      setConversationPhase("closing");
    },
  });

  const toggleOpeningTranslation = (): void => {
    const nextVisible = !showOpeningTranslation;
    setShowOpeningTranslation(nextVisible);
    if (nextVisible) {
      window.setTimeout(scrollConversationToBottom, 0);
    }
  };

  const updateSpeechSpeed = (speed: ConversationSpeechSpeed): void => {
    setSpeechSpeed(speed);
    setStoredConversationSpeechSpeed(speed);
  };

  const updateResponseLevel = (level: ConversationResponseLevel): void => {
    setResponseLevel(level);
    setStoredConversationResponseLevel(level);
  };

  const toggleAssistantTurnTranslation = (index: number): void => {
    const nextVisible = true;
    const showTranslation = async (): Promise<void> => {
      if (nextVisible && !conversationTurns[index]?.assistant_translation_text && conversationTurns[index]?.assistant_text) {
        try {
          const payload = await fetchTopicConversationUserLiteralTranslation(
            conversationTurns[index].assistant_text,
            sourceLanguage,
            targetLanguage,
          );
          setConversationTurns((current) => current.map((turn, turnIndex) => (
            turnIndex === index
              ? { ...turn, assistant_translation_text: payload.user_translation_text || "" }
              : turn
          )));
        } catch (error) {
          const detail = error instanceof Error ? error.message : "";
          setConversationError(detail || t("newItem.questionsError"));
          return;
        }
      }
      setConversationTranslationVisible((current) => ({ ...current, [index]: nextVisible }));
      if (nextVisible) {
        window.setTimeout(scrollConversationToBottom, 0);
      }
    };

    void showTranslation();
  };

  const hideAssistantTurnHelper = (): void => {
    setConversationTranslationVisible({});
  };

  const showAssistantTurnHint = (index: number): void => {
    const alreadyUsedForTurn = Boolean(assistantRevealUsedByTurn[index]);
    if (
      assistantSpeaking
      || (!alreadyUsedForTurn && assistantHintsUsed >= CONVERSATION_ASSISTANT_HINT_LIMIT)
      || conversationTranslationVisible[index]
    ) {
      return;
    }
    if (!alreadyUsedForTurn) {
      setAssistantHintsUsed((current) => current + 1);
      setAssistantRevealUsedByTurn((current) => ({ ...current, [index]: true }));
    }
    setPaused(true);
    toggleAssistantTurnTranslation(index);
  };

  const startConversationRecording = (): void => {
    hideAssistantTurnHelper();
    void startRecording(conversationLoading);
  };

  const cleanToken = (value: string): string => value.replace(/^[^A-Za-zÀ-ÖØ-öø-ÿ]+|[^A-Za-zÀ-ÖØ-öø-ÿ]+$/g, "").trim();
  const lineTokens = (line: string): string[] => line.split(/\s+/).filter((part) => part.trim().length > 0);

  const playAudioUrl = (audioUrl?: string): void => {
    if (!audioUrl) {
      return;
    }
    const audio = new Audio(audioUrl);
    void audio.play().catch(() => {});
  };

  const {
    conversationPaused,
    conversationRecording,
    conversationRecordingSeconds,
    conversationTransport,
    conversationRealtimeConnecting,
    conversationRealtimeReady,
    closeRealtimeSession,
    setPaused,
    setupRealtimeConversation,
    startRecording,
    stopRecording,
    setConversationTransport,
  } = useConversationTransport({
    sourceLanguage,
    targetLanguage,
    onError: setConversationError,
    onLoadingChange: setConversationLoading,
    onAssistantSpeakingChange: setAssistantSpeaking,
    onPendingUserTurnChange: setConversationPendingUserTurn,
    onConversationTurn: (response) => {
      setConversationTurns((current) => [...current, response]);
    },
    onPendingAssistantTextChange: setConversationPendingAssistantText,
    playAudioUrl,
    conversationHistory: conversationTurns.map((turn) => ({ user_text: turn.user_text, assistant_text: turn.assistant_text })),
    activeTopic,
    activeNotes,
    activeRole,
    conversationGoal,
    conversationPhase,
    speechSpeed,
    responseLevel,
  });

  useEffect(() => {
    if (
      !autoStartListening
      || !started
      || conversationLoading
      || (conversationTransport === "realtime" && !conversationRealtimeReady)
    ) {
      return;
    }
    setAutoStartListening(false);
    void startRecording(false);
  }, [
    autoStartListening,
    conversationLoading,
    conversationRealtimeReady,
    conversationTransport,
    startRecording,
    started,
  ]);
  const {
    helpModalRef,
    historyRef,
    scrollConversationToBottom,
  } = useConversationScroll({
    started,
    helpHistoryCount: helpHistory.length,
    helpLoading,
    helpOpen,
    conversationTurnsCount: conversationTurns.length,
    conversationLoading,
    conversationRecording,
  });

  useEffect(() => {
    setShowTargetText(targetPromptMode === "text");
  }, [targetPromptMode]);

  const submitHelpRequest = async (): Promise<void> => {
    const requestText = helpInput.trim();
    if (!requestText) {
      setHelpError(t("conversation.helpRequestRequired"));
      return;
    }
    setHelpLoading(true);
    setHelpError("");
    try {
      const response = await sendTopicConversationHelpRequest(
        activeTopic,
        activeNotes,
        activeRole,
        requestText,
        conversationTurns.map((turn) => ({ user_text: turn.user_text, assistant_text: turn.assistant_text })),
        "coach",
        sourceLanguage,
        targetLanguage,
      );
      setHelpHistory((current) => [
        ...current,
        {
          request_kind: response.request_kind || "coach",
          request_text: response.request_text || "",
          help_text: response.help_text || "",
          target_text: response.target_text || "",
        },
      ]);
      setHelpInput("");
    } catch (error) {
      const detail = error instanceof Error ? error.message : "";
      setHelpError(detail || t("newItem.questionsError"));
    } finally {
      setHelpLoading(false);
    }
  };

  const submitSayHelpRequest = async (): Promise<void> => {
    const requestText = helpSayInput.trim();
    if (!requestText) {
      setHelpError(t("conversation.helpSayRequestRequired"));
      return;
    }
    setHelpLoading(true);
    setHelpError("");
    try {
      const response = await sendTopicConversationHelpRequest(
        activeTopic,
        activeNotes,
        activeRole,
        requestText,
        conversationTurns.map((turn) => ({ user_text: turn.user_text, assistant_text: turn.assistant_text })),
        "say",
        sourceLanguage,
        targetLanguage,
      );
      setHelpHistory((current) => [
        ...current,
        {
          request_kind: response.request_kind || "say",
          request_text: response.request_text || "",
          help_text: response.help_text || "",
          target_text: response.target_text || "",
        },
      ]);
      setHelpSayInput("");
    } catch (error) {
      const detail = error instanceof Error ? error.message : "";
      setHelpError(detail || t("newItem.questionsError"));
    } finally {
      setHelpLoading(false);
    }
  };

  const openHelpModal = (): void => {
    setHelpError("");
    setPaused(true);
    setHelpOpen(true);
  };

  const regenerateConversationGoal = async (): Promise<void> => {
    if (!activeTopic || goalRegenerating || assistantSpeaking) {
      return;
    }
    setPaused(true);
    setGoalRegenerating(true);
    setConversationError("");
    try {
      const response = await regenerateTopicConversationGoal(
        activeTopic,
        activeNotes,
        activeRole,
        activeGoalDifficulty,
        sourceLanguage,
        targetLanguage,
      );
      const nextGoal = (response.goal_text || "").trim();
      if (!nextGoal) {
        throw new Error("Could not create a conversation goal. Please try again.");
      }
      setConversationGoal(nextGoal);
      setConversationGoals([nextGoal]);
      setCurrentGoalIndex(0);
      setConversationPhase("active");
      setGoalResetKey((current) => current + 1);
      clearGoalAchievementMessage();
    } catch (error) {
      const detail = error instanceof Error ? error.message : "";
      setConversationError(detail || t("newItem.questionsError"));
    } finally {
      setGoalRegenerating(false);
    }
  };

  const closeHelpModal = (): void => {
    setHelpError("");
    setHelpOpen(false);
  };

  const finishConversation = (): void => {
    stopRecording(false);
    closeRealtimeSession();
    setConversationError("");
    setConversationPendingAssistantText("");
    setConversationPendingUserTurn(false);
    setAssistantSpeaking(false);
    hideAssistantTurnHelper();
    setConversationFinished(true);
    setConversationEnded(false);
    resetConversationReview();
    clearGoalAchievementMessage();
  };

  const applyConversationStartState = (
    payload: Awaited<ReturnType<typeof startTopicConversation>>,
    fallbackTopic: string,
    fallbackNotes: string,
    fallbackRole: string,
    fallbackGoalDifficulty: GoalDifficulty,
    fallbackTopicWasRandom: boolean,
  ): void => {
    setStarted(true);
    setActiveTopic(payload.topic || fallbackTopic);
    setActiveTopicWasRandom(fallbackTopicWasRandom);
    setActiveNotes(payload.notes || fallbackNotes);
    setActiveRole(payload.role_text || fallbackRole);
    setActiveGoalDifficulty(payload.goal_difficulty || fallbackGoalDifficulty);
    const nextGoals = Array.isArray(payload.goals)
      ? payload.goals.map((goal) => String(goal || "").trim()).filter(Boolean)
      : [];
    const normalizedGoals = nextGoals.length ? nextGoals : [payload.goal_text || ""].filter(Boolean);
    setConversationGoals(normalizedGoals);
    setCurrentGoalIndex(0);
    setConversationGoal(normalizedGoals[0] || "");
    setConversationPhase("active");
    setOpeningText(payload.opening_text || "");
    setOpeningAudioUrl(payload.opening_audio_url || "");
    setOpeningTranslation(payload.opening_translation_text || "");
    setShowOpeningTranslation(false);
    setConversationTurns([]);
    setConversationTranslationVisible({});
    setSentenceActionStatus({});
    setWordActionStatus({});
    setPendingWordAdd(null);
    setPendingSentenceAdd(null);
    setConversationPendingAssistantText("");
    setConversationPendingUserTurn(false);
    setConversationFinished(false);
    setConversationEnded(false);
    resetConversationReview();
    setAssistantSpeaking(false);
    setAssistantHintsUsed(0);
    setAssistantRevealUsedByTurn({});
    clearGoalAchievementMessage();
  };

  const startConversation = async (): Promise<void> => {
    const startStartedAt = performance.now();
    setConversationError("");
    if (!setupGoal) {
      setConversationError(t("conversation.goalRequired"));
      return;
    }
    if (!resolvedTopic) {
      setConversationError(previousTopics.length ? t("content.error.selectOrEnterTopic") : t("content.error.enterTopic"));
      return;
    }
    setConversationLoading(true);
    try {
      const trimmedNotes = notes.trim();
      const trimmedRole = role.trim();
      logRealtime("start-request-started", {
        topic: resolvedTopic,
        sourceLanguage,
        targetLanguage,
        goalDifficulty,
        mode: selectedConversationMode,
      });
      const startRequestStartedAt = performance.now();
      const payload = await startTopicConversation(
        resolvedTopic,
        trimmedNotes,
        trimmedRole,
        goalDifficulty,
        setupGoal.text,
        sourceLanguage,
        targetLanguage,
      );
      logRealtime("start-request-finished", {
        elapsedMs: Math.round(performance.now() - startRequestStartedAt),
        goalLength: (payload.goal_text || "").length,
        hasOpeningText: Boolean(payload.opening_text),
        hasOpeningAudio: Boolean(payload.opening_audio_url),
      });
      const startRequestMs = Math.round(performance.now() - startRequestStartedAt);
      if (selectedConversationMode === "realtime") {
        logRealtime("start-conversation-http-ready", {
          topic: payload.topic || resolvedTopic,
        });
        const realtimeSetupStartedAt = performance.now();
        const realtimeEnabled = await setupRealtimeConversation({
          topic: payload.topic || resolvedTopic,
          notes: payload.notes || trimmedNotes,
          roleText: payload.role_text || trimmedRole,
          goalDifficulty: payload.goal_difficulty || goalDifficulty,
          goalText: setupGoal.text,
        }).catch((error) => {
          warnRealtime("live-setup-failed", {
            reason: error instanceof Error ? error.message : String(error),
          });
          return false;
        });
        logRealtime("start-realtime-setup-finished", {
          elapsedMs: Math.round(performance.now() - realtimeSetupStartedAt),
          realtimeEnabled,
        });
        logRealtime("start-timing-summary", {
          totalElapsedMs: Math.round(performance.now() - startStartedAt),
          startRequestMs,
          realtimeSetupMs: Math.round(performance.now() - realtimeSetupStartedAt),
          mode: "realtime",
          realtimeEnabled,
          goalLength: (payload.goal_text || "").length,
          hasOpeningText: Boolean(payload.opening_text),
          hasOpeningAudio: Boolean(payload.opening_audio_url),
        });
        if (!realtimeEnabled) {
          closeRealtimeSession();
          setConversationTransport("http");
          setConversationError(t("conversation.liveUnavailable"));
          return;
        }
        applyConversationStartState(
          payload,
          resolvedTopic,
          trimmedNotes,
          trimmedRole,
          goalDifficulty,
          selectedTopic === RANDOM_TOPIC_OPTION,
        );
        setAutoStartListening(true);
        logRealtime("start-finished", {
          elapsedMs: Math.round(performance.now() - startStartedAt),
          mode: "realtime",
        });
        return;
      }

      setConversationTransport("http");
      applyConversationStartState(
        payload,
        resolvedTopic,
        trimmedNotes,
        trimmedRole,
        goalDifficulty,
        selectedTopic === RANDOM_TOPIC_OPTION,
      );
      setAutoStartListening(true);
      logRealtime("start-timing-summary", {
        totalElapsedMs: Math.round(performance.now() - startStartedAt),
        startRequestMs,
        realtimeSetupMs: 0,
        mode: "http",
        realtimeEnabled: false,
        goalLength: (payload.goal_text || "").length,
        hasOpeningText: Boolean(payload.opening_text),
        hasOpeningAudio: Boolean(payload.opening_audio_url),
      });
      logRealtime("start-finished", {
        elapsedMs: Math.round(performance.now() - startStartedAt),
        mode: "http",
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : "";
      setConversationError(detail || t("newItem.questionsError"));
      warnRealtime("start-failed", {
        elapsedMs: Math.round(performance.now() - startStartedAt),
        reason: detail || t("newItem.questionsError"),
      });
    } finally {
      setConversationLoading(false);
    }
  };

  const restartConversation = (): void => {
    stopRecording(false);
    closeRealtimeSession();
    setConversationError("");
    setHelpError("");
    setHelpInput("");
    setHelpOpen(false);
    setHelpHistory([]);
    setStarted(false);
    setActiveTopicWasRandom(false);
    setConversationGoals([]);
    setCurrentGoalIndex(0);
    setConversationGoal("");
    setConversationPhase("active");
    setConversationTurns([]);
    setConversationTranslationVisible({});
    setSentenceActionStatus({});
    setWordActionStatus({});
    setPendingWordAdd(null);
    setPendingSentenceAdd(null);
    setOpeningText("");
    setOpeningAudioUrl("");
    setOpeningTranslation("");
    setShowOpeningTranslation(false);
    setConversationTransport("http");
    setConversationPendingUserTurn(false);
    setConversationFinished(false);
    setAutoStartListening(false);
    setConversationEnded(false);
    resetConversationReview();
    setAssistantSpeaking(false);
    setAssistantHintsUsed(0);
    setAssistantRevealUsedByTurn({});
    clearGoalAchievementMessage();

    if (activeTopic) {
      if (previousTopics.includes(activeTopic)) {
        setSelectedTopic(activeTopic);
        setCustomTopic("");
      } else {
        setSelectedTopic(CREATE_NEW_OPTION);
        setCustomTopic(activeTopic);
      }
    }
    setNotes(activeNotes);
    setRole(activeRole);
    setGoalDifficulty(activeGoalDifficulty);
  };

  const endConversation = (): void => {
    if (typeof window !== "undefined" && !window.confirm(t("conversation.endConfirm"))) {
      return;
    }
    finishConversation();
  };

  const openConversationItem = async (itemId: number): Promise<void> => {
    setLoadingLinkedWord(true);
    try {
      const detail = await fetchContentItemDetail(itemId, sourceLanguage, targetLanguage);
      setOpenedLinkedWord(toItemViewSessionItem(detail));
    } finally {
      setLoadingLinkedWord(false);
    }
  };

  const requestAddWordFromTurnToken = async (
    key: string,
    sourceText: string,
    targetText: string,
    targetTokenRaw: string,
    dialogId?: number,
    turnIndex?: number,
  ): Promise<void> => {
    const targetToken = cleanToken(targetTokenRaw);
    if (!targetToken || !sourceText.trim() || !targetText.trim()) {
      return;
    }

    setWordActionStatus((current) => ({ ...current, [key]: "saving" }));
    try {
      const check = await quickAddWordFromDialog(
        targetToken,
        targetToken,
        sourceLanguage,
        targetLanguage,
        dialogId,
        turnIndex,
        true,
        sourceText,
        targetText,
        targetToken,
      );
      if (check.exists) {
        if (!check.id) {
          setWordActionStatus((current) => ({ ...current, [key]: "error" }));
          return;
        }
        try {
          await openConversationItem(check.id);
          setWordActionStatus((current) => ({ ...current, [key]: "exists" }));
        } catch {
          setWordActionStatus((current) => ({ ...current, [key]: "error" }));
        }
        return;
      }
      setWordActionStatus((current) => ({ ...current, [key]: "idle" }));
      const resolvedWordType = String(check.word_type || "").trim();
      if (!resolvedWordType) {
        setWordActionStatus((current) => ({ ...current, [key]: "error" }));
        return;
      }
      setPendingWordAdd({
        key,
        source: check.source_text || targetToken,
        target: check.target_text || targetToken,
        wordType: resolvedWordType,
        dialogId,
        turnIndex,
        sourceLine: sourceText,
        targetLine: targetText,
        clickedTargetToken: targetToken,
        note: check.notes || "",
      });
    } catch {
      setWordActionStatus((current) => ({ ...current, [key]: "error" }));
    }
  };

  const confirmAddWordFromDialog = async (): Promise<void> => {
    if (!pendingWordAdd || addingWord) {
      return;
    }

    const { key, source, target, dialogId, turnIndex, sourceLine, targetLine, clickedTargetToken } = pendingWordAdd;
    setWordActionStatus((current) => ({ ...current, [key]: "saving" }));
    setAddingWord(true);
    try {
      const result = await quickAddWordFromDialog(
        source,
        target,
        sourceLanguage,
        targetLanguage,
        dialogId,
        turnIndex,
        false,
        sourceLine,
        targetLine,
        clickedTargetToken,
      );
      setWordActionStatus((current) => ({ ...current, [key]: result.created ? "added" : "exists" }));
      if (result.id) {
        await openConversationItem(result.id);
      }
    } catch {
      setWordActionStatus((current) => ({ ...current, [key]: "error" }));
    } finally {
      setAddingWord(false);
      setPendingWordAdd(null);
    }
  };

  const renderTargetLineWithWordLinks = ({
    baseKey,
    sourceText,
    targetText,
    dialogId,
    turnIndex,
    disableWordClicks = false,
  }: {
    baseKey: string;
    sourceText: string;
    targetText: string;
    dialogId?: number;
    turnIndex?: number;
    disableWordClicks?: boolean;
  }): JSX.Element => {
    if (!sourceText.trim()) {
      return <>{targetText}</>;
    }
    const targetTokens = lineTokens(targetText);
    if (!targetTokens.length) {
      return <>{targetText}</>;
    }

    return (
      <>
        {targetTokens.map((token, tokenIndex) => {
          const targetToken = cleanToken(token);
          if (!targetToken) {
            return (
              <span key={`${baseKey}-punct-${tokenIndex}`} className="turn-token-wrap">
                {token}
                {tokenIndex < targetTokens.length - 1 ? " " : ""}
              </span>
            );
          }
          const statusKey = `${baseKey}-target-${tokenIndex}`;
          const status = wordActionStatus[statusKey] || "idle";
          return (
            <span key={statusKey} className="turn-token-wrap">
              <button
                type="button"
                className="turn-token-button"
                onClick={() => {
                  if (disableWordClicks) {
                    return;
                  }
                  void requestAddWordFromTurnToken(statusKey, sourceText, targetText, token, dialogId, turnIndex);
                }}
                disabled={disableWordClicks || status === "saving"}
              >
                {token}
              </button>
              {tokenIndex < targetTokens.length - 1 ? " " : ""}
              {status === "saving" && <span className="turn-token-status">({t("newItem.wordAddSaving")})</span>}
              {status === "added" && <span className="turn-token-status">({t("newItem.wordAddAdded")})</span>}
              {status === "exists" && <span className="turn-token-status">({t("newItem.wordAddExists")})</span>}
              {status === "error" && <span className="turn-token-status">({t("newItem.wordAddError")})</span>}
            </span>
          );
        })}
      </>
    );
  };

  const requestAddSentenceFromConversation = async (
    key: string,
    sourceTextRaw: string,
    targetTextRaw: string,
    dialogId?: number,
    turnIndex?: number,
  ): Promise<void> => {
    const sourceText = sourceTextRaw.trim();
    const targetText = targetTextRaw.trim();
    if (!targetText) {
      return;
    }
    if (!sourceText) {
      setSentenceActionStatus((current) => ({ ...current, [key]: "missing_source" }));
      return;
    }

    setSentenceActionStatus((current) => ({ ...current, [key]: "saving" }));
    try {
      const check = await quickAddPhraseFromConversation(sourceText, targetText, sourceLanguage, targetLanguage, true, dialogId, turnIndex, sourceText, targetText);
      if (check.exists) {
        setSentenceActionStatus((current) => ({ ...current, [key]: "exists" }));
        if (check.id) {
          await openConversationItem(check.id);
        }
        return;
      }
      setSentenceActionStatus((current) => ({ ...current, [key]: "idle" }));
      setPendingSentenceAdd({
        key,
        source: check.source_text || sourceText,
        target: check.target_text || targetText,
        dialogId,
        turnIndex,
      });
    } catch {
      setSentenceActionStatus((current) => ({ ...current, [key]: "error" }));
    }
  };

  const confirmAddSentenceFromConversation = async (): Promise<void> => {
    if (!pendingSentenceAdd) {
      return;
    }
    const { key, source, target, dialogId, turnIndex } = pendingSentenceAdd;
    setSentenceActionStatus((current) => ({ ...current, [key]: "saving" }));
    try {
      const result = await quickAddPhraseFromConversation(source, target, sourceLanguage, targetLanguage, false, dialogId, turnIndex, source, target);
      setSentenceActionStatus((current) => ({ ...current, [key]: result.created ? "added" : "exists" }));
      if (result.id) {
        await openConversationItem(result.id);
      }
    } catch {
      setSentenceActionStatus((current) => ({ ...current, [key]: "error" }));
    } finally {
      setPendingSentenceAdd(null);
    }
  };

  return (
    <main className="container" data-testid="conversation-page">
      <h1>{t("conversation.title")}</h1>
      <p>{t("conversation.description")}</p>

      <section className="card">
        <ConversationSetupCard
          previousTopics={previousTopics}
          selectedTopic={selectedTopic}
          customTopic={customTopic}
          notes={notes}
          role={role}
          goalDifficulty={goalDifficulty}
          selectedConversationMode={selectedConversationMode}
          loadingTopics={loadingTopics}
          goal={setupGoal}
          goalGenerating={goalGenerating}
          goalError={goalError}
          conversationLoading={conversationLoading}
          started={started}
          controlsLocked={conversationFinished}
          resolvedTopic={resolvedTopic}
          onSelectedTopicChange={setSelectedTopic}
          onCustomTopicChange={setCustomTopic}
          onNotesChange={setNotes}
          onRoleChange={setRole}
          onGoalDifficultyChange={setGoalDifficulty}
          onConversationModeChange={setSelectedConversationMode}
          onGenerateGoal={() => {
            void generateGoal();
          }}
          onStart={() => {
            void startConversation();
          }}
        />

        {started && !conversationFinished && (
          <>
            <ConversationActiveControls
              summary={{
                role: activeRole,
              }}
              status={{
                canSendResponse: conversationRecordingSeconds >= CONVERSATION_SEND_ENABLE_DELAY_SECONDS,
                conversationPaused,
                conversationRecording,
                conversationRecordingSeconds,
                conversationLoading,
                conversationRealtimeConnecting,
                responseLevel,
                showResponseLevelControl: true,
                showSpeechSpeedControl: true,
                speechSpeed,
              }}
              controls={{
                helpLoading,
                onEndConversation: endConversation,
                onOpenHelp: openHelpModal,
                onPause: () => setPaused(true),
                onResponseLevelChange: updateResponseLevel,
                onSpeechSpeedChange: updateSpeechSpeed,
                onStartRecording: startConversationRecording,
                onStopRecording: () => stopRecording(true),
              }}
            >
              <ConversationTurns
                historyRef={historyRef}
                visibility={{
                  topic: activeTopic,
                  topicWasRandom: activeTopicWasRandom,
                  goal: conversationGoal,
                  goalRegenerating,
                  assistantHintsRemaining: Math.max(0, CONVERSATION_ASSISTANT_HINT_LIMIT - assistantHintsUsed),
                  assistantRevealUsed: assistantRevealUsedByTurn,
                  assistantSpeaking,
                  translationVisible: conversationTranslationVisible,
                }}
                actions={{
                  renderTargetLineWithWordLinks,
                  showAssistantTurnHint,
                  regenerateGoal: regenerateConversationGoal,
                }}
                conversationTurns={conversationTurns}
              />
              {conversationError && <p className="error">{conversationError}</p>}
            </ConversationActiveControls>
          </>
        )}
        {started && conversationFinished && !conversationEnded && (
          <ConversationReviewSection
            topic={activeTopic}
            role={activeRole}
            goal={conversationGoal}
            goalDifficultyLabel={t(goalDifficultyLabelByCode[activeGoalDifficulty])}
            heading={t("conversation.finishedTitle")}
            description={t("conversation.finishedDescription")}
            dialog={conversationReviewPreparationReady ? finishedTranscript.dialog : {
              dialog_id: 0,
              topic: activeTopic,
              context: "",
              audio_url: "",
              created_at: "",
              turn_count: 0,
              turns: [],
            }}
            sourceLanguage={sourceLanguage}
            targetLanguage={targetLanguage}
            wordActionStatus={wordActionStatus}
            requestAddWordFromConversation={requestAddWordFromTurnToken}
            requestAddSentenceFromConversation={requestAddSentenceFromConversation}
            sentenceActionStatus={sentenceActionStatus}
            readOnly
            originalUserTexts={conversationReviewPreparationReady ? finishedTranscript.originalUserTexts : {}}
            correctedUserTexts={conversationReviewPreparationReady ? finishedTranscript.correctedUserTexts : {}}
            naturalUserAlternatives={conversationReviewPreparationReady ? finishedTranscript.naturalUserAlternatives : {}}
            loading={conversationLoading || !conversationReviewPreparationReady}
            loadingMessage={!conversationReviewPreparationReady
              ? `${t("conversation.finishedPreparing")} (${conversationReviewPreparationRemainingCount})`
              : t("conversation.reviewGenerating")}
            primaryAction={{
              label: t("conversation.generateReview"),
              onClick: () => {
                void generateConversationReview();
              },
              disabled: conversationLoading || !conversationReviewPreparationReady,
            }}
            secondaryAction={{
              label: t("conversation.closeAfterEnd"),
              onClick: restartConversation,
              disabled: conversationLoading,
              secondary: true,
            }}
            error={conversationError}
          />
        )}
        {started && conversationEnded && conversationReviewDialog && (
          <ConversationReviewSection
            topic={activeTopic}
            role={activeRole}
            goal={conversationGoal}
            goalDifficultyLabel={t(goalDifficultyLabelByCode[activeGoalDifficulty])}
            heading={t("conversation.reviewTitle")}
            description={t("conversation.reviewDescription")}
            dialog={conversationReviewDialog}
            sourceLanguage={sourceLanguage}
            targetLanguage={targetLanguage}
            wordActionStatus={wordActionStatus}
            requestAddWordFromConversation={requestAddWordFromTurnToken}
            requestAddSentenceFromConversation={requestAddSentenceFromConversation}
            sentenceActionStatus={sentenceActionStatus}
            originalUserTexts={generatedReviewAnnotations.originalUserTexts}
            naturalUserAlternatives={generatedReviewAnnotations.naturalUserAlternatives}
            primaryAction={{
              label: t("conversation.restart"),
              onClick: restartConversation,
            }}
            error={conversationError}
          />
        )}
      </section>
      {pendingWordAdd && (
        <div className="blocking-modal-overlay" role="dialog" aria-modal="true">
          <div className="blocking-modal add-word-modal">
            <h3>{t("newItem.wordAddTitle")}</h3>
            <p className="add-word-modal-word">{pendingWordAdd.target}</p>
            <p className="add-word-modal-meaning">
              {t("newItem.wordAddMeaning", { translation: pendingWordAdd.source })}
            </p>
            <p className="add-word-modal-type">
              <strong>{t("newItem.wordAddType", { type: pendingWordAdd.wordType })}</strong>
            </p>
            <p className="hint">{t("newItem.wordAddPrompt")}</p>
            <div className="actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  setPendingWordAdd(null);
                }}
                disabled={addingWord}
              >
                {t("newItem.wordAddCancel")}
              </button>
              <button type="button" onClick={() => void confirmAddWordFromDialog()} disabled={addingWord}>
                {addingWord ? t("newItem.wordAddSaving") : t("newItem.wordAddConfirmButton")}
              </button>
            </div>
          </div>
        </div>
      )}
      {pendingSentenceAdd && (
        <div className="blocking-modal-overlay" role="dialog" aria-modal="true">
          <div className="blocking-modal add-word-modal">
            <p>
              <strong>{t("newItem.sentenceAddTitle")}</strong>
            </p>
            <p className="add-word-modal-word">{pendingSentenceAdd.target}</p>
            <p className="add-word-modal-meaning">
              {t("newItem.sentenceAddTranslation", { translation: pendingSentenceAdd.source })}
            </p>
            <p className="hint">{t("newItem.sentenceAddPrompt")}</p>
            <div className="actions">
              <button type="button" className="secondary-button" onClick={() => setPendingSentenceAdd(null)}>
                {t("newItem.sentenceAddCancel")}
              </button>
              <button type="button" onClick={() => void confirmAddSentenceFromConversation()}>
                {t("newItem.sentenceAddConfirmButton")}
              </button>
            </div>
          </div>
        </div>
      )}
      {helpOpen && (
        <div className="blocking-modal-overlay" role="dialog" aria-modal="true">
          <div ref={helpModalRef} className="blocking-modal conversation-help-modal">
            <h3>{t("conversation.helpTitle")}</h3>
            <p className="hint">{t("conversation.helpDescription")}</p>
            <textarea
              className="conversation-notes-input"
              value={helpInput}
              onChange={(event) => setHelpInput(event.target.value)}
              placeholder={t("conversation.helpInputPlaceholder")}
              rows={3}
              disabled={helpLoading}
            />
            <input
              value={helpSayInput}
              onChange={(event) => setHelpSayInput(event.target.value)}
              placeholder={t("conversation.helpSayInputPlaceholder")}
              disabled={helpLoading}
            />
            {helpHistory.map((entry, index) => (
              <div key={`help-entry-${index}`}>
                {entry.request_text && (
                  <p className="item-conversation-correction">
                    <strong>{t("conversation.helpYouSaid")}</strong> {entry.request_text}
                  </p>
                )}
                {entry.target_text && (
                  <p className="item-conversation-correction">
                    <strong>{t("conversation.helpSayResponseLabel", { language: targetLanguageLabel })}</strong> {entry.target_text}
                  </p>
                )}
                {entry.help_text && (
                  <p className="item-conversation-correction">
                    <strong>{t("conversation.helpResponseLabel")}</strong> {entry.help_text}
                  </p>
                )}
              </div>
            ))}
            {helpError && <p className="error">{helpError}</p>}
            {helpLoading && <p className="hint">{t("conversation.helpProcessing")}</p>}
            <div className="actions">
              <button type="button" className="secondary-button" onClick={closeHelpModal} disabled={helpLoading}>
                {t("content.cancel")}
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={() => void submitSayHelpRequest()}
                disabled={helpLoading || conversationLoading || !helpSayInput.trim()}
              >
                {t("conversation.helpSaySend")}
              </button>
              <button
                type="button"
                onClick={() => void submitHelpRequest()}
                disabled={helpLoading || conversationLoading || !helpInput.trim()}
              >
                {t("conversation.helpSend")}
              </button>
            </div>
          </div>
        </div>
      )}
      {openedLinkedWord && (
        <div className="blocking-modal-overlay" role="dialog" aria-modal="true">
          <div className="blocking-modal words-item-modal">
            <NewItem item={openedLinkedWord} readOnly onClose={() => setOpenedLinkedWord(null)} />
          </div>
        </div>
      )}
      {loadingLinkedWord && <p className="hint">{t("session.loading")}</p>}
    </main>
  );
}
