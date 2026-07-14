import { useEffect, useState } from "react";

import {
  addContentItemCompareWords,
  fetchContentItemCompareWordInsights,
  removeContentItemCompareWord,
  searchContentItemCompareWords,
} from "../api";
import FormattedModelText from "./FormattedModelText";
import { useI18n } from "../i18n";
import type { CompareWordRecord } from "../types";
import type { StudyLanguageCode } from "../studyLanguages";

type Props = {
  open: boolean;
  itemId: number;
  compareWords: CompareWordRecord[];
  initialInsights: string;
  sourceLanguage: StudyLanguageCode;
  targetLanguage: StudyLanguageCode;
  onClose: () => void;
  onCompareWordsChange: (words: CompareWordRecord[]) => void;
  onInsightsChange: (insights: string) => void;
  onOpenItem: (itemId: number) => Promise<void>;
};

export default function CompareWordsModal({
  open,
  itemId,
  compareWords,
  initialInsights,
  sourceLanguage,
  targetLanguage,
  onClose,
  onCompareWordsChange,
  onInsightsChange,
  onOpenItem,
}: Props): JSX.Element | null {
  const { t } = useI18n();
  const [query, setQuery] = useState<string>("");
  const [results, setResults] = useState<CompareWordRecord[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [page, setPage] = useState<number>(1);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [insights, setInsights] = useState<string>(initialInsights || "");
  const [loadingInsights, setLoadingInsights] = useState<boolean>(false);
  const [insightsError, setInsightsError] = useState<string>("");
  const [showAddWords, setShowAddWords] = useState<boolean>(false);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      setSelectedIds([]);
      setPage(1);
      setHasMore(false);
      setLoading(false);
      setSaving(false);
      setErrorMessage("");
      setInsights(initialInsights || "");
      setInsightsError("");
      setLoadingInsights(false);
      setShowAddWords(false);
      return;
    }
    if (!showAddWords) {
      return;
    }
    let cancelled = false;
    const timeoutId = window.setTimeout(() => {
      void loadSearch(1, query, cancelled);
    }, 180);
    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [initialInsights, open, query, showAddWords]);

  useEffect(() => {
    setInsights(initialInsights || "");
    setInsightsError("");
  }, [compareWords, initialInsights]);

  const loadSearch = async (nextPage = 1, nextQuery = query, cancelled = false): Promise<void> => {
    setLoading(true);
    setErrorMessage("");
    try {
      const payload = await searchContentItemCompareWords(itemId, nextQuery, nextPage, 10, sourceLanguage, targetLanguage);
      if (cancelled) {
        return;
      }
      setResults(payload.items || []);
      setPage(payload.page || nextPage);
      setHasMore(Boolean(payload.has_more));
    } catch {
      if (!cancelled) {
        setErrorMessage(t("newItem.compareWordsLoadError"));
      }
    } finally {
      if (!cancelled) {
        setLoading(false);
      }
    }
  };

  const toggleSelection = (wordId: number): void => {
    setSelectedIds((current) => (
      current.includes(wordId) ? current.filter((id) => id !== wordId) : [...current, wordId]
    ));
  };

  const saveSelected = async (): Promise<void> => {
    if (!selectedIds.length || saving) {
      return;
    }
    setSaving(true);
    setErrorMessage("");
    try {
      const payload = await addContentItemCompareWords(itemId, selectedIds, sourceLanguage, targetLanguage);
      onCompareWordsChange(payload.compare_words || []);
      onInsightsChange(payload.compare_words_insights || "");
      setSelectedIds([]);
      setShowAddWords(false);
    } catch {
      setErrorMessage(t("newItem.compareWordsSaveError"));
    } finally {
      setSaving(false);
    }
  };

  const removeLinkedWord = async (linkedItemId: number): Promise<void> => {
    if (saving) {
      return;
    }
    setSaving(true);
    setErrorMessage("");
    try {
      const payload = await removeContentItemCompareWord(itemId, linkedItemId, sourceLanguage, targetLanguage);
      onCompareWordsChange(payload.compare_words || []);
      onInsightsChange(payload.compare_words_insights || "");
      void loadSearch(page, query);
    } catch {
      setErrorMessage(t("newItem.compareWordsRemoveError"));
    } finally {
      setSaving(false);
    }
  };

  const loadInsights = async (): Promise<void> => {
    if (!compareWords.length || loadingInsights) {
      return;
    }
    setLoadingInsights(true);
    setInsightsError("");
    try {
      const payload = await fetchContentItemCompareWordInsights(itemId, sourceLanguage, targetLanguage, Boolean(insights.trim()));
      setInsights(payload.insights || "");
      onInsightsChange(payload.insights || "");
    } catch (error) {
      setInsightsError(error instanceof Error && error.message ? error.message : t("newItem.compareWordsInsightsError"));
    } finally {
      setLoadingInsights(false);
    }
  };

  if (!open) {
    return null;
  }

  return (
    <div className="blocking-modal-overlay" role="dialog" aria-modal="true">
      <div className="blocking-modal related-dialogs-modal compare-words-modal">
        <button type="button" className="modal-corner-close" aria-label={t("newItem.closeRelatedDialogs")} onClick={onClose}>
          ×
        </button>
        <p>
          <strong>{t("newItem.compareWordsModalTitle")}</strong>
        </p>

        <div className="compare-words-section">
          <div className="compare-words-header">
            <p className="compare-words-title">
              <strong>{t("newItem.compareWordsTitle")}</strong>
            </p>
          </div>
          {!compareWords.length && (
            <p className="hint compare-words-empty">{t("newItem.compareWordsEmpty")}</p>
          )}
          {!!compareWords.length && (
            <div className="compare-words-list">
              {compareWords.map((linkedWord) => (
                <div key={linkedWord.id} className="compare-word-row">
                  <div className="compare-word-text">
                    <strong>{linkedWord.german_text}</strong>
                    <span>{linkedWord.spanish_text}</span>
                    <small>{linkedWord.word_type || t("newItem.wordAddTypeUnknown")}</small>
                  </div>
                  <div className="compare-word-actions">
                    <button type="button" className="secondary-button" onClick={() => void onOpenItem(linkedWord.id)}>
                      {t("words.openItem")}
                    </button>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => void removeLinkedWord(linkedWord.id)}
                      disabled={saving}
                    >
                      {t("newItem.compareWordsRemove")}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="actions">
            {!showAddWords && (
              <button type="button" className="secondary-button" onClick={() => setShowAddWords(true)}>
                {t("newItem.compareWordsAdd")}
              </button>
            )}
          </div>
        </div>

        <div className="compare-words-insights-section">
          <div className="actions">
            <button type="button" onClick={() => void loadInsights()} disabled={!compareWords.length || loadingInsights}>
              {loadingInsights
                ? (insights.trim() ? t("newItem.compareWordsInsightsRefreshing") : t("newItem.compareWordsInsightsLoading"))
                : (insights.trim() ? t("newItem.compareWordsInsightsRefresh") : t("newItem.compareWordsInsightsAsk"))}
            </button>
          </div>
          {insightsError && <p className="error">{insightsError}</p>}
          {insights && (
            <div className="revealed-answer compare-words-insights-output">
              <FormattedModelText text={insights} className="revealed-answer-translation compare-words-insights-text" />
            </div>
          )}
        </div>

        {showAddWords && (
          <div className="compare-words-add-section">
            <div className="compare-words-search-row">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t("newItem.compareWordsSearchPlaceholder")}
                disabled={saving}
              />
            </div>
            {errorMessage && <p className="error">{errorMessage}</p>}
            {loading && <p className="hint">{t("session.loading")}</p>}
            {!loading && !results.length && (
              <p className="hint">{t("newItem.compareWordsSearchEmpty")}</p>
            )}
            {!!results.length && (
              <div className="compare-words-modal-list">
                {results.map((candidate) => {
                  const checked = selectedIds.includes(candidate.id);
                  return (
                    <label key={candidate.id} className={`compare-word-select-row ${checked ? "compare-word-select-row-selected" : ""}`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleSelection(candidate.id)}
                        disabled={saving}
                      />
                      <span>
                        <strong>{candidate.german_text}</strong>
                        <small>{candidate.spanish_text}</small>
                        <em>{candidate.word_type || t("newItem.wordAddTypeUnknown")}</em>
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
            <div className="actions compare-words-modal-actions">
              <button
                type="button"
                onClick={() => void saveSelected()}
                disabled={!selectedIds.length || saving}
              >
                {saving ? t("newItem.wordAddSaving") : t("newItem.compareWordsConfirm")}
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setShowAddWords(false)}
                disabled={saving}
              >
                {t("content.cancel")}
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={() => void loadSearch(Math.max(1, page - 1), query)}
                disabled={page <= 1 || loading || saving}
              >
                {t("manage.previousPage")}
              </button>
              <span>{t("manage.pageLabel", { page })}</span>
              <button
                type="button"
                className="secondary-button"
                onClick={() => void loadSearch(page + 1, query)}
                disabled={!hasMore || loading || saving}
              >
                {t("manage.nextPage")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
