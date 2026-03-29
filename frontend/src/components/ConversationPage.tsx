import { useEffect, useRef, useState } from "react";

import {
  fetchTopicConversationUserCorrection,
  fetchTopicConversationUserLiteralTranslation,
  fetchContentTopics,
  quickAddPhraseFromConversation,
  quickAddWordFromDialog,
  sendTopicConversationAudio,
  startTopicConversation,
} from "../api";
import { useI18n } from "../i18n";
import { usePromptPreferences } from "../promptPreferences";
import { type StudyLanguageCode, useStudyLanguages } from "../studyLanguages";
import type { ContentItemConversationResponse } from "../types";

const CREATE_NEW_OPTION = "__create_new__";

interface ConversationTurn extends ContentItemConversationResponse {}
type GoalDifficulty = "easy" | "medium" | "hard";

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
  const [conversationRecording, setConversationRecording] = useState<boolean>(false);
  const [conversationRecordingSeconds, setConversationRecordingSeconds] = useState<number>(0);
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
    sourceLine: string;
    targetLine: string;
    clickedTargetToken: string;
  } | null>(null);
  const [addingWord, setAddingWord] = useState<boolean>(false);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const shouldSubmitRef = useRef<boolean>(false);
  const timerRef = useRef<number | null>(null);
  const historyRef = useRef<HTMLDivElement | null>(null);

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
    const historyElement = historyRef.current;
    if (!historyElement) {
      return;
    }
    historyElement.scrollTo({ top: historyElement.scrollHeight, behavior: "smooth" });
  }, [conversationTurns, conversationLoading, conversationRecording]);

  useEffect(() => {
    return () => {
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        shouldSubmitRef.current = false;
        recorderRef.current.stop();
      }
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, []);

  const sourceLanguageLabel = t(languageKeyByCode[sourceLanguage]);
  const goalDifficultyLabelByCode: Record<GoalDifficulty, Parameters<typeof t>[0]> = {
    easy: "conversation.goalDifficultyEasy",
    medium: "conversation.goalDifficultyMedium",
    hard: "conversation.goalDifficultyHard",
  };
  const hideTargetText = targetPromptMode === "audio" && !showTargetText;

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

  useEffect(() => {
    setShowTargetText(targetPromptMode === "text");
  }, [targetPromptMode]);

  const startConversation = async (): Promise<void> => {
    setConversationError("");
    if (!resolvedTopic) {
      setConversationError(previousTopics.length ? t("content.error.selectOrEnterTopic") : t("content.error.enterTopic"));
      return;
    }
    setConversationLoading(true);
    try {
      const payload = await startTopicConversation(
        resolvedTopic,
        notes.trim(),
        role.trim(),
        goalDifficulty,
        sourceLanguage,
        targetLanguage,
      );
      setStarted(true);
      setActiveTopic(payload.topic || resolvedTopic);
      setActiveNotes(payload.notes || notes.trim());
      setActiveRole(payload.role_text || role.trim());
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
      playAudioUrl(payload.opening_audio_url);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "";
      setConversationError(detail || t("newItem.questionsError"));
    } finally {
      setConversationLoading(false);
    }
  };

  const stopRecording = (submit: boolean): void => {
    shouldSubmitRef.current = submit;
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (!submit && streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (!submit) {
      setConversationRecording(false);
      setConversationRecordingSeconds(0);
    }
  };

  const submitRecordedAudio = async (audioBlob: Blob): Promise<void> => {
    setConversationLoading(true);
    setConversationError("");
    try {
      const response = await sendTopicConversationAudio(
        activeTopic,
        activeNotes,
        activeRole,
        conversationGoal,
        audioBlob,
        conversationTurns.map((turn) => ({ user_text: turn.user_text, assistant_text: turn.assistant_text })),
        sourceLanguage,
        targetLanguage,
      );
      setConversationTurns((current) => [...current, response]);
      if (response.assistant_audio_url) {
        playAudioUrl(response.assistant_audio_url);
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : "";
      setConversationError(detail || t("newItem.questionsError"));
    } finally {
      setConversationLoading(false);
    }
  };

  const startRecording = async (): Promise<void> => {
    if (conversationRecording || conversationLoading) {
      return;
    }
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setConversationError(t("newItem.conversationMicUnsupported"));
      return;
    }

    setConversationError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      chunksRef.current = [];
      shouldSubmitRef.current = true;

      recorder.addEventListener("dataavailable", (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      });

      recorder.addEventListener("stop", () => {
        const shouldSubmit = shouldSubmitRef.current;
        if (timerRef.current !== null) {
          window.clearInterval(timerRef.current);
          timerRef.current = null;
        }
        const liveStream = streamRef.current;
        if (liveStream) {
          liveStream.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }
        setConversationRecording(false);
        setConversationRecordingSeconds(0);
        recorderRef.current = null;
        const recordedBlob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        chunksRef.current = [];
        if (shouldSubmit && recordedBlob.size > 0) {
          void submitRecordedAudio(recordedBlob);
        }
      });

      recorder.start();
      setConversationRecording(true);
      setConversationRecordingSeconds(0);
      timerRef.current = window.setInterval(() => {
        setConversationRecordingSeconds((value) => value + 1);
      }, 1000);
    } catch {
      setConversationError(t("newItem.conversationMicDenied"));
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      recorderRef.current = null;
    }
  };

  const restartConversation = (): void => {
    stopRecording(false);
    setConversationError("");
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
        setWordActionStatus((current) => ({ ...current, [key]: "exists" }));
        return;
      }
      setWordActionStatus((current) => ({ ...current, [key]: "idle" }));
      setPendingWordAdd({
        key,
        source: check.source_text || targetToken,
        target: check.target_text || targetToken,
        sourceLine: sourceText,
        targetLine: targetText,
        clickedTargetToken: targetToken,
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
              <button type="button" onClick={() => void startConversation()} disabled={conversationLoading || loadingTopics}>
                {conversationLoading ? t("conversation.starting") : t("conversation.start")}
              </button>
            </div>
          )}
        </div>

        {started && (
          <>
            <div className="content-form-section conversation-goal-card">
              <p className="item-chat-meta"><strong>{t("conversation.topicLabel")}</strong> {activeTopic}</p>
              {activeRole && <p className="item-chat-meta"><strong>{t("conversation.roleLabel")}</strong> {activeRole}</p>}
              <p className="item-chat-meta"><strong>{t("conversation.goalDifficultyLabel")}</strong> {t(goalDifficultyLabelByCode[activeGoalDifficulty])}</p>
              <p className="item-chat-meta"><strong>{t("conversation.goalLabel")}</strong> {conversationGoal}</p>
              <div className="actions">
                {targetPromptMode === "audio" && (
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => setShowTargetText((value) => !value)}
                  >
                    {showTargetText ? t("prompt.hideText") : t("prompt.showText")}
                  </button>
                )}
                <button type="button" className="secondary-button" onClick={restartConversation} disabled={conversationLoading}>
                  {t("conversation.restart")}
                </button>
              </div>
            </div>

            <div ref={historyRef} className="item-questions-history item-chat-thread item-conversation-history">
              {openingText && (
                <div className="item-chat-entry item-chat-message item-chat-assistant">
                  <p className="item-chat-bubble">
                    {hideTargetText
                      ? <span className="prompt-audio-placeholder">{t("prompt.audioOnly")}</span>
                      : renderTargetLineWithWordLinks({
                        baseKey: "opening",
                        sourceText: openingTranslation,
                        targetText: openingText,
                      })}
                  </p>
                  {openingTranslation && showOpeningTranslation && (
                    <p className="item-conversation-translation"><strong>{sourceLanguageLabel}:</strong> {openingTranslation}</p>
                  )}
                  <div className="turn-action-row turn-action-row-assistant">
                    {openingAudioUrl && (
                      <button
                        type="button"
                        className="turn-audio-button"
                        onClick={() => playAudioUrl(openingAudioUrl)}
                      >
                        {t("newItem.playTurnAudio")}
                      </button>
                    )}
                    {openingTranslation && (
                      <button
                        type="button"
                        className="item-conversation-translation-toggle"
                        onClick={toggleOpeningTranslation}
                      >
                        {showOpeningTranslation ? t("newItem.conversationHideTranslation") : t("newItem.conversationShowTranslation")}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {!conversationTurns.length && !openingText && (
                <p className="hint item-conversation-empty">{t("newItem.conversationEmpty")}</p>
              )}

              {conversationTurns.map((turn, index) => (
                <div key={`conversation-turn-${index}`} className="item-chat-entry">
                  <div className="item-chat-message item-chat-user">
                    <p className="item-chat-meta">{t("newItem.conversationLabelYou")}</p>
                    <p className="item-chat-bubble">{turn.user_text}</p>
                    {conversationUserTranslationVisible[index] && (
                      <p className="item-conversation-correction item-conversation-correction-translation">
                        <strong>{sourceLanguageLabel}:</strong> {turn.user_translation_text || t("newItem.conversationNoTranslation")}
                      </p>
                    )}
                    {hasTurnCorrection(turn) && conversationCorrectionVisible[index] && !!turn.user_corrected_text && (
                      <p className="item-conversation-correction">
                        <strong>{t("newItem.conversationCorrectionLabel")}</strong> {turn.user_corrected_text}
                      </p>
                    )}
                    {hasTurnCorrection(turn) && conversationCorrectionVisible[index] && !!turn.user_corrected_translation_text && (
                      <p className="item-conversation-correction item-conversation-correction-translation">
                        <strong>{sourceLanguageLabel}:</strong> {turn.user_corrected_translation_text}
                      </p>
                    )}
                    {hasTurnCorrection(turn) && conversationCorrectionVisible[index] && !!turn.user_correction_explanation && (
                      <p className="item-conversation-correction item-conversation-correction-explanation">
                        <strong>{t("newItem.conversationCorrectionExplanationLabel")}</strong> {turn.user_correction_explanation}
                      </p>
                    )}
                    <div className="turn-action-row turn-action-row-user">
                      <button
                        type="button"
                        className="item-conversation-correction-toggle"
                        onClick={() => void toggleUserTurnTranslation(index)}
                        disabled={conversationUserTranslationLoading[index]}
                      >
                        {conversationUserTranslationVisible[index]
                          ? t("newItem.conversationHideUserTranslation")
                          : t("newItem.conversationShowUserTranslation")}
                      </button>
                      {hasTurnCorrection(turn) && (
                        <>
                          <button
                            type="button"
                            className="item-conversation-correction-toggle"
                            onClick={() => void toggleUserTurnCorrection(index)}
                            disabled={conversationUserCorrectionLoading[index]}
                          >
                            {conversationCorrectionVisible[index]
                              ? t("newItem.conversationHideCorrection")
                              : t("newItem.conversationShowCorrection")}
                          </button>
                          {conversationCorrectionVisible[index] && !!turn.user_corrected_text && (
                            <button
                              type="button"
                              className="item-conversation-correction-toggle"
                              onClick={() => void requestAddSentenceFromConversation(
                                `conversation-corrected-${index}`,
                                turn.user_corrected_translation_text || turn.user_translation_text || "",
                                turn.user_corrected_text,
                              )}
                            >
                              {t("newItem.sentenceAddButton")}
                            </button>
                          )}
                          {(sentenceActionStatus[`conversation-corrected-${index}`] || "idle") !== "idle" && (
                            <span className="turn-token-status">
                              {sentenceActionStatus[`conversation-corrected-${index}`] === "saving" && `(${t("newItem.sentenceAddSaving")})`}
                              {sentenceActionStatus[`conversation-corrected-${index}`] === "added" && `(${t("newItem.sentenceAddAdded")})`}
                              {sentenceActionStatus[`conversation-corrected-${index}`] === "exists" && `(${t("newItem.sentenceAddExists")})`}
                              {sentenceActionStatus[`conversation-corrected-${index}`] === "error" && `(${t("newItem.sentenceAddError")})`}
                              {sentenceActionStatus[`conversation-corrected-${index}`] === "missing_source" && `(${t("newItem.sentenceAddMissingSource")})`}
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  <div className="item-chat-message item-chat-assistant">
                    <p className="item-chat-meta">{t("newItem.conversationLabelTutor")}</p>
                    <p className="item-chat-bubble">
                      {hideTargetText
                        ? <span className="prompt-audio-placeholder">{t("prompt.audioOnly")}</span>
                        : renderTargetLineWithWordLinks({
                          baseKey: `assistant-${index}`,
                          sourceText: turn.assistant_translation_text || "",
                          targetText: turn.assistant_text,
                        })}
                    </p>
                    {conversationTranslationVisible[index] && (
                      <p className="item-conversation-translation">
                        <strong>{sourceLanguageLabel}:</strong> {turn.assistant_translation_text || t("newItem.conversationNoTranslation")}
                      </p>
                    )}
                    {turn.goal_achieved && (
                      <p className="item-conversation-goal-achieved">
                        {turn.goal_achievement_message || t("conversation.goalAchievedDefault")}
                      </p>
                    )}
                    <div className="turn-action-row turn-action-row-assistant">
                      {turn.assistant_audio_url && (
                        <button
                          type="button"
                          className="turn-audio-button"
                          onClick={() => playAudioUrl(turn.assistant_audio_url)}
                        >
                          {t("newItem.playTurnAudio")}
                        </button>
                      )}
                      <button
                        type="button"
                        className="item-conversation-translation-toggle"
                        onClick={() => toggleAssistantTurnTranslation(index)}
                      >
                        {conversationTranslationVisible[index]
                          ? t("newItem.conversationHideTranslation")
                          : t("newItem.conversationShowTranslation")}
                      </button>
                      <button
                        type="button"
                        className="item-conversation-translation-toggle"
                        onClick={() => void requestAddSentenceFromConversation(
                          `conversation-assistant-${index}`,
                          turn.assistant_translation_text || "",
                          turn.assistant_text,
                        )}
                      >
                        {t("newItem.sentenceAddButton")}
                      </button>
                      {(sentenceActionStatus[`conversation-assistant-${index}`] || "idle") !== "idle" && (
                        <span className="turn-token-status">
                          {sentenceActionStatus[`conversation-assistant-${index}`] === "saving" && `(${t("newItem.sentenceAddSaving")})`}
                          {sentenceActionStatus[`conversation-assistant-${index}`] === "added" && `(${t("newItem.sentenceAddAdded")})`}
                          {sentenceActionStatus[`conversation-assistant-${index}`] === "exists" && `(${t("newItem.sentenceAddExists")})`}
                          {sentenceActionStatus[`conversation-assistant-${index}`] === "error" && `(${t("newItem.sentenceAddError")})`}
                          {sentenceActionStatus[`conversation-assistant-${index}`] === "missing_source" && `(${t("newItem.sentenceAddMissingSource")})`}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {conversationError && <p className="error">{conversationError}</p>}
            {conversationRecording && (
              <p className="item-conversation-listening">
                <span className="item-conversation-listening-dot" />
                {t("newItem.conversationListening", { seconds: conversationRecordingSeconds })}
              </p>
            )}
            {conversationLoading && <p className="hint">{t("newItem.conversationProcessing")}</p>}

            <div className="actions">
              {!conversationRecording && (
                <button type="button" onClick={() => void startRecording()} disabled={conversationLoading}>
                  {t("newItem.conversationStartRecording")}
                </button>
              )}
              {conversationRecording && (
                <button type="button" onClick={() => stopRecording(true)} disabled={conversationLoading}>
                  {t("newItem.conversationStopRecording")}
                </button>
              )}
            </div>
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
    </main>
  );
}
