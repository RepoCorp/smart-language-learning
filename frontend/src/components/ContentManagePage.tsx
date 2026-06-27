import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

import {
  deleteContentItem,
  deleteContentTopic,
  fetchContentItemDetail,
  fetchContentItems,
  fetchContentTopics,
  regenerateContentItemAudio,
  setContentItemLearned,
} from "../api";
import DangerousButton from "./DangerousButton";
import NewItem from "./NewItem";
import { useI18n } from "../i18n";
import { useStudyLanguages } from "../studyLanguages";
import type { ContentItemRecord, SessionItem } from "../types";

type ManageSection = "topics" | "words" | "phrases";

const PAGE_SIZE = 25;

function isManageSection(value: string | null): value is ManageSection {
  return value === "topics" || value === "words" || value === "phrases";
}

export default function ContentManagePage(): JSX.Element {
  const { t } = useI18n();
  const { sourceLanguage, targetLanguage } = useStudyLanguages();
  const [searchParams, setSearchParams] = useSearchParams();
  const [topics, setTopics] = useState<string[]>([]);
  const [items, setItems] = useState<ContentItemRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const [deletingTopic, setDeletingTopic] = useState<string>("");
  const [deletingItemId, setDeletingItemId] = useState<number | null>(null);
  const [regeneratingAudioItemId, setRegeneratingAudioItemId] = useState<number | null>(null);
  const [markingLearnedItemId, setMarkingLearnedItemId] = useState<number | null>(null);
  const [selectedTopics, setSelectedTopics] = useState<Record<string, boolean>>({});
  const [selectedItems, setSelectedItems] = useState<Record<number, boolean>>({});
  const [openedItem, setOpenedItem] = useState<SessionItem | null>(null);
  const [loadingOpenedItem, setLoadingOpenedItem] = useState<boolean>(false);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [page, setPage] = useState<number>(1);
  const sectionParam = searchParams.get("section");
  const currentSection: ManageSection = isManageSection(sectionParam) ? sectionParam : "topics";
  const filterQuery = searchParams.get("filter") || "";
  const openedItemParam = searchParams.get("item") || "";
  const pageParam = Number.parseInt(searchParams.get("page") || "1", 10);

  useEffect(() => {
    const nextPage = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;
    setPage(nextPage);
  }, [pageParam]);

  const busy = Boolean(deletingTopic)
    || deletingItemId !== null
    || regeneratingAudioItemId !== null
    || markingLearnedItemId !== null;

  const updateSearchParams = (updates: Record<string, string | null>, resetPage = false): void => {
    const nextParams = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === "") {
        nextParams.delete(key);
      } else {
        nextParams.set(key, value);
      }
    }
    if (resetPage) {
      nextParams.delete("page");
    }
    setSearchParams(nextParams);
  };

  useEffect(() => {
    let cancelled = false;
    const load = async (): Promise<void> => {
      setLoading(true);
      setError("");
      try {
        if (currentSection === "topics") {
          const topicsResponse = await fetchContentTopics(
            sourceLanguage,
            targetLanguage,
            page,
            PAGE_SIZE,
            filterQuery,
          );
          if (cancelled) {
            return;
          }
          setTopics(topicsResponse.topics || []);
          setItems([]);
          setHasMore(Boolean(topicsResponse.has_more));
          setSelectedTopics({});
        } else {
          const itemsResponse = await fetchContentItems(
            sourceLanguage,
            targetLanguage,
            currentSection,
            page,
            PAGE_SIZE,
            filterQuery,
          );
          if (cancelled) {
            return;
          }
          setItems(itemsResponse.items || []);
          setTopics([]);
          setHasMore(Boolean(itemsResponse.has_more));
          setSelectedItems({});
        }
      } catch {
        if (cancelled) {
          return;
        }
        setError(t("manage.error.load"));
        setTopics([]);
        setItems([]);
        setHasMore(false);
        setSelectedTopics({});
        setSelectedItems({});
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [currentSection, filterQuery, page, sourceLanguage, targetLanguage, t]);

  useEffect(() => {
    const itemId = Number.parseInt(openedItemParam, 10);
    if (!itemId) {
      setOpenedItem(null);
      setLoadingOpenedItem(false);
      return;
    }
    let cancelled = false;
    const loadItem = async (): Promise<void> => {
      setLoadingOpenedItem(true);
      try {
        const detail = await fetchContentItemDetail(itemId, sourceLanguage, targetLanguage);
        if (cancelled) {
          return;
        }
        setOpenedItem({
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
      } catch {
        if (!cancelled) {
          setOpenedItem(null);
          setError(t("manage.error.load"));
        }
      } finally {
        if (!cancelled) {
          setLoadingOpenedItem(false);
        }
      }
    };
    void loadItem();
    return () => {
      cancelled = true;
    };
  }, [openedItemParam, sourceLanguage, targetLanguage, t]);

  const openItemModal = (itemId: number): void => {
    updateSearchParams({ item: String(itemId) });
  };

  const closeItemModal = (): void => {
    updateSearchParams({ item: null });
    setOpenedItem(null);
    setLoadingOpenedItem(false);
  };

  const removeSelectedTopics = async (): Promise<void> => {
    if (busy) {
      return;
    }
    const topicsToDelete = topics.filter((topic) => selectedTopics[topic]);
    if (!topicsToDelete.length) {
      return;
    }
    setDeletingTopic("__batch__");
    setError("");
    try {
      await Promise.all(
        topicsToDelete.map((topic) => deleteContentTopic(topic, sourceLanguage, targetLanguage)),
      );
      const deletedSet = new Set(topicsToDelete);
      setTopics((current) => current.filter((topic) => !deletedSet.has(topic)));
      setSelectedTopics({});
    } catch {
      setError(t("manage.error.deleteTopic"));
    } finally {
      setDeletingTopic("");
    }
  };

  const removeSelectedItems = async (): Promise<void> => {
    if (busy) {
      return;
    }
    const itemIdsToDelete = items.filter((item) => selectedItems[item.id]).map((item) => item.id);
    if (!itemIdsToDelete.length) {
      return;
    }
    setDeletingItemId(-1);
    setError("");
    try {
      await Promise.all(
        itemIdsToDelete.map((itemId) => deleteContentItem(itemId, sourceLanguage, targetLanguage)),
      );
      const deletedSet = new Set(itemIdsToDelete);
      setItems((current) => current.filter((item) => !deletedSet.has(item.id)));
      setSelectedItems({});
    } catch {
      setError(t("manage.error.deleteItem"));
    } finally {
      setDeletingItemId(null);
    }
  };

  const toggleTopicSelection = (topic: string): void => {
    setSelectedTopics((current) => ({ ...current, [topic]: !current[topic] }));
  };

  const toggleItemSelection = (itemId: number): void => {
    setSelectedItems((current) => ({ ...current, [itemId]: !current[itemId] }));
  };

  const allTopicsSelected = topics.length > 0 && topics.every((topic) => selectedTopics[topic]);
  const allItemsSelected = items.length > 0 && items.every((item) => selectedItems[item.id]);

  const toggleAllTopics = (): void => {
    if (allTopicsSelected) {
      setSelectedTopics({});
      return;
    }
    const next: Record<string, boolean> = {};
    for (const topic of topics) {
      next[topic] = true;
    }
    setSelectedTopics(next);
  };

  const toggleAllItems = (): void => {
    if (allItemsSelected) {
      setSelectedItems({});
      return;
    }
    const next: Record<number, boolean> = {};
    for (const item of items) {
      next[item.id] = true;
    }
    setSelectedItems(next);
  };

  const regenerateAudio = async (item: ContentItemRecord): Promise<void> => {
    if (busy) {
      return;
    }
    setRegeneratingAudioItemId(item.id);
    setError("");
    try {
      const audioUrl = await regenerateContentItemAudio(item.id, sourceLanguage, targetLanguage);
      setItems((current) =>
        current.map((entry) => (entry.id === item.id ? { ...entry, audio_url: audioUrl || entry.audio_url } : entry)),
      );
    } catch {
      setError(t("manage.error.regenerateAudio"));
    } finally {
      setRegeneratingAudioItemId(null);
    }
  };

  const toggleLearned = async (item: ContentItemRecord): Promise<void> => {
    if (busy) {
      return;
    }
    setMarkingLearnedItemId(item.id);
    setError("");
    try {
      const nextLearned = !Boolean(item.is_learned);
      await setContentItemLearned(item.id, nextLearned, sourceLanguage, targetLanguage);
      setItems((current) =>
        current.map((entry) => (entry.id === item.id ? { ...entry, is_learned: nextLearned } : entry)),
      );
    } catch {
      setError(t("manage.error.updateLearned"));
    } finally {
      setMarkingLearnedItemId(null);
    }
  };

  const changeSection = (section: ManageSection): void => {
    updateSearchParams({ section }, true);
  };

  const goToPreviousPage = (): void => {
    updateSearchParams({ page: String(Math.max(1, page - 1)) });
  };

  const goToNextPage = (): void => {
    updateSearchParams({ page: String(page + 1) });
  };

  return (
    <main className="container">
      <h1>{t("manage.title")}</h1>
      <section className="card">
        <label className="prompt">{t("manage.sectionLabel")}</label>
        <div className="actions">
          <button
            type="button"
            className={currentSection === "topics" ? "secondary-button" : ""}
            onClick={() => changeSection("topics")}
            disabled={busy}
          >
            {t("manage.sectionTopics")}
          </button>
          <button
            type="button"
            className={currentSection === "words" ? "secondary-button" : ""}
            onClick={() => changeSection("words")}
            disabled={busy}
          >
            {t("manage.sectionWords")}
          </button>
          <button
            type="button"
            className={currentSection === "phrases" ? "secondary-button" : ""}
            onClick={() => changeSection("phrases")}
            disabled={busy}
          >
            {t("manage.sectionPhrases")}
          </button>
        </div>
      </section>
      <section className="card">
        <label htmlFor="manage-filter" className="prompt">{t("manage.filterLabel")}</label>
        <div className="actions">
          <input
            id="manage-filter"
            value={filterQuery}
            onChange={(event) => updateSearchParams({ filter: event.target.value || null }, true)}
            placeholder={t("manage.filterPlaceholder")}
            disabled={busy}
          />
          <button
            type="button"
            className="secondary-button"
            onClick={() => updateSearchParams({ filter: null }, true)}
            disabled={!filterQuery || busy}
          >
            {t("manage.filterClear")}
          </button>
        </div>
      </section>
      {loading && <p>{t("session.loading")}</p>}
      {error && <p className="error">{error}</p>}

      {!loading && currentSection === "topics" && (
        <section className="card">
          <h2>{t("manage.topics")}</h2>
          {!topics.length && <p>{t("manage.emptyTopics")}</p>}
          {!!topics.length && (
            <ul className="manage-list">
              <li className="manage-actions-row">
                <button
                  className="manage-toggle-all-button"
                  onClick={toggleAllTopics}
                  disabled={busy}
                >
                  {allTopicsSelected ? t("manage.unselectAll") : t("manage.selectAll")}
                </button>
                <DangerousButton
                  className="dangerous-action-button"
                  onConfirm={removeSelectedTopics}
                  disabled={busy || !topics.some((topic) => selectedTopics[topic])}
                >
                  {deletingTopic ? t("manage.deleting") : t("manage.deleteSelectedTopics")}
                </DangerousButton>
              </li>
              {topics.map((topic) => (
                <li key={topic} className="manage-row">
                  <label className="manage-checkbox">
                    <input
                      type="checkbox"
                      checked={Boolean(selectedTopics[topic])}
                      onChange={() => toggleTopicSelection(topic)}
                      disabled={busy}
                    />
                    {topic}
                  </label>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {!loading && currentSection !== "topics" && (
        <section className="card">
          <h2>{currentSection === "words" ? t("manage.words") : t("manage.phrases")}</h2>
          {!items.length && <p>{currentSection === "words" ? t("manage.emptyWords") : t("manage.emptyPhrases")}</p>}
          {!!items.length && (
            <ul className="manage-list">
              <li className="manage-actions-row">
                <button
                  className="manage-toggle-all-button"
                  onClick={toggleAllItems}
                  disabled={busy}
                >
                  {allItemsSelected ? t("manage.unselectAll") : t("manage.selectAll")}
                </button>
                <DangerousButton
                  className="dangerous-action-button"
                  onConfirm={removeSelectedItems}
                  disabled={busy || !items.some((item) => selectedItems[item.id])}
                >
                  {deletingItemId !== null ? t("manage.deleting") : t("manage.deleteSelectedItems")}
                </DangerousButton>
              </li>
              {items.map((item) => (
                <li key={item.id} className="manage-row manage-item-row">
                  <div className="manage-item-main">
                    <input
                      type="checkbox"
                      checked={Boolean(selectedItems[item.id])}
                      onChange={() => toggleItemSelection(item.id)}
                      disabled={busy}
                    />
                    <div className="manage-item-text">
                      <button
                        type="button"
                        className="word-link-button manage-item-link"
                        onClick={() => openItemModal(item.id)}
                      >
                        {item.german_text} - {item.spanish_text}
                      </button>
                      <span className="manage-item-meta">
                        {item.next_review_days === null || item.next_review_days === undefined
                          ? t("manage.nextReviewNew")
                          : t("manage.nextReviewDays", { count: item.next_review_days })}
                      </span>
                    </div>
                  </div>
                  <DangerousButton
                    className="secondary-button manage-item-action-button dangerous-action-button"
                    onConfirm={() => regenerateAudio(item)}
                    disabled={busy}
                  >
                    {regeneratingAudioItemId === item.id ? t("manage.regeneratingAudio") : t("manage.regenerateAudio")}
                  </DangerousButton>
                  <button
                    type="button"
                    className={`manage-item-action-button ${item.is_learned ? "manage-item-action-button-unmark" : "manage-item-action-button-mark"}`}
                    onClick={() => void toggleLearned(item)}
                    disabled={busy}
                  >
                    {item.is_learned ? t("manage.unmarkLearned") : t("manage.markLearned")}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {!loading && (
        <section className="card">
          <div className="actions">
            <button
              type="button"
              className="secondary-button"
              onClick={goToPreviousPage}
              disabled={page <= 1 || busy}
            >
              {t("manage.previousPage")}
            </button>
            <span>{t("manage.pageLabel", { page })}</span>
            <button
              type="button"
              className="secondary-button"
              onClick={goToNextPage}
              disabled={!hasMore || busy}
            >
              {t("manage.nextPage")}
            </button>
          </div>
        </section>
      )}

      {(loadingOpenedItem || openedItem) && (
        <div className="blocking-modal-overlay" role="dialog" aria-modal="true">
          <div className="blocking-modal related-dialogs-modal">
            {loadingOpenedItem && <p>{t("session.loading")}</p>}
            {!loadingOpenedItem && openedItem && (
              <NewItem item={openedItem} readOnly onClose={closeItemModal} />
            )}
          </div>
        </div>
      )}
    </main>
  );
}
