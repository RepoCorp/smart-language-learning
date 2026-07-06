import { useEffect, useState } from "react";

import { confirmContent, fetchContentItemDetail, fetchContentTopicContexts, fetchContentTopics, previewContent, quickAddPhraseFromConversation, quickAddWordFromDialog } from "../api";
import { useI18n } from "../i18n";
import { useStudyLanguages } from "../studyLanguages";
import type { ContentPreviewResponse, SessionItem } from "../types";
import DialogActionIcon from "./DialogActionIcon";
import DialogTurnsList from "./DialogTurnsList";
import NewItem from "./NewItem";
import TargetPhraseText from "./TargetPhraseText";

const CREATE_NEW_OPTION = "__create_new__";
type DialogLength = "standard" | "short_three";
type RequiredWordsLanguage = "source" | "target";
type PhraseActionStatus = "idle" | "saving" | "added" | "exists" | "error";

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
  const [savedDialogId, setSavedDialogId] = useState<number | null>(null);
  const [savedDialogTurns, setSavedDialogTurns] = useState<Array<{ source_text: string; target_text: string; speaker?: "a" | "b"; phrase_audio_url?: string }>>([]);
  const [playingSavedDialog, setPlayingSavedDialog] = useState<boolean>(false);
  const [phraseActionStatus, setPhraseActionStatus] = useState<Record<string, PhraseActionStatus>>({});
  const [phraseActionError, setPhraseActionError] = useState<Record<string, string>>({});
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
        setSavedDialogTurns([]);
        setSavedDialogId(null);
        setPlayingSavedDialog(false);
        setPhraseActionStatus({});
        setPhraseActionError({});
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
          setSavedDialogTurns([]);
          setSavedDialogId(null);
          setPlayingSavedDialog(false);
          setPhraseActionStatus({});
          setPhraseActionError({});
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
    setSavedDialogTurns([]);
    setSavedDialogId(null);
    setPlayingSavedDialog(false);
    setPhraseActionStatus({});
    setPhraseActionError({});
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
        [],
      );
      setResult(t("content.result.dialogAccepted"));
      setSavedDialogTurns(response.saved_dialog_turns || []);
      setSavedDialogId(response.saved_dialog_id || null);
      setPreview(null);
      setPhraseActionStatus({});
      setPhraseActionError({});
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

  const playAudioUrlAndWait = (audioUrl?: string): Promise<void> =>
    new Promise((resolve) => {
      if (!audioUrl) {
        resolve();
        return;
      }
      const audio = new Audio(audioUrl);
      audio.onended = () => resolve();
      audio.onerror = () => resolve();
      void audio.play().catch(() => resolve());
    });

  const playSavedDialogTurns = async (): Promise<void> => {
    const audioUrls = savedDialogTurns.map((turn) => turn.phrase_audio_url || "").filter(Boolean);
    if (!audioUrls.length || playingSavedDialog) {
      return;
    }
    setPlayingSavedDialog(true);
    try {
      for (const audioUrl of audioUrls) {
        await playAudioUrlAndWait(audioUrl);
      }
    } finally {
      setPlayingSavedDialog(false);
    }
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

  const wholeTurnPhraseKey = (turnIndex: number): string => `saved-${turnIndex}-whole-phrase`;

  const openPhraseItem = async (itemId: number): Promise<void> => {
    setLoadingLinkedWord(true);
    try {
      const detail = await fetchContentItemDetail(itemId, sourceLanguage, targetLanguage);
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
        compare_words: detail.compare_words || [],
        item_questions: detail.item_questions || [],
      });
    } finally {
      setLoadingLinkedWord(false);
    }
  };

  const addWholeTurnPhraseFromDialog = async (
    turn: { source_text: string; target_text: string; speaker?: "a" | "b"; phrase_audio_url?: string },
    turnIndex: number,
  ): Promise<void> => {
    if (!savedDialogId || !turn.source_text.trim() || !turn.target_text.trim()) {
      return;
    }
    const statusKey = wholeTurnPhraseKey(turnIndex);
    setPhraseActionStatus((current) => ({ ...current, [statusKey]: "saving" }));
    setPhraseActionError((current) => ({ ...current, [statusKey]: "" }));
    try {
      const resultPayload = await quickAddPhraseFromConversation(
        turn.source_text,
        turn.target_text,
        sourceLanguage,
        targetLanguage,
        false,
        savedDialogId,
        turnIndex,
        turn.source_text,
        turn.target_text,
      );
      if (resultPayload.id) {
        await openPhraseItem(resultPayload.id);
      }
      setPhraseActionStatus((current) => ({ ...current, [statusKey]: resultPayload.created ? "added" : "exists" }));
    } catch (error) {
      setPhraseActionStatus((current) => ({ ...current, [statusKey]: "error" }));
      setPhraseActionError((current) => ({
        ...current,
        [statusKey]: error instanceof Error && error.message ? error.message : t("newItem.sentenceAddError"),
      }));
    }
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
          <ul className="conversation-preview-list">
            {preview.dialog_turns.map((turn, index) => {
              const speaker = speakerForTurn(turn.speaker, index);
              return (
                <li
                  key={`${turn.source_text.toLowerCase()}|||${turn.target_text.toLowerCase()}|||${index}`}
                  className={`conversation-turn ${speaker === "a" ? "speaker-a" : "speaker-b"}`}
                >
                  <p className="conversation-speaker">{speaker === "a" ? t("content.preview.personA") : t("content.preview.personB")}</p>
                  <TargetPhraseText as="p" className="conversation-line" variant="dialog" text={turn.target_text} />
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
              }}
              disabled={saving || loading}
            >
              {t("content.preview.discardDialog")}
            </button>
          </div>
        </section>
      )}

      {savedDialogTurns.length > 0 && (
        <section className="card">
          <p><strong>{t("content.result.dialogTitle")}</strong></p>
          <p className="hint">{t("content.result.dialogWordHint")}</p>
          {!!savedDialogTurns.some((turn) => turn.phrase_audio_url) && (
            <div className="actions">
              <button type="button" className="secondary-button" onClick={() => void playSavedDialogTurns()} disabled={playingSavedDialog}>
                {playingSavedDialog ? t("dialogs.nowPlaying") : t("dialogs.playDialog")}
              </button>
            </div>
          )}
          {savedDialogTurns.length > 0 && (
            <DialogTurnsList
              dialogId={savedDialogId || -1}
              turns={savedDialogTurns}
              sourceLanguage={sourceLanguage}
              targetLanguage={targetLanguage}
              tokenStatus={wordActionStatus}
              statusKeyPrefixBase="saved"
              onOpenItem={openPhraseItem}
              onTokenClick={(statusKey, token, turnIndex, sourceText, targetText) => void requestAddWordFromDialogToken(
                statusKey,
                token,
                turnIndex,
                sourceText,
                targetText,
              )}
              renderLeadingAction={(turn) => turn.phrase_audio_url ? (
                <button
                  type="button"
                  className="secondary-button exercise-action-icon-button dialog-inline-action-button"
                  onClick={() => playAudioUrl(turn.phrase_audio_url)}
                  aria-label={t("newItem.playTurnAudio")}
                  title={t("newItem.playTurnAudio")}
                >
                  <DialogActionIcon name="play" />
                </button>
              ) : null}
              renderTurnActions={(turn, index) => {
                const phraseKey = wholeTurnPhraseKey(index);
                return (
                  <>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => void addWholeTurnPhraseFromDialog(turn, index)}
                      disabled={!savedDialogId || phraseActionStatus[phraseKey] === "saving"}
                    >
                      {phraseActionStatus[phraseKey] === "saving"
                        ? t("newItem.sentenceAddSaving")
                        : t("content.preview.savePhrase")}
                    </button>
                    {phraseActionStatus[phraseKey] === "added" && (
                      <span className="turn-token-status">{t("newItem.sentenceAddAdded")}</span>
                    )}
                    {phraseActionStatus[phraseKey] === "exists" && (
                      <span className="turn-token-status">{t("newItem.sentenceAddExists")}</span>
                    )}
                    {phraseActionStatus[phraseKey] === "error" && (
                      <span className="turn-token-status">
                        {phraseActionError[phraseKey] || t("newItem.sentenceAddError")}
                      </span>
                    )}
                  </>
                );
              }}
            />
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
