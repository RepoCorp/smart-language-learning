import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { deleteContentItem, deleteContentTopic, fetchContentItemDetail, fetchContentItems, fetchContentTopics, regenerateContentItemAudio, setContentItemLearned } from "../api";
import NewItem from "./NewItem";
import { useI18n } from "../i18n";
import { useStudyLanguages } from "../studyLanguages";
import type { ContentItemRecord, SessionItem } from "../types";

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
  const filterQuery = searchParams.get("filter") || "";
  const openedItemParam = searchParams.get("item") || "";

  const normalizedFilter = filterQuery.trim().toLowerCase();
  const filteredTopics = topics.filter((topic) => topic.toLowerCase().includes(normalizedFilter));
  const wordItems = items.filter((item) => item.item_type === "word");
  const phraseItems = items.filter((item) => item.item_type === "phrase");
  const filteredWordItems = wordItems.filter(
    (item) =>
      `${item.spanish_text} ${item.german_text}`.toLowerCase().includes(normalizedFilter),
  );
  const filteredPhraseItems = phraseItems.filter(
    (item) =>
      `${item.spanish_text} ${item.german_text}`.toLowerCase().includes(normalizedFilter),
  );

  const load = async (): Promise<void> => {
    setLoading(true);
    setError("");
    try {
      const [topicsResponse, itemsResponse] = await Promise.all([
        fetchContentTopics(sourceLanguage, targetLanguage),
        fetchContentItems(sourceLanguage, targetLanguage),
      ]);
      setTopics(topicsResponse.topics || []);
      setItems(itemsResponse.items || []);
      setSelectedTopics({});
      setSelectedItems({});
    } catch {
      setError(t("manage.error.load"));
      setTopics([]);
      setItems([]);
      setSelectedTopics({});
      setSelectedItems({});
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [sourceLanguage, targetLanguage]);

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
          audio_url: detail.audio_url || "",
          exercise_phrases: detail.exercise_phrases || {},
          mode: "new",
          direction: null,
          options: [],
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
  }, [openedItemParam, sourceLanguage, targetLanguage]);

  const openItemModal = (itemId: number): void => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("item", String(itemId));
    setSearchParams(nextParams);
  };

  const closeItemModal = (): void => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("item");
    setSearchParams(nextParams);
    setOpenedItem(null);
    setLoadingOpenedItem(false);
  };

  const removeSelectedTopics = async (): Promise<void> => {
    if (deletingTopic || deletingItemId !== null || regeneratingAudioItemId !== null || markingLearnedItemId !== null) {
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
      setTopics((current) => current.filter((value) => !selectedTopics[value]));
      setSelectedTopics({});
    } catch {
      setError(t("manage.error.deleteTopic"));
    } finally {
      setDeletingTopic("");
    }
  };

  const removeSelectedItems = async (itemIdsScope: number[]): Promise<void> => {
    if (deletingTopic || deletingItemId !== null || regeneratingAudioItemId !== null || markingLearnedItemId !== null) {
      return;
    }
    const itemIdsToDelete = itemIdsScope.filter((itemId) => selectedItems[itemId]);
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
      setSelectedItems((current) => {
        const next = { ...current };
        for (const itemId of itemIdsToDelete) {
          delete next[itemId];
        }
        return next;
      });
    } catch {
      setError(t("manage.error.deleteItem"));
    } finally {
      setDeletingItemId(null);
    }
  };

  const allTopicsSelected = filteredTopics.length > 0 && filteredTopics.every((topic) => selectedTopics[topic]);
  const allWordItemsSelected = filteredWordItems.length > 0 && filteredWordItems.every((item) => selectedItems[item.id]);
  const allPhraseItemsSelected = filteredPhraseItems.length > 0 && filteredPhraseItems.every((item) => selectedItems[item.id]);

  const toggleTopicSelection = (topic: string): void => {
    setSelectedTopics((current) => ({ ...current, [topic]: !current[topic] }));
  };

  const toggleItemSelection = (itemId: number): void => {
    setSelectedItems((current) => ({ ...current, [itemId]: !current[itemId] }));
  };

  const toggleAllTopics = (): void => {
    if (allTopicsSelected) {
      setSelectedTopics({});
      return;
    }
    const next: Record<string, boolean> = {};
    for (const topic of filteredTopics) {
      next[topic] = true;
    }
    setSelectedTopics(next);
  };

  const toggleAllWordItems = (): void => {
    if (allWordItemsSelected) {
      setSelectedItems((current) => {
        const next = { ...current };
        for (const item of filteredWordItems) {
          delete next[item.id];
        }
        return next;
      });
      return;
    }
    setSelectedItems((current) => {
      const next = { ...current };
      for (const item of filteredWordItems) {
        next[item.id] = true;
      }
      return next;
    });
  };

  const toggleAllPhraseItems = (): void => {
    if (allPhraseItemsSelected) {
      setSelectedItems((current) => {
        const next = { ...current };
        for (const item of filteredPhraseItems) {
          delete next[item.id];
        }
        return next;
      });
      return;
    }
    setSelectedItems((current) => {
      const next = { ...current };
      for (const item of filteredPhraseItems) {
        next[item.id] = true;
      }
      return next;
    });
  };

  const regenerateAudio = async (item: ContentItemRecord): Promise<void> => {
    if (deletingTopic || deletingItemId !== null || regeneratingAudioItemId !== null || markingLearnedItemId !== null) {
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
    if (deletingTopic || deletingItemId !== null || regeneratingAudioItemId !== null || markingLearnedItemId !== null) {
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

  return (
    <main className="container">
      <h1>{t("manage.title")}</h1>
      <section className="card">
        <label htmlFor="manage-filter" className="prompt">{t("manage.filterLabel")}</label>
        <div className="actions">
          <input
            id="manage-filter"
            value={filterQuery}
            onChange={(event) => {
              const nextValue = event.target.value;
              const nextParams = new URLSearchParams(searchParams);
              if (nextValue) {
                nextParams.set("filter", nextValue);
              } else {
                nextParams.delete("filter");
              }
              setSearchParams(nextParams);
            }}
            placeholder={t("manage.filterPlaceholder")}
            disabled={
              Boolean(deletingTopic)
              || deletingItemId !== null
              || regeneratingAudioItemId !== null
              || markingLearnedItemId !== null
            }
          />
          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              const nextParams = new URLSearchParams(searchParams);
              nextParams.delete("filter");
              setSearchParams(nextParams);
            }}
            disabled={
              !filterQuery
              || Boolean(deletingTopic)
              || deletingItemId !== null
              || regeneratingAudioItemId !== null
              || markingLearnedItemId !== null
            }
          >
            {t("manage.filterClear")}
          </button>
        </div>
      </section>
      {loading && <p>{t("session.loading")}</p>}
      {error && <p className="error">{error}</p>}

      {!loading && (
        <>
          <section className="card">
            <h2>{t("manage.topics")}</h2>
            {!filteredTopics.length && <p>{t("manage.emptyTopics")}</p>}
            {!!filteredTopics.length && (
              <ul className="manage-list">
                <li className="manage-actions-row">
                  <button
                    className="manage-toggle-all-button"
                    onClick={toggleAllTopics}
                    disabled={
                      Boolean(deletingTopic)
                      || deletingItemId !== null
                      || regeneratingAudioItemId !== null
                      || markingLearnedItemId !== null
                    }
                  >
                    {allTopicsSelected ? t("manage.unselectAll") : t("manage.selectAll")}
                  </button>
                  <button
                    onClick={() => void removeSelectedTopics()}
                    disabled={
                      Boolean(deletingTopic)
                      || deletingItemId !== null
                      || regeneratingAudioItemId !== null
                      || markingLearnedItemId !== null
                      || !filteredTopics.some((topic) => selectedTopics[topic])
                    }
                  >
                    {deletingTopic ? t("manage.deleting") : t("manage.deleteSelectedTopics")}
                  </button>
                </li>
                {filteredTopics.map((topic) => (
                  <li key={topic} className="manage-row">
                    <label className="manage-checkbox">
                      <input
                        type="checkbox"
                        checked={Boolean(selectedTopics[topic])}
                        onChange={() => toggleTopicSelection(topic)}
                        disabled={
                          Boolean(deletingTopic)
                          || deletingItemId !== null
                          || regeneratingAudioItemId !== null
                          || markingLearnedItemId !== null
                        }
                      />
                      {topic}
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card">
            <h2>{t("manage.words")}</h2>
            {!filteredWordItems.length && <p>{t("manage.emptyWords")}</p>}
            {!!filteredWordItems.length && (
              <ul className="manage-list">
                <li className="manage-actions-row">
                  <button
                    className="manage-toggle-all-button"
                    onClick={toggleAllWordItems}
                    disabled={
                      Boolean(deletingTopic)
                      || deletingItemId !== null
                      || regeneratingAudioItemId !== null
                      || markingLearnedItemId !== null
                    }
                  >
                    {allWordItemsSelected ? t("manage.unselectAll") : t("manage.selectAll")}
                  </button>
                  <button
                    onClick={() => void removeSelectedItems(filteredWordItems.map((item) => item.id))}
                    disabled={
                      Boolean(deletingTopic)
                      || deletingItemId !== null
                      || regeneratingAudioItemId !== null
                      || markingLearnedItemId !== null
                      || !filteredWordItems.some((item) => selectedItems[item.id])
                    }
                  >
                    {deletingItemId !== null ? t("manage.deleting") : t("manage.deleteSelectedItems")}
                  </button>
                </li>
                {filteredWordItems.map((item) => (
                  <li key={item.id} className="manage-row manage-item-row">
                    <div className="manage-item-main">
                      <input
                        type="checkbox"
                        checked={Boolean(selectedItems[item.id])}
                        onChange={() => toggleItemSelection(item.id)}
                        disabled={
                          Boolean(deletingTopic)
                          || deletingItemId !== null
                          || regeneratingAudioItemId !== null
                          || markingLearnedItemId !== null
                        }
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
                    <button
                      type="button"
                      className="secondary-button manage-item-action-button"
                      onClick={() => void regenerateAudio(item)}
                      disabled={
                        Boolean(deletingTopic)
                        || deletingItemId !== null
                        || regeneratingAudioItemId !== null
                        || markingLearnedItemId !== null
                      }
                    >
                      {regeneratingAudioItemId === item.id ? t("manage.regeneratingAudio") : t("manage.regenerateAudio")}
                    </button>
                    <button
                      type="button"
                      className={`manage-item-action-button ${item.is_learned ? "manage-item-action-button-unmark" : "manage-item-action-button-mark"}`}
                      onClick={() => void toggleLearned(item)}
                      disabled={
                        Boolean(deletingTopic)
                        || deletingItemId !== null
                        || regeneratingAudioItemId !== null
                        || markingLearnedItemId !== null
                      }
                    >
                      {item.is_learned ? t("manage.unmarkLearned") : t("manage.markLearned")}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card">
            <h2>{t("manage.phrases")}</h2>
            {!filteredPhraseItems.length && <p>{t("manage.emptyPhrases")}</p>}
            {!!filteredPhraseItems.length && (
              <ul className="manage-list">
                <li className="manage-actions-row">
                  <button
                    className="manage-toggle-all-button"
                    onClick={toggleAllPhraseItems}
                    disabled={
                      Boolean(deletingTopic)
                      || deletingItemId !== null
                      || regeneratingAudioItemId !== null
                      || markingLearnedItemId !== null
                    }
                  >
                    {allPhraseItemsSelected ? t("manage.unselectAll") : t("manage.selectAll")}
                  </button>
                  <button
                    onClick={() => void removeSelectedItems(filteredPhraseItems.map((item) => item.id))}
                    disabled={
                      Boolean(deletingTopic)
                      || deletingItemId !== null
                      || regeneratingAudioItemId !== null
                      || markingLearnedItemId !== null
                      || !filteredPhraseItems.some((item) => selectedItems[item.id])
                    }
                  >
                    {deletingItemId !== null ? t("manage.deleting") : t("manage.deleteSelectedItems")}
                  </button>
                </li>
                {filteredPhraseItems.map((item) => (
                  <li key={item.id} className="manage-row manage-item-row">
                    <div className="manage-item-main">
                      <input
                        type="checkbox"
                        checked={Boolean(selectedItems[item.id])}
                        onChange={() => toggleItemSelection(item.id)}
                        disabled={
                          Boolean(deletingTopic)
                          || deletingItemId !== null
                          || regeneratingAudioItemId !== null
                          || markingLearnedItemId !== null
                        }
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
                    <button
                      type="button"
                      className="secondary-button manage-item-action-button"
                      onClick={() => void regenerateAudio(item)}
                      disabled={
                        Boolean(deletingTopic)
                        || deletingItemId !== null
                        || regeneratingAudioItemId !== null
                        || markingLearnedItemId !== null
                      }
                    >
                      {regeneratingAudioItemId === item.id ? t("manage.regeneratingAudio") : t("manage.regenerateAudio")}
                    </button>
                    <button
                      type="button"
                      className={`manage-item-action-button ${item.is_learned ? "manage-item-action-button-unmark" : "manage-item-action-button-mark"}`}
                      onClick={() => void toggleLearned(item)}
                      disabled={
                        Boolean(deletingTopic)
                        || deletingItemId !== null
                        || regeneratingAudioItemId !== null
                        || markingLearnedItemId !== null
                      }
                    >
                      {item.is_learned ? t("manage.unmarkLearned") : t("manage.markLearned")}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
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
