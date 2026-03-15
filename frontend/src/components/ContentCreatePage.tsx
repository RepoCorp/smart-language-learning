import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { confirmContent, fetchContentTopicContexts, fetchContentTopics, previewContent } from "../api";
import { useI18n } from "../i18n";
import type { ContentPreviewResponse } from "../types";

const CREATE_NEW_OPTION = "__create_new__";

export default function ContentCreatePage(): JSX.Element {
  const { t } = useI18n();
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
  const [result, setResult] = useState<string>("");
  const [previousTopics, setPreviousTopics] = useState<string[]>([]);
  const [previousContexts, setPreviousContexts] = useState<string[]>([]);

  useEffect(() => {
    let active = true;

    const loadTopics = async (): Promise<void> => {
      try {
        const response = await fetchContentTopics();
        if (!active) {
          return;
        }
        setPreviousTopics(response.topics || []);
      } catch {
        if (active) {
          setPreviousTopics([]);
        }
      }
    };

    void loadTopics();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    const loadContexts = async (): Promise<void> => {
      if (!selectedTopic.trim() || selectedTopic === CREATE_NEW_OPTION) {
        setPreviousContexts([]);
        return;
      }
      try {
        const response = await fetchContentTopicContexts(selectedTopic.trim());
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
  }, [selectedTopic]);

  const shouldCreateNewTopic = previousTopics.length === 0 || selectedTopic === CREATE_NEW_OPTION;
  const shouldCreateNewContext = previousContexts.length === 0 || selectedContext === CREATE_NEW_OPTION;

  const onGeneratePreview = async (): Promise<void> => {
    setError("");
    setResult("");
    setPreview(null);
    setSelectedPhrases({});
    setSelectedWords({});

    const topicFromInput = shouldCreateNewTopic ? customTopic.trim() : selectedTopic.trim();
    if (!topicFromInput) {
      setError(previousTopics.length ? t("content.error.selectOrEnterTopic") : t("content.error.enterTopic"));
      return;
    }

    const contextFromInput = shouldCreateNewContext ? customContext.trim() : selectedContext.trim();

    setLoading(true);
    try {
      const data = await previewContent(topicFromInput, contextFromInput);
      setPreview(data);
      const topicsResponse = await fetchContentTopics();
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
      const response = await confirmContent(preview.topic, phrasesToSave, wordsToSave, preview.context || "");
      const phraseMessage = response.created_phrases_count
        ? t("content.result.phrasesCreated", { count: response.created_phrases_count })
        : t("content.result.phrasesExisted");
      if (!wordsToSave.length) {
        setResult(t("content.result.savedNoWords", { phraseMessage }));
      } else {
        setResult(t("content.result.savedWithWords", { count: response.created_words_count, phraseMessage }));
      }
      setSelectedTopic("");
      setCustomTopic("");
      setSelectedContext("");
      setCustomContext("");
      setPreviousContexts([]);
      setPreview(null);
      setSelectedPhrases({});
      setSelectedWords({});
      const topicsResponse = await fetchContentTopics();
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

  return (
    <main className="container" data-testid="content-create-page">
      <h1>{t("content.title")}</h1>
      <p>{t("content.description")}</p>
      <p>
        <Link to="/session">{t("content.backToSession")}</Link>
      </p>

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

      {preview && (
        <section className="card">
          <h2>{t("content.preview.title")}</h2>
          <p><strong>{t("content.preview.phrases")}</strong></p>
          <ul className="conversation-preview-list">
            {preview.phrases.map((phrase, index) => {
              const phraseKey = phrase.selection_key || `${phrase.spanish_text.toLowerCase()}|||${phrase.german_text.toLowerCase()}`;
              return (
                <li
                  key={`${phrase.spanish_text.toLowerCase()}|||${phrase.german_text.toLowerCase()}|||${index}`}
                  className={`conversation-turn ${index % 2 === 0 ? "speaker-a" : "speaker-b"}`}
                >
                  <p className="conversation-speaker">{index % 2 === 0 ? t("content.preview.personA") : t("content.preview.personB")}</p>
                  <p className="conversation-line">{phrase.spanish_text}</p>
                  <p className="conversation-line conversation-line-translation">{phrase.german_text}</p>
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
            <button onClick={() => void onConfirmSave()} disabled={saving}>
              {saving ? t("content.saving") : t("content.save")}
            </button>
            <button onClick={() => setPreview(null)} disabled={saving}>
              {t("content.cancel")}
            </button>
          </div>
        </section>
      )}
    </main>
  );
}
