import { useEffect, useRef, useState } from "react";

import {
  fetchContentItemDetail,
  fetchTopicConversationUserCorrection,
  fetchTopicConversationUserLiteralTranslation,
  fetchContentTopics,
  quickAddPhraseFromConversation,
  quickAddWordFromDialog,
  sendTopicConversationHelpRequest,
  startTopicConversation,
} from "../../api";
import { useI18n } from "../../i18n";
import { usePromptPreferences } from "../../promptPreferences";
import { type StudyLanguageCode, useStudyLanguages } from "../../studyLanguages";
import type { ContentItemConversationResponse, SessionItem } from "../../types";
import NewItem from "../../components/NewItem";
import ConversationActiveControls from "./ConversationActiveControls";
import { logRealtime, warnRealtime } from "./conversationRealtimeSupport";
import ConversationTurns from "./ConversationTurns";
import { type GoalDifficulty, useConversationTransport } from "./useConversationTransport";

const CREATE_NEW_OPTION = "__create_new__";

interface ConversationTurn extends ContentItemConversationResponse {}
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
  const languageKeyByCode: Record<StudyLanguageCode, Parameters<typeof t>[0]> = {
    spanish: "study.language.spanish",
    english: "study.language.english",
    german: "study.language.german",
    french: "study.language.french",
    italian: "study.language.italian",
    portuguese: "study.language.portuguese",
  };

  const [previousTopics, setPreviousTopics] = useState<string[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<string>("");
  const [customTopic, setCustomTopic] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [role, setRole] = useState<string>("");
  const [goalDifficulty, setGoalDifficulty] = useState<GoalDifficulty>("medium");
  const [loadingTopics, setLoadingTopics] = useState<boolean>(false);

  const [started, setStarted] = useState<boolean>(false);
  const [activeTopic, setActiveTopic] = useState<string>("");
  const [activeNotes, setActiveNotes] = useState<string>("");
  const [activeRole, setActiveRole] = useState<string>("");
  const [activeGoalDifficulty, setActiveGoalDifficulty] = useState<GoalDifficulty>("medium");
  const [conversationGoal, setConversationGoal] = useState<string>("");
  const [openingText, setOpeningText] = useState<string>("");
  const [openingAudioUrl, setOpeningAudioUrl] = useState<string>("");
  const [openingTranslation, setOpeningTranslation] = useState<string>("");
  const [showOpeningTranslation, setShowOpeningTranslation] = useState<boolean>(false);
  const [showTargetText, setShowTargetText] = useState<boolean>(targetPromptMode === "text");

  const [conversationTurns, setConversationTurns] = useState<ConversationTurn[]>([]);
  const [conversationLoading, setConversationLoading] = useState<boolean>(false);
  const [conversationError, setConversationError] = useState<string>("");
  const [conversationPendingAssistantText, setConversationPendingAssistantText] = useState<string>("");
  const [helpOpen, setHelpOpen] = useState<boolean>(false);
  const [helpLoading, setHelpLoading] = useState<boolean>(false);
  const [helpError, setHelpError] = useState<string>("");
  const [helpInput, setHelpInput] = useState<string>("");
  const [helpSayInput, setHelpSayInput] = useState<string>("");
  const [helpHistory, setHelpHistory] = useState<ConversationHelpEntry[]>([]);
  const [conversationTranslationVisible, setConversationTranslationVisible] = useState<Record<number, boolean>>({});
  const [conversationCorrectionVisible, setConversationCorrectionVisible] = useState<Record<number, boolean>>({});
  const [conversationUserTranslationVisible, setConversationUserTranslationVisible] = useState<Record<number, boolean>>({});
  const [conversationUserTranslationLoading, setConversationUserTranslationLoading] = useState<Record<number, boolean>>({});
  const [conversationUserCorrectionLoading, setConversationUserCorrectionLoading] = useState<Record<number, boolean>>({});
  const [sentenceActionStatus, setSentenceActionStatus] = useState<Record<string, "idle" | "saving" | "added" | "exists" | "error" | "missing_source">>({});
  const [pendingSentenceAdd, setPendingSentenceAdd] = useState<{
    key: string;
    source: string;
    target: string;
  } | null>(null);
  const [wordActionStatus, setWordActionStatus] = useState<Record<string, "idle" | "saving" | "added" | "exists" | "error">>({});
  const [pendingWordAdd, setPendingWordAdd] = useState<{
    key: string;
    source: string;
    target: string;
    wordType: string;
    sourceLine: string;
    targetLine: string;
    clickedTargetToken: string;
    note: string;
  } | null>(null);
  const [addingWord, setAddingWord] = useState<boolean>(false);
  const [openedLinkedWord, setOpenedLinkedWord] = useState<SessionItem | null>(null);
  const [loadingLinkedWord, setLoadingLinkedWord] = useState<boolean>(false);
  const historyRef = useRef<HTMLDivElement | null>(null);
  const helpModalRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let active = true;
    const loadTopics = async (): Promise<void> => {
      setLoadingTopics(true);
      try {
        const response = await fetchContentTopics(sourceLanguage, targetLanguage);
        if (!active) {
          return;
        }
        setPreviousTopics(response.topics || []);
      } catch {
        if (active) {
          setPreviousTopics([]);
        }
      } finally {
        if (active) {
          setLoadingTopics(false);
        }
      }
    };

    void loadTopics();
    return () => {
      active = false;
    };
  }, [sourceLanguage, targetLanguage]);

  useEffect(() => {
    if (!helpOpen) {
      return;
    }
    const helpElement = helpModalRef.current;
    if (!helpElement) {
      return;
    }
    helpElement.scrollTo({ top: helpElement.scrollHeight, behavior: "smooth" });
  }, [helpOpen, helpHistory, helpLoading]);

  const sourceLanguageLabel = t(languageKeyByCode[sourceLanguage]);
  const targetLanguageLabel = t(languageKeyByCode[targetLanguage]);
  const goalDifficultyLabelByCode: Record<GoalDifficulty, Parameters<typeof t>[0]> = {
    easy: "conversation.goalDifficultyEasy",
    medium: "conversation.goalDifficultyMedium",
    hard: "conversation.goalDifficultyHard",
  };
  const hideSourceText = targetPromptMode === "audio" && !showTargetText;

  const scrollConversationToBottom = (): void => {
    const historyElement = historyRef.current;
    if (!historyElement) {
      return;
    }
    window.requestAnimationFrame(() => {
      historyElement.scrollTo({ top: historyElement.scrollHeight, behavior: "smooth" });
    });
  };

  const toggleOpeningTranslation = (): void => {
    const nextVisible = !showOpeningTranslation;
    setShowOpeningTranslation(nextVisible);
    if (nextVisible) {
      window.setTimeout(scrollConversationToBottom, 0);
    }
  };

  const toggleUserTurnTranslation = async (index: number): Promise<void> => {
    const nextVisible = !Boolean(conversationUserTranslationVisible[index]);
    if (nextVisible && !conversationTurns[index]?.user_translation_text) {
      setConversationUserTranslationLoading((current) => ({ ...current, [index]: true }));
      try {
        const payload = await fetchTopicConversationUserLiteralTranslation(
          conversationTurns[index].user_text,
          sourceLanguage,
          targetLanguage,
        );
        setConversationTurns((current) => current.map((turn, turnIndex) => (
          turnIndex === index ? { ...turn, user_translation_text: payload.user_translation_text || "" } : turn
        )));
      } catch (error) {
        const detail = error instanceof Error ? error.message : "";
        setConversationError(detail || t("newItem.questionsError"));
        return;
      } finally {
        setConversationUserTranslationLoading((current) => ({ ...current, [index]: false }));
      }
    }
    setConversationUserTranslationVisible((current) => ({ ...current, [index]: nextVisible }));
    if (nextVisible) {
      window.setTimeout(scrollConversationToBottom, 0);
    }
  };

  const toggleUserTurnCorrection = async (index: number): Promise<void> => {
    const nextVisible = !Boolean(conversationCorrectionVisible[index]);
    if (nextVisible && !conversationTurns[index]?.user_corrected_text) {
      setConversationUserCorrectionLoading((current) => ({ ...current, [index]: true }));
      try {
        const payload = await fetchTopicConversationUserCorrection(
          activeTopic,
          activeNotes,
          activeRole,
          conversationGoal,
          conversationTurns[index].user_text,
          conversationTurns.slice(0, index).map((turn) => ({
            user_text: turn.user_text,
            assistant_text: turn.assistant_text,
          })),
          sourceLanguage,
          targetLanguage,
        );
        setConversationTurns((current) => current.map((turn, turnIndex) => (
          turnIndex === index
            ? {
              ...turn,
              user_corrected_text: payload.user_corrected_text || "",
              user_corrected_translation_text: payload.user_corrected_translation_text || "",
              user_correction_explanation: payload.user_correction_explanation || "",
            }
            : turn
        )));
      } catch (error) {
        const detail = error instanceof Error ? error.message : "";
        setConversationError(detail || t("newItem.questionsError"));
        return;
      } finally {
        setConversationUserCorrectionLoading((current) => ({ ...current, [index]: false }));
      }
    }
    setConversationCorrectionVisible((current) => ({ ...current, [index]: nextVisible }));
    if (nextVisible) {
      window.setTimeout(scrollConversationToBottom, 0);
    }
  };

  const toggleAssistantTurnTranslation = (index: number): void => {
    const nextVisible = !Boolean(conversationTranslationVisible[index]);
    setConversationTranslationVisible((current) => ({ ...current, [index]: nextVisible }));
    if (nextVisible) {
      window.setTimeout(scrollConversationToBottom, 0);
    }
  };

  const shouldCreateNewTopic = selectedTopic === CREATE_NEW_OPTION;

  const resolvedTopic = (shouldCreateNewTopic ? customTopic : selectedTopic).trim();
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
    conversationRecording,
    conversationRecordingSeconds,
    conversationTransport,
    conversationRealtimeConnecting,
    conversationRealtimeReady,
    conversationRealtimeVoice,
    closeRealtimeSession,
    setupRealtimeConversation,
    startRecording,
    stopRecording,
    setConversationTransport,
  } = useConversationTransport({
    sourceLanguage,
    targetLanguage,
    onError: setConversationError,
    onLoadingChange: setConversationLoading,
    onConversationTurn: (response) => {
      setConversationTurns((current) => [...current, response]);
    },
    onPendingAssistantTextChange: setConversationPendingAssistantText,
    onConversationGoalChange: setConversationGoal,
    playAudioUrl,
    conversationHistory: conversationTurns.map((turn) => ({ user_text: turn.user_text, assistant_text: turn.assistant_text })),
    activeTopic,
    activeNotes,
    activeRole,
    conversationGoal,
  });

  useEffect(() => {
    const historyElement = historyRef.current;
    if (!historyElement) {
      return;
    }
    historyElement.scrollTo({ top: historyElement.scrollHeight, behavior: "smooth" });
  }, [conversationTurns, conversationLoading, conversationRecording]);

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
    setHelpOpen(true);
  };

  const closeHelpModal = (): void => {
    setHelpError("");
    setHelpOpen(false);
  };

  const startConversation = async (): Promise<void> => {
    setConversationError("");
    if (!resolvedTopic) {
      setConversationError(previousTopics.length ? t("content.error.selectOrEnterTopic") : t("content.error.enterTopic"));
      return;
    }
    setConversationLoading(true);
    try {
      const trimmedNotes = notes.trim();
      const trimmedRole = role.trim();
      const payload = await startTopicConversation(
        resolvedTopic,
        trimmedNotes,
        trimmedRole,
        goalDifficulty,
        sourceLanguage,
        targetLanguage,
      );
      setStarted(true);
      setActiveTopic(payload.topic || resolvedTopic);
      setActiveNotes(payload.notes || trimmedNotes);
      setActiveRole(payload.role_text || trimmedRole);
      setActiveGoalDifficulty(payload.goal_difficulty || goalDifficulty);
      setConversationGoal(payload.goal_text || "");
      setOpeningText(payload.opening_text || "");
      setOpeningAudioUrl(payload.opening_audio_url || "");
      setOpeningTranslation(payload.opening_translation_text || "");
      setShowOpeningTranslation(false);
      setConversationTurns([]);
      setConversationTranslationVisible({});
      setConversationCorrectionVisible({});
      setConversationUserTranslationVisible({});
      setConversationUserTranslationLoading({});
      setConversationUserCorrectionLoading({});
      setSentenceActionStatus({});
      setWordActionStatus({});
      setPendingWordAdd(null);
      setPendingSentenceAdd(null);
      setConversationTransport("http");
      setConversationPendingAssistantText("");
      logRealtime("start-conversation-http-ready", {
        topic: payload.topic || resolvedTopic,
      });
      const realtimeEnabled = await setupRealtimeConversation({
        topic: payload.topic || resolvedTopic,
        notes: payload.notes || trimmedNotes,
        roleText: payload.role_text || trimmedRole,
        goalDifficulty: payload.goal_difficulty || goalDifficulty,
      }).catch((error) => {
        warnRealtime("fallback-to-http", {
          reason: error instanceof Error ? error.message : String(error),
        });
        return false;
      });
      if (!realtimeEnabled) {
        closeRealtimeSession();
        setConversationTransport("http");
        warnRealtime("http-transport-active");
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : "";
      setConversationError(detail || t("newItem.questionsError"));
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
    setConversationTurns([]);
    setConversationTranslationVisible({});
    setConversationCorrectionVisible({});
    setConversationUserTranslationVisible({});
    setConversationUserTranslationLoading({});
    setConversationUserCorrectionLoading({});
    setSentenceActionStatus({});
    setWordActionStatus({});
    setPendingWordAdd(null);
    setPendingSentenceAdd(null);
    setOpeningText("");
    setOpeningAudioUrl("");
    setOpeningTranslation("");
    setShowOpeningTranslation(false);
    setConversationTransport("http");

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
    restartConversation();
  };

  const requestAddWordFromTurnToken = async (
    key: string,
    sourceText: string,
    targetText: string,
    targetTokenRaw: string,
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
        undefined,
        undefined,
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
        setLoadingLinkedWord(true);
        try {
          const detail = await fetchContentItemDetail(check.id, sourceLanguage, targetLanguage);
          setOpenedLinkedWord({
            id: detail.id,
            item_type: detail.item_type,
            spanish_text: detail.spanish_text,
            german_text: detail.german_text,
            example_sentence: detail.example_sentence || "",
            notes: detail.notes || "",
            word_type: detail.word_type || check.word_type || "",
            audio_url: detail.audio_url || "",
            exercise_phrases: detail.exercise_phrases || {},
            mode: "new",
            direction: null,
            options: [],
            dialog_phrase_answer: detail.dialog_phrase_answer || "",
            dialog_phrase_scene: detail.dialog_phrase_scene || "",
            dialog_phrase_scene_audio_urls: detail.dialog_phrase_scene_audio_urls || [],
            dialog_phrase_options: detail.dialog_phrase_options || [],
            dialog_phrase_turns: detail.dialog_phrase_turns || [],
            dialog_phrase_odd_index: detail.dialog_phrase_odd_index ?? null,
            related_dialogs: detail.related_dialogs || [],
            compare_words: detail.compare_words || [],
            item_questions: detail.item_questions || [],
          });
          setWordActionStatus((current) => ({ ...current, [key]: "exists" }));
        } finally {
          setLoadingLinkedWord(false);
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

    const { key, source, target, sourceLine, targetLine, clickedTargetToken } = pendingWordAdd;
    setWordActionStatus((current) => ({ ...current, [key]: "saving" }));
    setAddingWord(true);
    try {
      const result = await quickAddWordFromDialog(
        source,
        target,
        sourceLanguage,
        targetLanguage,
        undefined,
        undefined,
        false,
        sourceLine,
        targetLine,
        clickedTargetToken,
      );
      setWordActionStatus((current) => ({ ...current, [key]: result.created ? "added" : "exists" }));
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
  }: {
    baseKey: string;
    sourceText: string;
    targetText: string;
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
                onClick={() => void requestAddWordFromTurnToken(statusKey, sourceText, targetText, token)}
                disabled={status === "saving"}
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
      const check = await quickAddPhraseFromConversation(sourceText, targetText, sourceLanguage, targetLanguage, true);
      if (check.exists) {
        setSentenceActionStatus((current) => ({ ...current, [key]: "exists" }));
        return;
      }
      setSentenceActionStatus((current) => ({ ...current, [key]: "idle" }));
      setPendingSentenceAdd({
        key,
        source: check.source_text || sourceText,
        target: check.target_text || targetText,
      });
    } catch {
      setSentenceActionStatus((current) => ({ ...current, [key]: "error" }));
    }
  };

  const confirmAddSentenceFromConversation = async (): Promise<void> => {
    if (!pendingSentenceAdd) {
      return;
    }
    const { key, source, target } = pendingSentenceAdd;
    setSentenceActionStatus((current) => ({ ...current, [key]: "saving" }));
    try {
      const result = await quickAddPhraseFromConversation(source, target, sourceLanguage, targetLanguage);
      setSentenceActionStatus((current) => ({ ...current, [key]: result.created ? "added" : "exists" }));
    } catch {
      setSentenceActionStatus((current) => ({ ...current, [key]: "error" }));
    } finally {
      setPendingSentenceAdd(null);
    }
  };

  const hasTurnCorrection = (turn: ConversationTurn): boolean => {
    if (turn.user_needs_correction) {
      return true;
    }
    const corrected = (turn.user_corrected_text || "").trim().toLowerCase();
    const original = (turn.user_text || "").trim().toLowerCase();
    return Boolean(corrected && corrected !== original);
  };

  return (
    <main className="container" data-testid="conversation-page">
      <h1>{t("conversation.title")}</h1>
      <p>{t("conversation.description")}</p>

      <section className="card">
        <div className="content-form-section">
          <label htmlFor="conversation-topic-select" className="prompt">{t("content.topic.label")}</label>
          {!resolvedTopic && <p className="content-required-hint">{t("content.topic.requiredHint")}</p>}
          <select
            id="conversation-topic-select"
            value={selectedTopic}
            onChange={(event) => setSelectedTopic(event.target.value)}
            disabled={loadingTopics || conversationLoading || started}
          >
            <option value="">{previousTopics.length ? t("content.topic.select") : t("content.topic.none")}</option>
            {previousTopics.map((savedTopic) => (
              <option key={savedTopic} value={savedTopic}>{savedTopic}</option>
            ))}
            <option value={CREATE_NEW_OPTION}>{t("content.topic.createNew")}</option>
          </select>
          {shouldCreateNewTopic && (
            <>
              <label htmlFor="conversation-topic-input" className="prompt">{t("content.topic.newLabel")}</label>
              <input
                id="conversation-topic-input"
                value={customTopic}
                onChange={(event) => setCustomTopic(event.target.value)}
                placeholder={t("content.topic.placeholder")}
                disabled={conversationLoading || started}
              />
            </>
          )}
          <div className="conversation-notes-wrap">
            <label htmlFor="conversation-notes" className="prompt">{t("conversation.notesLabel")}</label>
            <textarea
              id="conversation-notes"
              className="conversation-notes-input"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder={t("conversation.notesPlaceholder")}
              rows={4}
              disabled={conversationLoading || started}
            />
          </div>
          <div className="conversation-notes-wrap">
            <label htmlFor="conversation-role" className="prompt">{t("conversation.roleLabel")}</label>
            <input
              id="conversation-role"
              type="text"
              className="conversation-role-input"
              value={role}
              onChange={(event) => setRole(event.target.value)}
              placeholder={t("conversation.rolePlaceholder")}
              maxLength={240}
              disabled={conversationLoading || started}
            />
          </div>
          <div className="conversation-notes-wrap">
            <label className="prompt conversation-goal-difficulty-label">{t("conversation.goalDifficultyLabel")}</label>
            <div className="exercise-audio-mode">
              <label className={`exercise-radio-option ${goalDifficulty === "easy" ? "exercise-radio-option-selected" : ""}`}>
                <input
                  type="radio"
                  name="goal-difficulty"
                  checked={goalDifficulty === "easy"}
                  onChange={() => setGoalDifficulty("easy")}
                  disabled={conversationLoading || started}
                />
                <span>{t("conversation.goalDifficultyEasy")}</span>
              </label>
              <label className={`exercise-radio-option ${goalDifficulty === "medium" ? "exercise-radio-option-selected" : ""}`}>
                <input
                  type="radio"
                  name="goal-difficulty"
                  checked={goalDifficulty === "medium"}
                  onChange={() => setGoalDifficulty("medium")}
                  disabled={conversationLoading || started}
                />
                <span>{t("conversation.goalDifficultyMedium")}</span>
              </label>
              <label className={`exercise-radio-option ${goalDifficulty === "hard" ? "exercise-radio-option-selected" : ""}`}>
                <input
                  type="radio"
                  name="goal-difficulty"
                  checked={goalDifficulty === "hard"}
                  onChange={() => setGoalDifficulty("hard")}
                  disabled={conversationLoading || started}
                />
                <span>{t("conversation.goalDifficultyHard")}</span>
              </label>
            </div>
          </div>
          {!started && (
            <div className="actions">
              <button
                type="button"
                onClick={() => void startConversation()}
                disabled={conversationLoading || loadingTopics || !resolvedTopic}
              >
                {conversationLoading ? t("conversation.starting") : t("conversation.start")}
              </button>
            </div>
          )}
        </div>

        {started && (
          <>
            <ConversationActiveControls
              summary={{
                topic: activeTopic,
                role: activeRole,
                goalDifficultyLabel: t(goalDifficultyLabelByCode[activeGoalDifficulty]),
                goal: conversationGoal,
              }}
              status={{
                conversationRecording,
                conversationRecordingSeconds,
                conversationLoading,
                conversationRealtimeConnecting,
                transportHint: conversationTransport === "realtime" && conversationRealtimeReady
                  ? `Realtime voice active${conversationRealtimeVoice ? ` (${conversationRealtimeVoice})` : ""}`
                  : "Standard voice flow active",
              }}
              controls={{
                helpLoading,
                onEndConversation: endConversation,
                onOpenHelp: openHelpModal,
                onStartRecording: () => void startRecording(conversationLoading),
                onStopRecording: () => stopRecording(true),
              }}
            >
              <ConversationTurns
                historyRef={historyRef}
                opening={{
                  text: openingText,
                  translation: openingTranslation,
                  audioUrl: openingAudioUrl,
                  showTranslation: showOpeningTranslation,
                }}
                display={{
                  hideSourceText,
                  sourceLanguageLabel,
                  pendingAssistantText: conversationPendingAssistantText,
                }}
                visibility={{
                  translationVisible: conversationTranslationVisible,
                  correctionVisible: conversationCorrectionVisible,
                  userTranslationVisible: conversationUserTranslationVisible,
                  userTranslationLoading: conversationUserTranslationLoading,
                  userCorrectionLoading: conversationUserCorrectionLoading,
                  sentenceActionStatus,
                }}
                actions={{
                  renderTargetLineWithWordLinks,
                  hasTurnCorrection,
                  toggleOpeningTranslation,
                  playAudioUrl,
                  toggleUserTurnTranslation,
                  toggleUserTurnCorrection,
                  toggleAssistantTurnTranslation,
                  requestAddSentenceFromConversation,
                }}
                conversationTurns={conversationTurns}
              />
              {conversationError && <p className="error">{conversationError}</p>}
            </ConversationActiveControls>
          </>
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
            {pendingWordAdd.note && (
              <p className="hint">{t("newItem.wordAddNote", { note: pendingWordAdd.note })}</p>
            )}
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
