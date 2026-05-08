import { useEffect, useState } from "react";

import { confirmContent, fetchContentTopicContexts, fetchContentTopics, previewContent, quickAddWordFromDialog } from "../api";
import { useI18n } from "../i18n";
import { useStudyLanguages } from "../studyLanguages";
import type { ContentPreviewResponse } from "../types";

const CREATE_NEW_OPTION = "__create_new__";

export default function ContentCreatePage(): JSX.Element {
  const { t } = useI18n();
  const { sourceLanguage, targetLanguage } = useStudyLanguages();
  const [selectedTopic, setSelectedTopic] = useState<string>("");
  const [customTopic, setCustomTopic] = useState<string>("");
  const [selectedContext, setSelectedContext] = useState<string>("");
  const [customContext, setCustomContext] = useState<string>("");
  const [conversationDetails, setConversationDetails] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [preview, setPreview] = useState<ContentPreviewResponse | null>(null);
  const [result, setResult] = useState<string>("");
  const [dialogAudioUrl, setDialogAudioUrl] = useState<string>("");
  const [savedDialogId, setSavedDialogId] = useState<number | null>(null);
  const [savedDialogTurns, setSavedDialogTurns] = useState<Array<{ source_text: string; target_text: string; speaker?: "a" | "b" }>>([]);
  const [selectedPreviewTurnIndexes, setSelectedPreviewTurnIndexes] = useState<number[]>([]);
  const [previousTopics, setPreviousTopics] = useState<string[]>([]);
  const [previousContexts, setPreviousContexts] = useState<string[]>([]);
  const [wordActionStatus, setWordActionStatus] = useState<Record<string, "idle" | "saving" | "added" | "exists" | "error">>({});
  const [pendingWordAdd, setPendingWordAdd] = useState<{
    key: string;
    source: string;
    target: string;
    sourceLine: string;
    targetLine: string;
    clickedTargetToken: string;
    turnIndex: number;
  } | null>(null);
  const [addingWord, setAddingWord] = useState<boolean>(false);

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
        setPreview(null);
        setResult("");
        setDialogAudioUrl("");
        setSavedDialogTurns([]);
        setSavedDialogId(null);
        setSelectedPreviewTurnIndexes([]);
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
          setPreview(null);
          setResult("");
          setDialogAudioUrl("");
          setSavedDialogTurns([]);
          setSavedDialogId(null);
          setSelectedPreviewTurnIndexes([]);
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
      const data = await previewContent(resolvedTopic, resolvedContext, details, sourceLanguage, targetLanguage);
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
      const topicsResponse = await fetchContentTopics(sourceLanguage, targetLanguage);
      setPreviousTopics(topicsResponse.topics || []);
    } catch {
      setError(t("content.error.saveContent"));
    } finally {
      setSaving(false);
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
        setWordActionStatus((current) => ({ ...current, [key]: "exists" }));
        return;
      }
      setWordActionStatus((current) => ({ ...current, [key]: "idle" }));
      setPendingWordAdd({
        key,
        source: check.source_text || targetToken,
        target: check.target_text || targetToken,
        sourceLine,
        targetLine,
        clickedTargetToken: targetToken,
        turnIndex,
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
          return (
            <span key={statusKey} className="turn-token-wrap">
              <button
                type="button"
                className="turn-token-button"
                onClick={() => void requestAddWordFromDialogToken(statusKey, token, turnIndex, sourceText, targetText)}
                disabled={status === "saving" || !savedDialogId}
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

      <section className="card">
        <div className="content-form-section">
          <label htmlFor="topic-select" className="prompt">{t("content.topic.label")}</label>
          <select
            id="topic-select"
            value={selectedTopic}
            onChange={(e) => setSelectedTopic(e.target.value)}
            disabled={loading || saving}
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
              />
            </>
          )}
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
          <label htmlFor="conversation-details-input" className="prompt">{t("content.details.label")}</label>
          <input
            id="conversation-details-input"
            value={conversationDetails}
            onChange={(e) => setConversationDetails(e.target.value)}
            placeholder={t("content.details.placeholder")}
            disabled={loading || saving}
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
                    <p className="conversation-line">{turn.source_text}</p>
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
    </main>
  );
}
