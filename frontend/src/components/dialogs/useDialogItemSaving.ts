import { useState, type Dispatch, type SetStateAction } from "react";

import {
  fetchContentItemDetail,
  quickAddPhraseFromConversation,
  quickAddWordFromDialog,
} from "../../api";
import { useI18n } from "../../i18n";
import { toItemViewSessionItem } from "../../itemViewItem";
import type { ContentDialogRecord, SessionItem, StudyLanguageCode } from "../../types";

export type DialogItemActionStatus = "idle" | "saving" | "added" | "exists" | "error";

export type PendingWordAdd = {
  key: string;
  source: string;
  target: string;
  wordType: string;
  dialogId?: number;
  turnIndex?: number;
  sourceLine: string;
  targetLine: string;
  clickedTargetToken: string;
  note: string;
};

type DialogTurn = NonNullable<ContentDialogRecord["turns"]>[number];

const cleanToken = (value: string): string => value.replace(/^[^A-Za-zÀ-ÖØ-öø-ÿ]+|[^A-Za-zÀ-ÖØ-öø-ÿ]+$/g, "").trim();

export function useDialogItemSaving({
  sourceLanguage,
  targetLanguage,
  phraseKeyPrefix = "dialog",
}: {
  sourceLanguage: StudyLanguageCode;
  targetLanguage: StudyLanguageCode;
  phraseKeyPrefix?: string;
}): {
  wordActionStatus: Record<string, DialogItemActionStatus>;
  phraseActionStatus: Record<string, DialogItemActionStatus>;
  phraseActionError: Record<string, string>;
  pendingWordAdd: PendingWordAdd | null;
  addingWord: boolean;
  openedLinkedWord: SessionItem | null;
  loadingLinkedWord: boolean;
  isSaving: boolean;
  setPendingWordAdd: Dispatch<SetStateAction<PendingWordAdd | null>>;
  setOpenedLinkedWord: Dispatch<SetStateAction<SessionItem | null>>;
  resetItemSaving: () => void;
  openLinkedWordItem: (itemId: number) => Promise<void>;
  requestAddWordFromDialogToken: (key: string, sourceTokenRaw: string, targetTokenRaw: string, dialogId?: number, turnIndex?: number, sourceLine?: string, targetLine?: string) => Promise<void>;
  confirmAddWordFromDialog: () => Promise<void>;
  addWholeTurnPhraseFromDialog: (dialogId: number, turn: DialogTurn, turnIndex: number) => Promise<void>;
  wholeTurnPhraseKey: (dialogId: number, turnIndex: number) => string;
} {
  const { t } = useI18n();
  const [wordActionStatus, setWordActionStatus] = useState<Record<string, DialogItemActionStatus>>({});
  const [phraseActionStatus, setPhraseActionStatus] = useState<Record<string, DialogItemActionStatus>>({});
  const [phraseActionError, setPhraseActionError] = useState<Record<string, string>>({});
  const [pendingWordAdd, setPendingWordAdd] = useState<PendingWordAdd | null>(null);
  const [addingWord, setAddingWord] = useState<boolean>(false);
  const [openedLinkedWord, setOpenedLinkedWord] = useState<SessionItem | null>(null);
  const [loadingLinkedWord, setLoadingLinkedWord] = useState<boolean>(false);

  const openLinkedWordItem = async (itemId: number): Promise<void> => {
    setLoadingLinkedWord(true);
    try {
      const detail = await fetchContentItemDetail(itemId, sourceLanguage, targetLanguage);
      setOpenedLinkedWord(toItemViewSessionItem(detail));
    } finally {
      setLoadingLinkedWord(false);
    }
  };

  const requestAddWordFromDialogToken = async (
    key: string,
    sourceTokenRaw: string,
    targetTokenRaw: string,
    dialogId?: number,
    turnIndex?: number,
    sourceLine = "",
    targetLine = "",
  ): Promise<void> => {
    const sourceToken = cleanToken(sourceTokenRaw);
    const targetToken = cleanToken(targetTokenRaw);
    if (!sourceToken || !targetToken) {
      return;
    }
    setWordActionStatus((current) => ({ ...current, [key]: "saving" }));
    try {
      const check = await quickAddWordFromDialog(
        sourceToken, targetToken, sourceLanguage, targetLanguage, dialogId, turnIndex, true, sourceLine, targetLine, targetToken,
      );
      if (check.exists) {
        if (!check.id) {
          setWordActionStatus((current) => ({ ...current, [key]: "error" }));
          return;
        }
        await openLinkedWordItem(check.id);
        setWordActionStatus((current) => ({ ...current, [key]: "exists" }));
        return;
      }
      const wordType = String(check.word_type || "").trim();
      if (!wordType) {
        setWordActionStatus((current) => ({ ...current, [key]: "error" }));
        return;
      }
      setWordActionStatus((current) => ({ ...current, [key]: "idle" }));
      setPendingWordAdd({
        key,
        source: check.source_text || sourceToken,
        target: check.target_text || targetToken,
        wordType,
        dialogId,
        turnIndex,
        sourceLine,
        targetLine,
        clickedTargetToken: targetToken,
        note: check.notes || "",
      });
    } catch {
      setWordActionStatus((current) => ({ ...current, [key]: "error" }));
    }
  };

  const confirmAddWordFromDialog = async (): Promise<void> => {
    if (!pendingWordAdd || addingWord) {
      return;
    }
    const { key, source, target, dialogId, turnIndex, sourceLine, targetLine, clickedTargetToken } = pendingWordAdd;
    setWordActionStatus((current) => ({ ...current, [key]: "saving" }));
    setAddingWord(true);
    try {
      const result = await quickAddWordFromDialog(
        source, target, sourceLanguage, targetLanguage, dialogId, turnIndex, false, sourceLine, targetLine, clickedTargetToken,
      );
      if (result.id) {
        await openLinkedWordItem(result.id);
      }
      setWordActionStatus((current) => ({ ...current, [key]: result.created ? "added" : "exists" }));
    } catch {
      setWordActionStatus((current) => ({ ...current, [key]: "error" }));
    } finally {
      setAddingWord(false);
      setPendingWordAdd(null);
    }
  };

  const wholeTurnPhraseKey = (dialogId: number, turnIndex: number): string => `${phraseKeyPrefix}-${dialogId}-turn-${turnIndex}-whole-phrase`;

  const addWholeTurnPhraseFromDialog = async (dialogId: number, turn: DialogTurn, turnIndex: number): Promise<void> => {
    if (!turn.source_text.trim() || !turn.target_text.trim()) {
      return;
    }
    const statusKey = wholeTurnPhraseKey(dialogId, turnIndex);
    setPhraseActionStatus((current) => ({ ...current, [statusKey]: "saving" }));
    setPhraseActionError((current) => ({ ...current, [statusKey]: "" }));
    try {
      const result = await quickAddPhraseFromConversation(
        turn.source_text, turn.target_text, sourceLanguage, targetLanguage, false, dialogId, turnIndex, turn.source_text, turn.target_text,
      );
      if (result.id) {
        await openLinkedWordItem(result.id);
      }
      setPhraseActionStatus((current) => ({ ...current, [statusKey]: result.created ? "added" : "exists" }));
    } catch (error) {
      setPhraseActionStatus((current) => ({ ...current, [statusKey]: "error" }));
      setPhraseActionError((current) => ({
        ...current,
        [statusKey]: error instanceof Error && error.message ? error.message : t("newItem.sentenceAddError"),
      }));
    }
  };

  const isSaving = addingWord
    || loadingLinkedWord
    || Object.values(wordActionStatus).includes("saving")
    || Object.values(phraseActionStatus).includes("saving");

  return {
    wordActionStatus,
    phraseActionStatus,
    phraseActionError,
    pendingWordAdd,
    addingWord,
    openedLinkedWord,
    loadingLinkedWord,
    isSaving,
    setPendingWordAdd,
    setOpenedLinkedWord,
    resetItemSaving: () => {
      setWordActionStatus({});
      setPhraseActionStatus({});
      setPhraseActionError({});
      setPendingWordAdd(null);
    },
    openLinkedWordItem,
    requestAddWordFromDialogToken,
    confirmAddWordFromDialog,
    addWholeTurnPhraseFromDialog,
    wholeTurnPhraseKey,
  };
}
