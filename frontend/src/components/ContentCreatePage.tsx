import { useEffect, useState } from "react";

import { confirmContent, fetchContentTopicContexts, fetchContentTopics, previewContent } from "../api";
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
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [preview, setPreview] = useState<ContentPreviewResponse | null>(null);
  const [selectedPhrases, setSelectedPhrases] = useState<Record<string, boolean>>({});
  const [selectedWords, setSelectedWords] = useState<Record<string, boolean>>({});
  const [createDialogAudio, setCreateDialogAudio] = useState<boolean>(false);
  const [result, setResult] = useState<string>("");
  const [dialogAudioUrl, setDialogAudioUrl] = useState<string>("");
  const [savedDialogTurns, setSavedDialogTurns] = useState<Array<{ source_text: string; target_text: string }>>([]);
  const [previousTopics, setPreviousTopics] = useState<string[]>([]);
  const [previousContexts, setPreviousContexts] = useState<string[]>([]);

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
        setPreview(null);
        setSelectedPhrases({});
        setSelectedWords({});
        setCreateDialogAudio(false);
        setResult("");
        setDialogAudioUrl("");
        setSavedDialogTurns([]);
        setError("");
      } catch {
        if (active) {
          setPreviousTopics([]);
          setSelectedTopic("");
          setCustomTopic("");
          setPreviousContexts([]);
          setSelectedContext("");
          setCustomContext("");
          setPreview(null);
          setSelectedPhrases({});
          setSelectedWords({});
          setCreateDialogAudio(false);
          setResult("");
          setDialogAudioUrl("");
          setSavedDialogTurns([]);
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

  const onGeneratePreview = async (): Promise<void> => {
    setError("");
    setResult("");
    setDialogAudioUrl("");
    setSavedDialogTurns([]);
    setPreview(null);
    setSelectedPhrases({});
    setSelectedWords({});
    setCreateDialogAudio(false);

    const topicFromInput = shouldCreateNewTopic ? customTopic.trim() : selectedTopic.trim();
    if (!topicFromInput) {
      setError(previousTopics.length ? t("content.error.selectOrEnterTopic") : t("content.error.enterTopic"));
      return;
    }

    const contextFromInput = shouldCreateNewContext ? customContext.trim() : selectedContext.trim();

    setLoading(true);
    try {
      const data = await previewContent(topicFromInput, contextFromInput, sourceLanguage, targetLanguage);
      setPreview(data);
      const topicsResponse = await fetchContentTopics(sourceLanguage, targetLanguage);
      setPreviousTopics(topicsResponse.topics || []);
      const initialPhraseSelection: Record<string, boolean> = {};
      for (const phrase of data.phrases) {
        const key = phrase.selection_key || `${phrase.spanish_text.toLowerCase()}|||${phrase.german_text.toLowerCase()}`;
        initialPhraseSelection[key] = !phrase.exists;
      }
      setSelectedPhrases(initialPhraseSelection);
      const initialWordSelection: Record<string, boolean> = {};
      for (const word of data.words) {
        const key = word.selection_key || `${word.spanish_text.toLowerCase()}|||${word.german_text.toLowerCase()}`;
        initialWordSelection[key] = !word.exists;
      }
      setSelectedWords(initialWordSelection);
    } catch {
      setError(t("content.error.generatePreview"));
    } finally {
      setLoading(false);
    }
  };

  const onConfirmSave = async (): Promise<void> => {
    if (!preview) {
      return;
    }

    setSaving(true);
    setError("");
    try {
      const phrasesToSave = preview.phrases
        .filter((phrase) => {
          const key = phrase.selection_key || `${phrase.spanish_text.toLowerCase()}|||${phrase.german_text.toLowerCase()}`;
          return !phrase.exists && selectedPhrases[key];
        })
        .map((phrase) => phrase.selection_key || `${phrase.spanish_text.toLowerCase()}|||${phrase.german_text.toLowerCase()}`);
      const wordsToSave = preview.words
        .filter((word) => {
          const key = word.selection_key || `${word.spanish_text.toLowerCase()}|||${word.german_text.toLowerCase()}`;
          return !word.exists && selectedWords[key];
        })
        .map((word) => word.selection_key || `${word.spanish_text.toLowerCase()}|||${word.german_text.toLowerCase()}`);
      const response = await confirmContent(
        preview.topic,
        phrasesToSave,
        wordsToSave,
        preview.context || "",
        preview.source_language || sourceLanguage,
        preview.target_language || targetLanguage,
        createDialogAudio,
        preview.phrases.map((phrase) => ({
          spanish_text: phrase.spanish_text,
          german_text: phrase.german_text,
          notes: phrase.notes || "",
        })),
        preview.words.map((word) => ({
          spanish_text: word.spanish_text,
          german_text: word.german_text,
          notes: word.notes || "",
        })),
      );
      const phraseMessage = response.created_phrases_count
        ? t("content.result.phrasesCreated", { count: response.created_phrases_count })
        : t("content.result.phrasesExisted");
      if (!wordsToSave.length) {
        setResult(t("content.result.savedNoWords", { phraseMessage }));
      } else {
        setResult(t("content.result.savedWithWords", { count: response.created_words_count, phraseMessage }));
      }
      setDialogAudioUrl(response.dialog_audio_url || "");
      setSavedDialogTurns(response.saved_dialog_turns || []);
      setSelectedTopic("");
      setCustomTopic("");
      setSelectedContext("");
      setCustomContext("");
      setPreviousContexts([]);
      setPreview(null);
      setSelectedPhrases({});
      setSelectedWords({});
      setCreateDialogAudio(false);
      const topicsResponse = await fetchContentTopics(sourceLanguage, targetLanguage);
      setPreviousTopics(topicsResponse.topics || []);
    } catch {
      setError(t("content.error.saveContent"));
    } finally {
      setSaving(false);
    }
  };

  const toggleWordSelection = (wordKey: string): void => {
    setSelectedWords((current) => ({
      ...current,
      [wordKey]: !current[wordKey],
    }));
  };

  const togglePhraseSelection = (phraseKey: string): void => {
    setSelectedPhrases((current) => ({
      ...current,
      [phraseKey]: !current[phraseKey],
    }));
  };

  const unselectAllPhrases = (): void => {
    setSelectedPhrases((current) => {
      const next: Record<string, boolean> = {};
      for (const key of Object.keys(current)) {
        next[key] = false;
      }
      return next;
    });
  };

  const selectAllPhrases = (): void => {
    setSelectedPhrases((current) => {
      const next: Record<string, boolean> = {};
      for (const key of Object.keys(current)) {
        next[key] = true;
      }
      return next;
    });
  };

  const unselectAllWords = (): void => {
    setSelectedWords((current) => {
      const next: Record<string, boolean> = {};
      for (const key of Object.keys(current)) {
        next[key] = false;
      }
      return next;
    });
  };

  const selectAllWords = (): void => {
    setSelectedWords((current) => {
      const next: Record<string, boolean> = {};
      for (const key of Object.keys(current)) {
        next[key] = true;
      }
      return next;
    });
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
        <div className="actions">
          <button onClick={() => void onGeneratePreview()} disabled={loading || saving}>
            {loading ? t("content.generating") : t("content.generate")}
          </button>
        </div>
      </section>

      {error && <p className="error">{error}</p>}
      {result && <p>{result}</p>}
      {(savedDialogTurns.length > 0 || dialogAudioUrl) && (
        <section className="card">
          <p><strong>{t("content.result.dialogTitle")}</strong></p>
          {savedDialogTurns.length > 0 && (
            <ul className="conversation-preview-list">
              {savedDialogTurns.map((turn, index) => (
                <li
                  key={`${turn.source_text.toLowerCase()}|||${turn.target_text.toLowerCase()}|||${index}`}
                  className={`conversation-turn ${index % 2 === 0 ? "speaker-a" : "speaker-b"}`}
                >
                  <p className="conversation-speaker">{index % 2 === 0 ? t("content.preview.personA") : t("content.preview.personB")}</p>
                  <p className="conversation-line conversation-line-translation">{turn.target_text}</p>
                  <p className="conversation-line">{turn.source_text}</p>
                </li>
              ))}
            </ul>
          )}
          {dialogAudioUrl && (
            <>
              <p><strong>{t("content.result.dialogAudio")}</strong></p>
              <audio controls src={dialogAudioUrl} preload="none" />
              <p>
                <a href={dialogAudioUrl} target="_blank" rel="noreferrer">
                  {dialogAudioUrl}
                </a>
              </p>
            </>
          )}
        </section>
      )}

      {preview && (
        <section className="card">
          <h2>{t("content.preview.title")}</h2>
          <p><strong>{t("content.preview.phrases")}</strong></p>
          <div className="actions">
            <button onClick={selectAllPhrases} disabled={saving}>
              {t("content.preview.selectAllPhrases")}
            </button>
            <button onClick={unselectAllPhrases} disabled={saving}>
              {t("content.preview.unselectAllPhrases")}
            </button>
          </div>
          <ul className="conversation-preview-list">
            {preview.phrases.map((phrase, index) => {
              const phraseKey = phrase.selection_key || `${phrase.spanish_text.toLowerCase()}|||${phrase.german_text.toLowerCase()}`;
              return (
                <li
                  key={`${phrase.spanish_text.toLowerCase()}|||${phrase.german_text.toLowerCase()}|||${index}`}
                  className={`conversation-turn ${index % 2 === 0 ? "speaker-a" : "speaker-b"}`}
                >
                  <p className="conversation-speaker">{index % 2 === 0 ? t("content.preview.personA") : t("content.preview.personB")}</p>
                  <p className="conversation-line conversation-line-translation">{phrase.german_text}</p>
                  <p className="conversation-line">{phrase.spanish_text}</p>
                  {phrase.exists ? (
                    <p className="conversation-status">{t("content.preview.exists")}</p>
                  ) : (
                    <label className="conversation-status">
                      <input
                        type="checkbox"
                        checked={Boolean(selectedPhrases[phraseKey])}
                        onChange={() => togglePhraseSelection(phraseKey)}
                        disabled={saving}
                      />{" "}
                      {t("content.preview.new")}
                    </label>
                  )}
                </li>
              );
            })}
          </ul>

          {(() => {
            const selectedNewWordsCount = preview.words.filter(
              (word) => {
                const key = word.selection_key || `${word.spanish_text.toLowerCase()}|||${word.german_text.toLowerCase()}`;
                return !word.exists && selectedWords[key];
              },
            ).length;
            const selectedNewPhrasesCount = preview.phrases.filter((phrase) => {
              const key = phrase.selection_key || `${phrase.spanish_text.toLowerCase()}|||${phrase.german_text.toLowerCase()}`;
              return !phrase.exists && selectedPhrases[key];
            }).length;
            const newItemsToSave = selectedNewPhrasesCount + selectedNewWordsCount;
            return (
              <p><strong>{t("content.preview.newItems")}</strong> {newItemsToSave}</p>
            );
          })()}

          <p><strong>{t("content.preview.words")}</strong></p>
          <div className="actions">
            <button onClick={selectAllWords} disabled={saving}>
              {t("content.preview.selectAllWords")}
            </button>
            <button onClick={unselectAllWords} disabled={saving}>
              {t("content.preview.unselectAllWords")}
            </button>
          </div>
          <ul className="word-preview-list">
            {preview.words.map((word) => (
              <li
                key={word.selection_key || `${word.spanish_text.toLowerCase()}|||${word.german_text.toLowerCase()}`}
                className="word-preview-item"
              >
                {word.exists ? (
                  <>
                    {word.spanish_text} - {word.german_text} ({t("content.preview.exists")})
                  </>
                ) : (
                  <label className="word-preview-label">
                    <input
                      type="checkbox"
                      checked={Boolean(
                        selectedWords[word.selection_key || `${word.spanish_text.toLowerCase()}|||${word.german_text.toLowerCase()}`],
                      )}
                      onChange={() =>
                        toggleWordSelection(word.selection_key || `${word.spanish_text.toLowerCase()}|||${word.german_text.toLowerCase()}`)
                      }
                      disabled={saving}
                    />
                    {word.spanish_text} - {word.german_text} ({t("content.preview.new")})
                  </label>
                )}
              </li>
            ))}
          </ul>
          <div className="actions">
            <label className="content-audio-option">
              <input
                type="checkbox"
                checked={createDialogAudio}
                onChange={(e) => setCreateDialogAudio(e.target.checked)}
                disabled={saving}
              />
              {t("content.createDialogAudio")}
            </label>
          </div>
          <div className="actions">
            <button onClick={() => void onConfirmSave()} disabled={saving}>
              {saving ? t("content.saving") : t("content.save")}
            </button>
            <button onClick={() => setPreview(null)} disabled={saving}>
              {t("content.cancel")}
            </button>
          </div>
        </section>
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
