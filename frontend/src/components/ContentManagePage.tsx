import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { deleteContentItem, deleteContentTopic, fetchContentItems, fetchContentTopics } from "../api";
import { useI18n } from "../i18n";
import { useStudyLanguages } from "../studyLanguages";
import type { ContentItemRecord } from "../types";

export default function ContentManagePage(): JSX.Element {
  const { t } = useI18n();
  const { sourceLanguage, targetLanguage } = useStudyLanguages();
  const [topics, setTopics] = useState<string[]>([]);
  const [items, setItems] = useState<ContentItemRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const [deletingTopic, setDeletingTopic] = useState<string>("");
  const [deletingItemId, setDeletingItemId] = useState<number | null>(null);
  const [selectedTopics, setSelectedTopics] = useState<Record<string, boolean>>({});
  const [selectedItems, setSelectedItems] = useState<Record<number, boolean>>({});

  const wordItems = items.filter((item) => item.item_type === "word");
  const phraseItems = items.filter((item) => item.item_type === "phrase");

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

  const removeSelectedTopics = async (): Promise<void> => {
    if (deletingTopic || deletingItemId !== null) {
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
    if (deletingTopic || deletingItemId !== null) {
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

  const allTopicsSelected = topics.length > 0 && topics.every((topic) => selectedTopics[topic]);
  const allWordItemsSelected = wordItems.length > 0 && wordItems.every((item) => selectedItems[item.id]);
  const allPhraseItemsSelected = phraseItems.length > 0 && phraseItems.every((item) => selectedItems[item.id]);

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
    for (const topic of topics) {
      next[topic] = true;
    }
    setSelectedTopics(next);
  };

  const toggleAllWordItems = (): void => {
    if (allWordItemsSelected) {
      setSelectedItems((current) => {
        const next = { ...current };
        for (const item of wordItems) {
          delete next[item.id];
        }
        return next;
      });
      return;
    }
    setSelectedItems((current) => {
      const next = { ...current };
      for (const item of wordItems) {
        next[item.id] = true;
      }
      return next;
    });
  };

  const toggleAllPhraseItems = (): void => {
    if (allPhraseItemsSelected) {
      setSelectedItems((current) => {
        const next = { ...current };
        for (const item of phraseItems) {
          delete next[item.id];
        }
        return next;
      });
      return;
    }
    setSelectedItems((current) => {
      const next = { ...current };
      for (const item of phraseItems) {
        next[item.id] = true;
      }
      return next;
    });
  };

  return (
    <main className="container">
      <h1>{t("manage.title")}</h1>
      <p>
        <Link to="/session">{t("manage.backToSession")}</Link> |{" "}
        <Link to="/content/create">{t("manage.backToCreate")}</Link> |{" "}
        <Link to="/words">{t("session.wordsLibrary")}</Link>
      </p>
      {loading && <p>{t("session.loading")}</p>}
      {error && <p className="error">{error}</p>}

      {!loading && (
        <>
          <section className="card">
            <h2>{t("manage.topics")}</h2>
            {!topics.length && <p>{t("manage.emptyTopics")}</p>}
            {!!topics.length && (
              <ul className="manage-list">
                <li className="manage-actions-row">
                  <button
                    className="manage-toggle-all-button"
                    onClick={toggleAllTopics}
                    disabled={Boolean(deletingTopic) || deletingItemId !== null}
                  >
                    {allTopicsSelected ? t("manage.unselectAll") : t("manage.selectAll")}
                  </button>
                  <button
                    onClick={() => void removeSelectedTopics()}
                    disabled={
                      Boolean(deletingTopic)
                      || deletingItemId !== null
                      || !topics.some((topic) => selectedTopics[topic])
                    }
                  >
                    {deletingTopic ? t("manage.deleting") : t("manage.deleteSelectedTopics")}
                  </button>
                </li>
                {topics.map((topic) => (
                  <li key={topic} className="manage-row">
                    <label className="manage-checkbox">
                      <input
                        type="checkbox"
                        checked={Boolean(selectedTopics[topic])}
                        onChange={() => toggleTopicSelection(topic)}
                        disabled={Boolean(deletingTopic) || deletingItemId !== null}
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
            {!wordItems.length && <p>{t("manage.emptyWords")}</p>}
            {!!wordItems.length && (
              <ul className="manage-list">
                <li className="manage-actions-row">
                  <button
                    className="manage-toggle-all-button"
                    onClick={toggleAllWordItems}
                    disabled={Boolean(deletingTopic) || deletingItemId !== null}
                  >
                    {allWordItemsSelected ? t("manage.unselectAll") : t("manage.selectAll")}
                  </button>
                  <button
                    onClick={() => void removeSelectedItems(wordItems.map((item) => item.id))}
                    disabled={
                      Boolean(deletingTopic)
                      || deletingItemId !== null
                      || !wordItems.some((item) => selectedItems[item.id])
                    }
                  >
                    {deletingItemId !== null ? t("manage.deleting") : t("manage.deleteSelectedItems")}
                  </button>
                </li>
                {wordItems.map((item) => (
                  <li key={item.id} className="manage-row">
                    <label className="manage-checkbox">
                      <input
                        type="checkbox"
                        checked={Boolean(selectedItems[item.id])}
                        onChange={() => toggleItemSelection(item.id)}
                        disabled={Boolean(deletingTopic) || deletingItemId !== null}
                      />
                      {item.spanish_text} - {item.german_text}
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card">
            <h2>{t("manage.phrases")}</h2>
            {!phraseItems.length && <p>{t("manage.emptyPhrases")}</p>}
            {!!phraseItems.length && (
              <ul className="manage-list">
                <li className="manage-actions-row">
                  <button
                    className="manage-toggle-all-button"
                    onClick={toggleAllPhraseItems}
                    disabled={Boolean(deletingTopic) || deletingItemId !== null}
                  >
                    {allPhraseItemsSelected ? t("manage.unselectAll") : t("manage.selectAll")}
                  </button>
                  <button
                    onClick={() => void removeSelectedItems(phraseItems.map((item) => item.id))}
                    disabled={
                      Boolean(deletingTopic)
                      || deletingItemId !== null
                      || !phraseItems.some((item) => selectedItems[item.id])
                    }
                  >
                    {deletingItemId !== null ? t("manage.deleting") : t("manage.deleteSelectedItems")}
                  </button>
                </li>
                {phraseItems.map((item) => (
                  <li key={item.id} className="manage-row">
                    <label className="manage-checkbox">
                      <input
                        type="checkbox"
                        checked={Boolean(selectedItems[item.id])}
                        onChange={() => toggleItemSelection(item.id)}
                        disabled={Boolean(deletingTopic) || deletingItemId !== null}
                      />
                      {item.spanish_text} - {item.german_text}
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </main>
  );
}
