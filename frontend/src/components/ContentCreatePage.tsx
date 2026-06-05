import { useEffect, useState } from "react";

import { confirmContent, fetchContentItemDetail, fetchContentTopicContexts, fetchContentTopics, previewContent, quickAddPhraseFromConversation, quickAddWordFromDialog } from "../api";
import { useI18n } from "../i18n";
import { useStudyLanguages } from "../studyLanguages";
import type { ContentPreviewResponse, SessionItem } from "../types";
import NewItem from "./NewItem";

const CREATE_NEW_OPTION = "__create_new__";
type DialogLength = "standard" | "short_three";
type RequiredWordsLanguage = "source" | "target";
type PhraseActionStatus = "idle" | "saving" | "added" | "exists" | "error";

type PhraseSelection = {
  turnIndex: number;
  sourceLine: string;
  targetLine: string;
  tokenIndexes: number[];
};

type PendingPhraseAdd = PhraseSelection & {
  sourceText: string;
  targetText: string;
};

export default function ContentCreatePage(): JSX.Element {
  const { t } = useI18n();
  const { sourceLanguage, targetLanguage } = useStudyLanguages();
  const [selectedTopic, setSelectedTopic] = useState<string>("");
  const [customTopic, setCustomTopic] = useState<string>("");
  const [selectedContext, setSelectedContext] = useState<string>("");
  const [customContext, setCustomContext] = useState<string>("");
  const [conversationDetails, setConversationDetails] = useState<string>("");
  const [requiredWords, setRequiredWords] = useState<string>("");
  const [requiredWordsLanguage, setRequiredWordsLanguage] = useState<RequiredWordsLanguage>("target");
  const [dialogLength, setDialogLength] = useState<DialogLength>("standard");
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [preview, setPreview] = useState<ContentPreviewResponse | null>(null);
  const [result, setResult] = useState<string>("");
  const [dialogAudioUrl, setDialogAudioUrl] = useState<string>("");
  const [savedDialogId, setSavedDialogId] = useState<number | null>(null);
  const [savedDialogTurns, setSavedDialogTurns] = useState<Array<{ source_text: string; target_text: string; speaker?: "a" | "b"; phrase_audio_url?: string }>>([]);
  const [selectedPreviewTurnIndexes, setSelectedPreviewTurnIndexes] = useState<number[]>([]);
  const [phraseActionStatus, setPhraseActionStatus] = useState<Record<string, PhraseActionStatus>>({});
  const [phraseActionError, setPhraseActionError] = useState<Record<string, string>>({});
  const [phraseSelection, setPhraseSelection] = useState<PhraseSelection | null>(null);
  const [pendingPhraseAdd, setPendingPhraseAdd] = useState<PendingPhraseAdd | null>(null);
  const [previousTopics, setPreviousTopics] = useState<string[]>([]);
  const [previousContexts, setPreviousContexts] = useState<string[]>([]);
  const [wordActionStatus, setWordActionStatus] = useState<Record<string, "idle" | "saving" | "added" | "exists" | "error">>({});
  const [pendingWordAdd, setPendingWordAdd] = useState<{
    key: string;
    source: string;
    target: string;
    wordType: string;
    sourceLine: string;
    targetLine: string;
    clickedTargetToken: string;
    turnIndex: number;
    note: string;
  } | null>(null);
  const [addingWord, setAddingWord] = useState<boolean>(false);
  const [openedLinkedWord, setOpenedLinkedWord] = useState<SessionItem | null>(null);
  const [loadingLinkedWord, setLoadingLinkedWord] = useState<boolean>(false);

  useEffect(() => {
    let active = true;

    const loadTopics = async (): Promise<void> => {
      try {
        const response = await fetchContentTopics(sourceLanguage, targetLanguage);
        if (!active) {
          return;
        }
        setPreviousTopics(response.topics || []);
        setSelectedTopic("");
        setCustomTopic("");
        setPreviousContexts([]);
        setSelectedContext("");
        setCustomContext("");
        setConversationDetails("");
        setRequiredWords("");
        setRequiredWordsLanguage("target");
        setDialogLength("standard");
        setPreview(null);
        setResult("");
        setDialogAudioUrl("");
        setSavedDialogTurns([]);
        setSavedDialogId(null);
        setSelectedPreviewTurnIndexes([]);
        setPhraseActionStatus({});
        setPhraseActionError({});
        setPhraseSelection(null);
        setPendingPhraseAdd(null);
        setWordActionStatus({});
        setPendingWordAdd(null);
        setError("");
      } catch {
        if (active) {
          setPreviousTopics([]);
          setSelectedTopic("");
          setCustomTopic("");
          setPreviousContexts([]);
          setSelectedContext("");
          setCustomContext("");
          setConversationDetails("");
          setRequiredWords("");
          setRequiredWordsLanguage("target");
          setDialogLength("standard");
          setPreview(null);
          setResult("");
          setDialogAudioUrl("");
          setSavedDialogTurns([]);
          setSavedDialogId(null);
          setSelectedPreviewTurnIndexes([]);
          setPhraseActionStatus({});
          setPhraseActionError({});
          setPhraseSelection(null);
          setPendingPhraseAdd(null);
          setWordActionStatus({});
          setPendingWordAdd(null);
          setError("");
        }
      }
    };

    void loadTopics();
    return () => {
      active = false;
    };
  }, [sourceLanguage, targetLanguage]);

  useEffect(() => {
    let active = true;

    const loadContexts = async (): Promise<void> => {
      if (!selectedTopic.trim() || selectedTopic === CREATE_NEW_OPTION) {
        setPreviousContexts([]);
        return;
      }
      try {
        const response = await fetchContentTopicContexts(selectedTopic.trim(), sourceLanguage, targetLanguage);
        if (!active) {
          return;
        }
        setPreviousContexts(response.contexts || []);
        setSelectedContext("");
        setCustomContext("");
      } catch {
        if (active) {
          setPreviousContexts([]);
          setSelectedContext("");
          setCustomContext("");
        }
      }
    };

    void loadContexts();
    return () => {
      active = false;
    };
  }, [selectedTopic, sourceLanguage, targetLanguage]);

  const shouldCreateNewTopic = selectedTopic === CREATE_NEW_OPTION;
  const shouldCreateNewContext = selectedContext === CREATE_NEW_OPTION;

  const resolvedTopic = (shouldCreateNewTopic ? customTopic : selectedTopic).trim();
  const resolvedContext = (shouldCreateNewContext ? customContext : selectedContext).trim();

  const cleanToken = (value: string): string => value.replace(/^[^A-Za-zÀ-ÖØ-öø-ÿ]+|[^A-Za-zÀ-ÖØ-öø-ÿ]+$/g, "").trim();
  const lineTokens = (line: string): string[] => line.split(/\s+/).filter((part) => part.trim().length > 0);
  const speakerForTurn = (speaker: string | undefined, index: number): "a" | "b" =>
    speaker === "a" || speaker === "b" ? speaker : (index % 2 === 0 ? "a" : "b");

  const onGeneratePreview = async (): Promise<void> => {
    setError("");
    setResult("");
    setDialogAudioUrl("");
    setSavedDialogTurns([]);
    setSavedDialogId(null);
    setSelectedPreviewTurnIndexes([]);
    setPhraseActionStatus({});
    setPhraseActionError({});
    setPhraseSelection(null);
    setPendingPhraseAdd(null);
    setWordActionStatus({});
    setPendingWordAdd(null);
    setPreview(null);

    if (!resolvedTopic) {
      setError(previousTopics.length ? t("content.error.selectOrEnterTopic") : t("content.error.enterTopic"));
      return;
    }
    setLoading(true);
    try {
      const details = conversationDetails.trim();
      const required = requiredWords.trim();
      const data = await previewContent(
        resolvedTopic,
        resolvedContext,
        details,
        required,
        requiredWordsLanguage,
        dialogLength,
        sourceLanguage,
        targetLanguage,
      );
      setPreview(data);
      setSelectedPreviewTurnIndexes([]);
      const topicsResponse = await fetchContentTopics(sourceLanguage, targetLanguage);
      setPreviousTopics(topicsResponse.topics || []);
    } catch {
      setError(t("content.error.generatePreview"));
    } finally {
      setLoading(false);
    }
  };

  const onAcceptDialog = async (): Promise<void> => {
    if (!preview) {
      return;
    }

    setSaving(true);
    setError("");
    try {
      const response = await confirmContent(
        preview.topic,
        preview.dialog_turns,
        preview.context || "",
        preview.source_language || sourceLanguage,
        preview.target_language || targetLanguage,
        true,
        selectedPreviewTurnIndexes,
      );
      setResult(t("content.result.dialogAccepted"));
      setDialogAudioUrl(response.dialog_audio_url || "");
      setSavedDialogTurns(response.saved_dialog_turns || []);
      setSavedDialogId(response.saved_dialog_id || null);
      setPreview(null);
      setSelectedPreviewTurnIndexes([]);
      setPhraseActionStatus({});
      setPhraseActionError({});
      setPhraseSelection(null);
      setPendingPhraseAdd(null);
      const topicsResponse = await fetchContentTopics(sourceLanguage, targetLanguage);
      setPreviousTopics(topicsResponse.topics || []);
    } catch {
      setError(t("content.error.saveContent"));
    } finally {
      setSaving(false);
    }
  };

  const playAudioUrl = (audioUrl?: string): void => {
    if (!audioUrl) {
      return;
    }
    const audio = new Audio(audioUrl);
    void audio.play().catch(() => undefined);
  };

  const requestAddWordFromDialogToken = async (
    key: string,
    targetTokenRaw: string,
    turnIndex: number,
    sourceLine: string,
    targetLine: string,
  ): Promise<void> => {
    const targetToken = cleanToken(targetTokenRaw);
    if (!targetToken || !savedDialogId) {
      return;
    }

    setWordActionStatus((current) => ({ ...current, [key]: "saving" }));
    try {
      const check = await quickAddWordFromDialog(
        targetToken,
        targetToken,
        sourceLanguage,
        targetLanguage,
        savedDialogId,
        turnIndex,
        true,
        sourceLine,
        targetLine,
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
        sourceLine,
        targetLine,
        clickedTargetToken: targetToken,
        turnIndex,
        note: check.notes || "",
      });
    } catch {
      setWordActionStatus((current) => ({ ...current, [key]: "error" }));
    }
  };

  const confirmAddWordFromDialog = async (): Promise<void> => {
    if (!pendingWordAdd || !savedDialogId || addingWord) {
      return;
    }

    const { key, source, target, sourceLine, targetLine, clickedTargetToken, turnIndex } = pendingWordAdd;
    setWordActionStatus((current) => ({ ...current, [key]: "saving" }));
    setAddingWord(true);
    try {
      const resultPayload = await quickAddWordFromDialog(
        source,
        target,
        sourceLanguage,
        targetLanguage,
        savedDialogId,
        turnIndex,
        false,
        sourceLine,
        targetLine,
        clickedTargetToken,
      );
      setWordActionStatus((current) => ({ ...current, [key]: resultPayload.created ? "added" : "exists" }));
    } catch {
      setWordActionStatus((current) => ({ ...current, [key]: "error" }));
    } finally {
      setAddingWord(false);
      setPendingWordAdd(null);
    }
  };

  const phraseSelectionKey = (turnIndex: number): string => `saved-${turnIndex}-phrase`;

  const isSelectingPhraseForTurn = (turnIndex: number): boolean => phraseSelection?.turnIndex === turnIndex;

  const selectedPhraseTargetText = (selection: PhraseSelection): string => {
    const tokens = lineTokens(selection.targetLine);
    return [...selection.tokenIndexes]
      .sort((left, right) => left - right)
      .map((index) => cleanToken(tokens[index] || ""))
      .filter(Boolean)
      .join(" ");
  };

  const selectedPhraseTokenClass = (tokenIndex: number): string => {
    if (!phraseSelection?.tokenIndexes.includes(tokenIndex)) {
      return "";
    }
    const sortedIndexes = [...phraseSelection.tokenIndexes].sort((left, right) => left - right);
    const firstIndex = sortedIndexes[0];
    const lastIndex = sortedIndexes[sortedIndexes.length - 1];
    if (tokenIndex === firstIndex && tokenIndex === lastIndex) {
      return "turn-token-button-selected turn-token-button-selected-single";
    }
    if (tokenIndex === firstIndex) {
      return "turn-token-button-selected turn-token-button-selected-start";
    }
    if (tokenIndex === lastIndex) {
      return "turn-token-button-selected turn-token-button-selected-end";
    }
    return "turn-token-button-selected turn-token-button-selected-middle";
  };

  const startPhraseSelection = (turnIndex: number, sourceLine: string, targetLine: string): void => {
    setPhraseSelection({
      turnIndex,
      sourceLine,
      targetLine,
      tokenIndexes: [],
    });
  };

  const togglePhraseSelectionToken = (
    turnIndex: number,
    sourceLine: string,
    targetLine: string,
    tokenIndex: number,
  ): void => {
    setPhraseSelection((current) => {
      if (!current || current.turnIndex !== turnIndex) {
        return {
          turnIndex,
          sourceLine,
          targetLine,
          tokenIndexes: [tokenIndex],
        };
      }
      const exists = current.tokenIndexes.includes(tokenIndex);
      const sortedIndexes = [...current.tokenIndexes].sort((left, right) => left - right);
      const firstIndex = sortedIndexes[0] ?? tokenIndex;
      const lastIndex = sortedIndexes[sortedIndexes.length - 1] ?? tokenIndex;
      let nextIndexes: number[];
      if (exists) {
        if (tokenIndex === firstIndex) {
          nextIndexes = sortedIndexes.slice(1);
        } else if (tokenIndex === lastIndex) {
          nextIndexes = sortedIndexes.slice(0, -1);
        } else {
          nextIndexes = [tokenIndex];
        }
      } else {
        const rangeStart = Math.min(firstIndex, tokenIndex);
        const rangeEnd = Math.max(lastIndex, tokenIndex);
        nextIndexes = Array.from({ length: rangeEnd - rangeStart + 1 }, (_, offset) => rangeStart + offset);
      }
      return {
        ...current,
        sourceLine,
        targetLine,
        tokenIndexes: nextIndexes,
      };
    });
  };

  const prepareSelectedPhraseFromDialog = async (): Promise<void> => {
    const selection = phraseSelection;
    if (!selection || selection.tokenIndexes.length < 2 || !savedDialogId) {
      return;
    }
    const targetText = selectedPhraseTargetText(selection);
    if (!targetText) {
      return;
    }
    const statusKey = phraseSelectionKey(selection.turnIndex);
    setPhraseActionStatus((current) => ({ ...current, [statusKey]: "saving" }));
    setPhraseActionError((current) => ({ ...current, [statusKey]: "" }));
    try {
      const resultPayload = await quickAddPhraseFromConversation(
        "",
        targetText,
        sourceLanguage,
        targetLanguage,
        true,
        savedDialogId,
        selection.turnIndex,
        selection.sourceLine,
        selection.targetLine,
      );
      setPendingPhraseAdd({
        ...selection,
        sourceText: resultPayload.source_text || "",
        targetText: resultPayload.target_text || targetText,
      });
      setPhraseActionStatus((current) => ({ ...current, [statusKey]: "idle" }));
    } catch (error) {
      setPhraseActionStatus((current) => ({ ...current, [statusKey]: "error" }));
      setPhraseActionError((current) => ({
        ...current,
        [statusKey]: error instanceof Error && error.message ? error.message : t("newItem.sentenceAddError"),
      }));
    }
  };

  const addSelectedPhraseFromDialog = async (): Promise<void> => {
    const pending = pendingPhraseAdd;
    if (!pending || !pending.targetText || !savedDialogId) {
      return;
    }
    const statusKey = phraseSelectionKey(pending.turnIndex);
    setPhraseActionStatus((current) => ({ ...current, [statusKey]: "saving" }));
    setPhraseActionError((current) => ({ ...current, [statusKey]: "" }));
    try {
      const resultPayload = await quickAddPhraseFromConversation(
        pending.sourceText,
        pending.targetText,
        sourceLanguage,
        targetLanguage,
        false,
        savedDialogId,
        pending.turnIndex,
        pending.sourceLine,
        pending.targetLine,
      );
      if (resultPayload.id) {
        setLoadingLinkedWord(true);
        try {
          const detail = await fetchContentItemDetail(resultPayload.id, sourceLanguage, targetLanguage);
          setOpenedLinkedWord({
            id: detail.id,
            item_type: detail.item_type,
            spanish_text: detail.spanish_text,
            german_text: detail.german_text,
            example_sentence: detail.example_sentence || "",
            notes: detail.notes || "",
            word_type: detail.word_type || "",
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
            item_questions: detail.item_questions || [],
          });
        } finally {
          setLoadingLinkedWord(false);
        }
      }
      setPhraseActionStatus((current) => ({ ...current, [statusKey]: resultPayload.created ? "added" : "exists" }));
      setPhraseSelection(null);
      setPendingPhraseAdd(null);
    } catch (error) {
      setPhraseActionStatus((current) => ({ ...current, [statusKey]: "error" }));
      setPhraseActionError((current) => ({
        ...current,
        [statusKey]: error instanceof Error && error.message ? error.message : t("newItem.sentenceAddError"),
      }));
    }
  };

  const renderTargetLineWithWordLinks = (targetText: string, sourceText: string, turnIndex: number): JSX.Element => {
    const tokens = lineTokens(targetText);
    if (!tokens.length) {
      return <>{targetText}</>;
    }

    return (
      <>
        {tokens.map((token, tokenIndex) => {
          const normalized = cleanToken(token);
          if (!normalized) {
            return (
              <span key={`saved-${turnIndex}-punct-${tokenIndex}`} className="turn-token-wrap">
                {token}
                {tokenIndex < tokens.length - 1 ? " " : ""}
              </span>
            );
          }
          const statusKey = `saved-${turnIndex}-target-${tokenIndex}`;
          const status = wordActionStatus[statusKey] || "idle";
          const isSelectingPhrase = isSelectingPhraseForTurn(turnIndex);
          const selectedClass = isSelectingPhrase ? selectedPhraseTokenClass(tokenIndex) : "";
          return (
            <span key={statusKey} className="turn-token-wrap">
              <button
                type="button"
                className={`turn-token-button ${selectedClass}`}
                onClick={() => {
                  if (isSelectingPhrase) {
                    togglePhraseSelectionToken(turnIndex, sourceText, targetText, tokenIndex);
                    return;
                  }
                  void requestAddWordFromDialogToken(statusKey, token, turnIndex, sourceText, targetText);
                }}
                disabled={(!isSelectingPhrase && status === "saving") || !savedDialogId}
              >
                {token}
              </button>
              {tokenIndex < tokens.length - 1 ? " " : ""}
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

  return (
    <main className="container" data-testid="content-create-page">
      <h1>{t("content.title")}</h1>
      <p>{t("content.description")}</p>

      <section className="card content-create-form">
        <div className={`content-form-section content-topic-section${resolvedTopic ? "" : " content-topic-section-required"}`}>
          <label htmlFor="topic-select" className="prompt content-required-label">
            {t("content.topic.label")}
            <span>{t("content.topic.requiredBadge")}</span>
          </label>
          <select
            id="topic-select"
            value={selectedTopic}
            onChange={(e) => setSelectedTopic(e.target.value)}
            disabled={loading || saving}
            aria-invalid={!resolvedTopic}
          >
            <option value="">{previousTopics.length ? t("content.topic.select") : t("content.topic.none")}</option>
            {previousTopics.map((savedTopic) => (
              <option key={savedTopic} value={savedTopic}>
                {savedTopic}
              </option>
            ))}
            <option value={CREATE_NEW_OPTION}>{t("content.topic.createNew")}</option>
          </select>
          {shouldCreateNewTopic && (
            <>
              <label htmlFor="topic-input" className="prompt">{t("content.topic.newLabel")}</label>
              <input
                id="topic-input"
                value={customTopic}
                onChange={(e) => setCustomTopic(e.target.value)}
                placeholder={t("content.topic.placeholder")}
                disabled={loading || saving}
                aria-invalid={!resolvedTopic}
              />
            </>
          )}
          {!resolvedTopic && <p className="content-required-hint">{t("content.topic.requiredHint")}</p>}
        </div>
        <div className="content-form-section">
          <label htmlFor="topic-context-select" className="prompt">{t("content.context.label")}</label>
          <select
            id="topic-context-select"
            value={selectedContext}
            onChange={(e) => setSelectedContext(e.target.value)}
            disabled={loading || saving}
          >
            <option value="">{t("content.context.none")}</option>
            {previousContexts.map((savedContext) => (
              <option key={savedContext} value={savedContext}>
                {savedContext}
              </option>
            ))}
            <option value={CREATE_NEW_OPTION}>{t("content.context.createNew")}</option>
          </select>
          {shouldCreateNewContext && (
            <input
              id="topic-context-input"
              value={customContext}
              onChange={(e) => setCustomContext(e.target.value)}
              placeholder={t("content.context.placeholder")}
              disabled={loading || saving}
            />
          )}
        </div>
        <div className="content-form-section">
          <p className="prompt" id="dialog-length-label">{t("content.length.label")}</p>
          <div className="content-radio-options" role="radiogroup" aria-labelledby="dialog-length-label">
            {(["standard", "short_three"] as DialogLength[]).map((length) => (
              <label
                key={length}
                className={`content-radio-option${dialogLength === length ? " content-radio-option-selected" : ""}`}
              >
                <input
                  type="radio"
                  name="dialog-length"
                  value={length}
                  checked={dialogLength === length}
                  onChange={() => setDialogLength(length)}
                  disabled={loading || saving}
                />
                {length === "standard" ? t("content.length.standard") : t("content.length.shortThree")}
              </label>
            ))}
          </div>
        </div>
        <div className="content-form-section">
          <label htmlFor="required-words-input" className="prompt">{t("content.requiredWords.label")}</label>
          <div className="content-radio-options" role="radiogroup" aria-label={t("content.requiredWords.label")}>
            {(["target", "source"] as RequiredWordsLanguage[]).map((language) => (
              <label
                key={language}
                className={`content-radio-option${requiredWordsLanguage === language ? " content-radio-option-selected" : ""}`}
              >
                <input
                  type="radio"
                  name="required-words-language"
                  value={language}
                  checked={requiredWordsLanguage === language}
                  onChange={() => setRequiredWordsLanguage(language)}
                  disabled={loading || saving}
                />
                {language === "target" ? t("content.requiredWords.languageTarget") : t("content.requiredWords.languageSource")}
              </label>
            ))}
          </div>
          <input
            id="required-words-input"
            value={requiredWords}
            onChange={(e) => setRequiredWords(e.target.value)}
            placeholder={t("content.requiredWords.placeholder")}
            disabled={loading || saving}
          />
          <p className="hint">{t("content.requiredWords.hint")}</p>
        </div>
        <div className="content-form-section">
          <label htmlFor="conversation-details-input" className="prompt">{t("content.details.label")}</label>
          <textarea
            id="conversation-details-input"
            value={conversationDetails}
            onChange={(e) => setConversationDetails(e.target.value)}
            placeholder={t("content.details.placeholder")}
            disabled={loading || saving}
            rows={4}
          />
          <p className="hint">{t("content.details.hint")}</p>
        </div>
        <div className="actions">
          <button onClick={() => void onGeneratePreview()} disabled={loading || saving || !resolvedTopic}>
            {loading ? t("content.generating") : t("content.generate")}
          </button>
        </div>
      </section>

      {error && <p className="error">{error}</p>}
      {result && <p>{result}</p>}

      {preview && (
        <section className="card">
          <h2>{t("content.preview.title")}</h2>
          <div className="actions">
            <button
              type="button"
              className="secondary-button"
              onClick={() => setSelectedPreviewTurnIndexes(preview.dialog_turns.map((_, index) => index))}
              disabled={saving || loading}
            >
              {t("content.preview.selectAllPhrases")}
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => setSelectedPreviewTurnIndexes([])}
              disabled={saving || loading}
            >
              {t("content.preview.unselectAllPhrases")}
            </button>
          </div>
          <ul className="conversation-preview-list">
            {preview.dialog_turns.map((turn, index) => {
              const speaker = speakerForTurn(turn.speaker, index);
              const selected = selectedPreviewTurnIndexes.includes(index);
              return (
                <li
                  key={`${turn.source_text.toLowerCase()}|||${turn.target_text.toLowerCase()}|||${index}`}
                  className={`conversation-turn ${speaker === "a" ? "speaker-a" : "speaker-b"}`}
                >
                  <label className="word-preview-label">
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={(event) => {
                        const shouldSelect = event.target.checked;
                        setSelectedPreviewTurnIndexes((current) => {
                          if (shouldSelect) {
                            return current.includes(index) ? current : [...current, index].sort((a, b) => a - b);
                          }
                          return current.filter((value) => value !== index);
                        });
                      }}
                      disabled={saving || loading}
                    />
                    <span>{t("content.preview.savePhrase")}</span>
                  </label>
                  <p className="conversation-speaker">{speaker === "a" ? t("content.preview.personA") : t("content.preview.personB")}</p>
                  <p className="conversation-line conversation-line-translation">{turn.target_text}</p>
                  <p className="conversation-line">{turn.source_text}</p>
                </li>
              );
            })}
          </ul>
          <div className="actions">
            <button onClick={() => void onAcceptDialog()} disabled={saving || loading}>
              {saving ? t("content.saving") : t("content.preview.acceptDialog")}
            </button>
            <button
              onClick={() => {
                setPreview(null);
                setSelectedPreviewTurnIndexes([]);
              }}
              disabled={saving || loading}
            >
              {t("content.preview.discardDialog")}
            </button>
          </div>
        </section>
      )}

      {(savedDialogTurns.length > 0 || dialogAudioUrl) && (
        <section className="card">
          <p><strong>{t("content.result.dialogTitle")}</strong></p>
          <p className="hint">{t("content.result.dialogWordHint")}</p>
          {dialogAudioUrl && (
            <>
              <p><strong>{t("content.result.dialogAudio")}</strong></p>
              <audio controls src={dialogAudioUrl} preload="none" />
            </>
          )}
          {savedDialogTurns.length > 0 && (
            <ul className="conversation-preview-list">
              {savedDialogTurns.map((turn, index) => {
                const speaker = speakerForTurn(turn.speaker, index);
                return (
                  <li
                    key={`${turn.source_text.toLowerCase()}|||${turn.target_text.toLowerCase()}|||${index}`}
                    className={`conversation-turn ${speaker === "a" ? "speaker-a" : "speaker-b"}`}
                  >
                    <p className="conversation-speaker">{speaker === "a" ? t("content.preview.personA") : t("content.preview.personB")}</p>
                    <p className="conversation-line conversation-line-translation">
                      {renderTargetLineWithWordLinks(turn.target_text, turn.source_text, index)}
                    </p>
                    {turn.phrase_audio_url && (
                      <button
                        type="button"
                        className="turn-audio-button"
                        onClick={() => playAudioUrl(turn.phrase_audio_url)}
                      >
                        {t("newItem.playTurnAudio")}
                      </button>
                    )}
                    <p className="conversation-line">{turn.source_text}</p>
                    <div className="actions turn-action-row">
                      {isSelectingPhraseForTurn(index) ? (
                        <>
                          <button
                            type="button"
                            className="secondary-button"
                            onClick={() => setPhraseSelection(null)}
                            disabled={phraseActionStatus[phraseSelectionKey(index)] === "saving"}
                          >
                            {t("dialogs.cancelPhraseSelection")}
                          </button>
                          <button
                            type="button"
                            onClick={() => void prepareSelectedPhraseFromDialog()}
                            disabled={
                              (phraseSelection?.tokenIndexes.length || 0) < 2
                              || phraseActionStatus[phraseSelectionKey(index)] === "saving"
                            }
                          >
                            {phraseActionStatus[phraseSelectionKey(index)] === "saving"
                              ? t("newItem.sentenceAddSaving")
                              : t("dialogs.addSelectedPhrase")}
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => startPhraseSelection(index, turn.source_text, turn.target_text)}
                          disabled={!savedDialogId || phraseActionStatus[phraseSelectionKey(index)] === "saving"}
                        >
                          {t("dialogs.selectPhraseWords")}
                        </button>
                      )}
                      {phraseActionStatus[phraseSelectionKey(index)] === "added" && (
                        <span className="turn-token-status">{t("newItem.sentenceAddAdded")}</span>
                      )}
                      {phraseActionStatus[phraseSelectionKey(index)] === "exists" && (
                        <span className="turn-token-status">{t("newItem.sentenceAddExists")}</span>
                      )}
                      {phraseActionStatus[phraseSelectionKey(index)] === "error" && (
                        <span className="turn-token-status">
                          {phraseActionError[phraseSelectionKey(index)] || t("newItem.sentenceAddError")}
                        </span>
                      )}
                    </div>
                    {isSelectingPhraseForTurn(index) && (
                      <p className="hint">{t("dialogs.selectedPhraseHint")}</p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {pendingWordAdd && (
        <div className="blocking-modal-overlay" role="dialog" aria-modal="true">
          <div className="blocking-modal add-word-modal">
            <p className="add-word-modal-title">
              <strong>{t("newItem.wordAddTitle")}</strong>
            </p>
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
              <button type="button" className="secondary-button" onClick={() => setPendingWordAdd(null)} disabled={addingWord}>
                {t("newItem.wordAddCancel")}
              </button>
              <button type="button" onClick={() => void confirmAddWordFromDialog()} disabled={addingWord}>
                {addingWord ? t("newItem.wordAddSaving") : t("newItem.wordAddConfirmButton")}
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingPhraseAdd && (
        <div className="blocking-modal-overlay" role="dialog" aria-modal="true">
          <div className="blocking-modal add-word-modal">
            <p className="add-word-modal-title">
              <strong>{t("newItem.sentenceAddTitle")}</strong>
            </p>
            <p className="add-word-modal-word">{pendingPhraseAdd.targetText}</p>
            <p className="add-word-modal-meaning">
              {t("newItem.sentenceAddTranslation", { translation: pendingPhraseAdd.sourceText })}
            </p>
            <p className="hint">{t("dialogs.phraseSelectionConfirmPrompt")}</p>
            <div className="actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setPendingPhraseAdd(null)}
                disabled={phraseActionStatus[phraseSelectionKey(pendingPhraseAdd.turnIndex)] === "saving"}
              >
                {t("newItem.sentenceAddCancel")}
              </button>
              <button
                type="button"
                onClick={() => void addSelectedPhraseFromDialog()}
                disabled={phraseActionStatus[phraseSelectionKey(pendingPhraseAdd.turnIndex)] === "saving"}
              >
                {phraseActionStatus[phraseSelectionKey(pendingPhraseAdd.turnIndex)] === "saving"
                  ? t("newItem.sentenceAddSaving")
                  : t("newItem.sentenceAddConfirmButton")}
              </button>
            </div>
          </div>
        </div>
      )}

      {saving && (
        <div className="blocking-modal-overlay" role="alert" aria-live="assertive" aria-busy="true">
          <div className="blocking-modal">
            <p>{t("content.saving")}</p>
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
