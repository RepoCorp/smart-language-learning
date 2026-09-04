import { useState } from "react";

import { fetchContentItemDetail } from "../../api";
import type { SessionItem } from "../../types";

export default function useSessionItemModal(sourceLanguage: string, targetLanguage: string, loadError: string) {
  const [openedItem, setOpenedItem] = useState<SessionItem | null>(null);
  const [loadingOpenedItem, setLoadingOpenedItem] = useState(false);
  const [openedItemError, setOpenedItemError] = useState("");

  const openItemModal = async (itemId: number): Promise<void> => {
    setLoadingOpenedItem(true);
    setOpenedItem(null);
    setOpenedItemError("");
    try {
      const detail = await fetchContentItemDetail(itemId, sourceLanguage, targetLanguage);
      setOpenedItem({
        id: detail.id, item_type: detail.item_type, spanish_text: detail.spanish_text, german_text: detail.german_text,
        example_sentence: detail.example_sentence || "", notes: detail.notes || "", word_type: detail.word_type || "",
        plural_german: detail.plural_german || "", audio_url: detail.audio_url || "", exercise_phrases: detail.exercise_phrases || {},
        mode: "new", direction: null, options: [], dialog_phrase_answer: detail.dialog_phrase_answer || "",
        dialog_phrase_scene: detail.dialog_phrase_scene || "", dialog_phrase_scene_audio_urls: detail.dialog_phrase_scene_audio_urls || [],
        dialog_phrase_options: detail.dialog_phrase_options || [], dialog_phrase_turns: detail.dialog_phrase_turns || [],
        dialog_phrase_odd_index: detail.dialog_phrase_odd_index ?? null, related_dialogs: detail.related_dialogs || [],
        compare_words: detail.compare_words || [], compare_words_insights: detail.compare_words_insights || "", item_questions: detail.item_questions || [],
      });
    } catch {
      setOpenedItemError(loadError);
    } finally {
      setLoadingOpenedItem(false);
    }
  };

  const closeItemModal = (): void => {
    setOpenedItem(null);
    setLoadingOpenedItem(false);
    setOpenedItemError("");
  };

  return { openedItem, loadingOpenedItem, openedItemError, openItemModal, closeItemModal };
}
