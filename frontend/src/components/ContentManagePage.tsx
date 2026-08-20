import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

import {
  deleteContentItem,
  deleteContentTopic,
  fetchContentItemDetail,
  fetchContentItems,
  fetchContentTopics,
  regenerateContentItemAudio,
} from "../api";
import NewItem from "./NewItem";
import { useI18n } from "../i18n";
import { useStudyLanguages } from "../studyLanguages";
import type { ContentItemRecord, SessionItem } from "../types";
import ManageFilterCard from "./manage/ManageFilterCard";
import ManageItemsSection from "./manage/ManageItemsSection";
import ManagePaginationCard from "./manage/ManagePaginationCard";
import ManageSectionCard from "./manage/ManageSectionCard";
import ManageTopicsSection from "./manage/ManageTopicsSection";
import { isManageSection, type ManageSection } from "./manage/manageTypes";

const PAGE_SIZE = 25;

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
  const [selectedTopics, setSelectedTopics] = useState<Record<string, boolean>>({});
  const [selectedItems, setSelectedItems] = useState<Record<number, boolean>>({});
  const [openedItem, setOpenedItem] = useState<SessionItem | null>(null);
  const [loadingOpenedItem, setLoadingOpenedItem] = useState<boolean>(false);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [page, setPage] = useState<number>(1);
  const [reloadToken, setReloadToken] = useState<number>(0);
  const sectionParam = searchParams.get("section");
  const currentSection: ManageSection = isManageSection(sectionParam) ? sectionParam : "words";
  const filterQuery = searchParams.get("filter") || "";
  const openedItemParam = searchParams.get("item") || "";
  const pageParam = Number.parseInt(searchParams.get("page") || "1", 10);

  useEffect(() => {
    const nextPage = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;
    setPage(nextPage);
  }, [pageParam]);

  const busy = Boolean(deletingTopic)
    || deletingItemId !== null
    || regeneratingAudioItemId !== null;

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
            "all",
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
  }, [currentSection, filterQuery, page, reloadToken, sourceLanguage, targetLanguage, t]);

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
          plural_german: detail.plural_german || "",
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
          compare_words_insights: detail.compare_words_insights || "",
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
      setSelectedTopics({});
      setReloadToken((current) => current + 1);
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
      setSelectedItems({});
      setReloadToken((current) => current + 1);
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

  const changeSection = (section: ManageSection): void => {
    updateSearchParams({ section, review_state: null }, true);
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
      <ManageSectionCard currentSection={currentSection} busy={busy} onChangeSection={changeSection} />
      <ManageFilterCard
        filterQuery={filterQuery}
        busy={busy}
        onFilterChange={(value) => updateSearchParams({ filter: value || null }, true)}
        onClearFilter={() => updateSearchParams({ filter: null }, true)}
      />
      {loading && <p>{t("session.loading")}</p>}
      {error && <p className="error">{error}</p>}

      {!loading && currentSection === "topics" && (
        <ManageTopicsSection
          topics={topics}
          selectedTopics={selectedTopics}
          deletingTopic={deletingTopic}
          busy={busy}
          onToggleAllTopics={toggleAllTopics}
          allTopicsSelected={allTopicsSelected}
          onRemoveSelectedTopics={() => void removeSelectedTopics()}
          onToggleTopicSelection={toggleTopicSelection}
        />
      )}

      {!loading && currentSection !== "topics" && (
        <ManageItemsSection
          currentSection={currentSection}
          items={items}
          selectedItems={selectedItems}
          busy={busy}
          deletingItemId={deletingItemId}
          regeneratingAudioItemId={regeneratingAudioItemId}
          onToggleAllItems={toggleAllItems}
          allItemsSelected={allItemsSelected}
          onRemoveSelectedItems={() => void removeSelectedItems()}
          onToggleItemSelection={toggleItemSelection}
          onOpenItemModal={openItemModal}
          onRegenerateAudio={regenerateAudio}
        />
      )}

      {!loading && (
        <ManagePaginationCard page={page} hasMore={hasMore} busy={busy} onPreviousPage={goToPreviousPage} onNextPage={goToNextPage} />
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
