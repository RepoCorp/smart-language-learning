import { shouldOpenSavedWord, wordAddPreview, type ConstructionPatternPreview } from "../dialogs/components/wordAddPreview";
import WordAddConfirmation from "../dialogs/components/WordAddConfirmation";
import { useEffect, useState } from "react";
import "./conversationSettings.css";

import {
  fetchContentItemDetail,
  regenerateTopicConversationGoal,
  quickAddPhraseFromConversation,
  quickAddWordFromDialog,
  startTopicConversation,
} from "../../api";
import { useI18n } from "../../i18n";
import { toItemViewSessionItem } from "../../itemViewItem";
import { useStudyLanguages } from "../../studyLanguages";
import type { ContentItemConversationResponse, SessionItem } from "../../types";
import LegacyItemView from "../../components/LegacyItemView";
import ConversationActiveControls from "./ConversationActiveControls";
import ConversationMoreControls from "./ConversationMoreControls";
import { useConversationPreferences } from "./useConversationPreferences";
import ConversationSetupCard from "./ConversationSetupCard";
import ConversationReviewSection from "./ConversationReviewSection";
import { CONVERSATION_SEND_ENABLE_DELAY_SECONDS } from "./conversationConstants";
import { logRealtime, warnRealtime } from "./conversationRealtimeSupport";
import { CREATE_NEW_OPTION, RANDOM_TOPIC_OPTION } from "./conversationSetupOptions";
import ConversationTurns from "./ConversationTurns";
import { useConversationReview } from "./useConversationReview";
import { useConversationScroll } from "./useConversationScroll";
import { useConversationSetup } from "./useConversationSetup";
import { createConversationEndActions } from "./ending/conversationEndActions";
import {
  type ConversationTransport,
  type GoalDifficulty,
  useConversationTransport,
} from "./useConversationTransport";

