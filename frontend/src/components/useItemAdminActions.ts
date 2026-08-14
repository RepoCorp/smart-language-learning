import { useState } from "react";

import {
  deleteContentItem,
  fetchContentItemDetail,
  regenerateContentItem,
  regenerateContentItemAudio,
  refreshContentItemWord,
  setContentItemLearned,
} from "../api";
import type { ContentItemDetailResponse, SessionItem, StudyLanguageCode } from "../types";

type AdminAction = "regenerate" | "rescan" | "audio" | "learned" | "delete" | null;

type Args = {
  itemId: number;
  itemType: SessionItem["item_type"];
  initialIsLearned: boolean;
  sourceLanguage: StudyLanguageCode;
  targetLanguage: StudyLanguageCode;
  onItemRegenerated: (detail: ContentItemDetailResponse) => void;
  onDialogsRescanned: (dialogs: SessionItem["related_dialogs"], createdCount: number) => void;
  onAudioRegenerated: (audioUrl: string) => void;
  onDeleted: () => void;
};

export function useItemAdminActions({
  itemId,
  itemType,
  initialIsLearned,
  sourceLanguage,
  targetLanguage,
  onItemRegenerated,
  onDialogsRescanned,
  onAudioRegenerated,
  onDeleted,
}: Args) {
  const [open, setOpen] = useState(false);
  const [activeAction, setActiveAction] = useState<AdminAction>(null);
  const [isLearned, setIsLearned] = useState(initialIsLearned);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const run = async (action: Exclude<AdminAction, null>, callback: () => Promise<void>): Promise<void> => {
    if (itemId <= 0 || activeAction) {
      return;
    }
    setActiveAction(action);
    setMessage("");
    setError("");
    try {
      await callback();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Item action failed");
    } finally {
      setActiveAction(null);
    }
  };

  const regenerateItem = (): Promise<void> => run("regenerate", async () => {
    await regenerateContentItem(itemId, sourceLanguage, targetLanguage);
    onItemRegenerated(await fetchContentItemDetail(itemId, sourceLanguage, targetLanguage));
  });

  const rescanDialogs = (): Promise<void> => run("rescan", async () => {
    if (itemType !== "word") {
      return;
    }
    const result = await refreshContentItemWord(itemId, sourceLanguage, targetLanguage);
    onDialogsRescanned(result.related_dialogs || [], result.dialog_occurrences_created || 0);
  });

  const regenerateAudio = (): Promise<void> => run("audio", async () => {
    onAudioRegenerated(await regenerateContentItemAudio(itemId, sourceLanguage, targetLanguage));
  });

  const toggleLearned = (): Promise<void> => run("learned", async () => {
    const nextIsLearned = !isLearned;
    await setContentItemLearned(itemId, nextIsLearned, sourceLanguage, targetLanguage);
    setIsLearned(nextIsLearned);
  });

  const deleteItem = (): Promise<void> => run("delete", async () => {
    await deleteContentItem(itemId, sourceLanguage, targetLanguage);
    setOpen(false);
    onDeleted();
  });

  return {
    open,
    setOpen,
    activeAction,
    isLearned,
    message,
    setMessage,
    error,
    regenerateItem,
    rescanDialogs,
    regenerateAudio,
    toggleLearned,
    deleteItem,
  };
}