export default function ConversationPage(): JSX.Element {
  const { t } = useI18n();
  const { sourceLanguage, targetLanguage } = useStudyLanguages();

  const { speechSpeed, responseLevel, updateSpeechSpeed, updateResponseLevel } = useConversationPreferences();
  const conversationSetup = useConversationSetup({ sourceLanguage, targetLanguage });
  const {
    previousTopics,
    selectedTopic,
    customTopic,
    goalDifficulty,
    selectedConversationMode,
    loadingTopics,
    goal: setupGoal,
    goalGenerating,
    goalError,
    resolvedTopic,
    setSelectedTopic,
    setCustomTopic,
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
  const [conversationGoal, setConversationGoal] = useState<string>("");
  const [goalRegenerating, setGoalRegenerating] = useState<boolean>(false);

  const [conversationTurns, setConversationTurns] = useState<ContentItemConversationResponse[]>([]);
  const [conversationLoading, setConversationLoading] = useState<boolean>(false);
  const [autoStartListening, setAutoStartListening] = useState<boolean>(false);
  const [conversationError, setConversationError] = useState<string>("");
  const [conversationPendingAssistantText, setConversationPendingAssistantText] = useState<string>("");
  const [conversationPendingUserTurn, setConversationPendingUserTurn] = useState<boolean>(false);
  const [conversationFinished, setConversationFinished] = useState<boolean>(false);
  const [conversationEnded, setConversationEnded] = useState<boolean>(false);
  const [assistantSpeaking, setAssistantSpeaking] = useState<boolean>(false);
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
    construction?: ConstructionPatternPreview | null;
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
  const goalDifficultyLabelByCode: Record<GoalDifficulty, Parameters<typeof t>[0]> = {
    easy: "conversation.goalDifficultyEasy",
    medium: "conversation.goalDifficultyMedium",
    hard: "conversation.goalDifficultyHard",
  };
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
  const startConversationRecording = (): void => {
    void startRecording(conversationLoading);
  };

  const cleanToken = (value: string): string => value.replace(/^[^A-Za-zÀ-ÖØ-öø-ÿ]+|[^A-Za-zÀ-ÖØ-öø-ÿ]+$/g, "").trim();

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
    onConversationFinished: () => finishConversation(),
    onPendingAssistantTextChange: setConversationPendingAssistantText,
    playAudioUrl,
    conversationHistory: conversationTurns.map((turn) => ({ user_text: turn.user_text, assistant_text: turn.assistant_text })),
    activeTopic,
    activeNotes,
    activeRole,
    conversationGoal,
    conversationPhase: "active",
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
    historyRef,
  } = useConversationScroll({
    started,
    conversationTurnsCount: conversationTurns.length,
    conversationLoading,
    conversationRecording,
  });

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
        throw new Error(t("conversation.goalFailed"));
      }
      setConversationGoal(nextGoal);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "";
      setConversationError(detail || t("newItem.questionsError"));
    } finally {
      setGoalRegenerating(false);
    }
  };

  const { finishConversation, endConversation } = createConversationEndActions({
    stopRecording, closeRealtimeSession, setConversationError,
    setConversationPendingAssistantText, setConversationPendingUserTurn,
    setAssistantSpeaking, setConversationFinished,
    setConversationEnded, resetConversationReview,
    confirmEnd: () => typeof window === "undefined" || window.confirm(t("conversation.endConfirm")),
  });

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
    setConversationGoal(normalizedGoals[0] || "");
    setConversationTurns([]);
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
      const trimmedNotes = "";
      const trimmedRole = "";
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
    setStarted(false);
    setActiveTopicWasRandom(false);
    setConversationGoal("");
    setConversationTurns([]);
    setSentenceActionStatus({});
    setWordActionStatus({});
    setPendingWordAdd(null);
    setPendingSentenceAdd(null);
    setConversationTransport("http");
    setConversationPendingUserTurn(false);
    setConversationFinished(false);
    setAutoStartListening(false);
    setConversationEnded(false);
    resetConversationReview();
    setAssistantSpeaking(false);

    if (activeTopic) {
      if (previousTopics.includes(activeTopic)) {
        setSelectedTopic(activeTopic);
        setCustomTopic("");
      } else {
        setSelectedTopic(CREATE_NEW_OPTION);
        setCustomTopic(activeTopic);
      }
    }
    setGoalDifficulty(activeGoalDifficulty);
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
      if (await shouldOpenSavedWord(check, sourceLanguage, targetLanguage)) {
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
      const preview = wordAddPreview(check);
      setPendingWordAdd({
        key,
        ...preview,
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
    if (!pendingWordAdd || pendingWordAdd.construction?.replaces_word || addingWord) {
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
    <main className="container conversation-page" data-testid="conversation-page">
      <h1>{t("conversation.title")}</h1>
      <p>{t("conversation.description")}</p>

      <section className="card">
        {!started && <ConversationSetupCard
          previousTopics={previousTopics}
          selectedTopic={selectedTopic}
          customTopic={customTopic}
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
          onGoalDifficultyChange={setGoalDifficulty}
          onConversationModeChange={setSelectedConversationMode}
          onGenerateGoal={generateGoal}
          onStart={() => {
            void startConversation();
          }}
        >
          {(open, onOpenChange) => <ConversationMoreControls
            open={open}
            onOpenChange={onOpenChange}
            status={{ conversationPaused: true, conversationLoading: conversationLoading || goalGenerating,
              conversationRealtimeConnecting: false, responseLevel, speechSpeed }}
            controls={{ onPause: () => {}, onResponseLevelChange: updateResponseLevel, onSpeechSpeedChange: updateSpeechSpeed }}
          />}
        </ConversationSetupCard>}

        {started && !conversationFinished && (
          <>
            <ConversationActiveControls
              status={{
                canSendResponse: conversationRecordingSeconds >= CONVERSATION_SEND_ENABLE_DELAY_SECONDS,
                conversationPaused,
                conversationRecording,
                conversationRecordingSeconds,
                conversationLoading,
                conversationRealtimeConnecting,
                responseLevel,
                speechSpeed,
              }}
              controls={{
                onEndConversation: endConversation,
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
                  assistantSpeaking,
                }}
                actions={{
                  regenerateGoal: regenerateConversationGoal,
                }}
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
      {pendingWordAdd && <WordAddConfirmation item={pendingWordAdd} saving={addingWord} onCancel={() => setPendingWordAdd(null)} onConfirm={() => void confirmAddWordFromDialog()} />}
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
      {openedLinkedWord && (
        <div className="blocking-modal-overlay" role="dialog" aria-modal="true">
          <div className="blocking-modal words-item-modal">
            <LegacyItemView item={openedLinkedWord} readOnly onClose={() => setOpenedLinkedWord(null)} />
          </div>
        </div>
      )}
      {loadingLinkedWord && <p className="hint">{t("session.loading")}</p>}
    </main>
  );
}
