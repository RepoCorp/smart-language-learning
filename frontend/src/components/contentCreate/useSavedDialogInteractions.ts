import { useState } from "react";

import {
  fetchContentItemDetail,
  quickAddPhraseFromConversation,
  quickAddWordFromDialog,
} from "../../api";
import type { SessionItem, StudyLanguageCode } from "../../types";

export type SavedDialogTurn = {
  source_text: string;
  target_text: string;
  speaker?: "a" | "b";
  phrase_audio_url?: string;
  clear_audio_url?: string;
};

type ActionStatus = "idle" | "saving" | "added" | "exists" | "error";
export type PendingWordAdd = {
  key: string;
  source: string;
  target: string;
  wordType: string;
  sourceLine: string;
  targetLine: string;
  clickedTargetToken: string;
  turnIndex: number;
  note: string;
};

function buildSessionItem(detail: Awaited<ReturnType<typeof fetchContentItemDetail>>, fallbackWordType = ""): SessionItem {
  return {
    id: detail.id,
    item_type: detail.item_type,
    spanish_text: detail.spanish_text,
    german_text: detail.german_text,
    example_sentence: detail.example_sentence || "",
    notes: detail.notes || "",
    word_type: detail.word_type || fallbackWordType,
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
  };
}

export default function useSavedDialogInteractions(
  sourceLanguage: StudyLanguageCode,
  targetLanguage: StudyLanguageCode,
  sentenceAddError: string,
) {
  const [savedDialogId, setSavedDialogId] = useState<number | null>(null);
  const [savedDialogTurns, setSavedDialogTurns] = useState<SavedDialogTurn[]>([]);
  const [phraseActionStatus, setPhraseActionStatus] = useState<Record<string, ActionStatus>>({});
  const [phraseActionError, setPhraseActionError] = useState<Record<string, string>>({});
  const [wordActionStatus, setWordActionStatus] = useState<Record<string, ActionStatus>>({});
  const [pendingWordAdd, setPendingWordAdd] = useState<PendingWordAdd | null>(null);
  const [addingWord, setAddingWord] = useState(false);
  const [openedLinkedWord, setOpenedLinkedWord] = useState<SessionItem | null>(null);
  const [loadingLinkedWord, setLoadingLinkedWord] = useState(false);

  const reset = (): void => {
    setSavedDialogId(null);
    setSavedDialogTurns([]);
    setPhraseActionStatus({});
    setPhraseActionError({});
    setWordActionStatus({});
    setPendingWordAdd(null);
  };

  const setSavedDialog = (dialogId: number | null, turns: SavedDialogTurn[]): void => {
    setSavedDialogId(dialogId);
    setSavedDialogTurns(turns);
    setPhraseActionStatus({});
    setPhraseActionError({});
  };

  const openItem = async (itemId: number, fallbackWordType = ""): Promise<void> => {
    setLoadingLinkedWord(true);
    try {
      const detail = await fetchContentItemDetail(itemId, sourceLanguage, targetLanguage);
      setOpenedLinkedWord(buildSessionItem(detail, fallbackWordType));
    } finally {
      setLoadingLinkedWord(false);
    }
  };

  const requestAddWord = async (key: string, rawToken: string, turnIndex: number, sourceLine: string, targetLine: string): Promise<void> => {
    const targetToken = rawToken.replace(/^[^A-Za-zÀ-ÖØ-öø-ÿ]+|[^A-Za-zÀ-ÖØ-öø-ÿ]+$/g, "").trim();
    if (!targetToken || !savedDialogId) return;
    setWordActionStatus((current) => ({ ...current, [key]: "saving" }));
    try {
      const check = await quickAddWordFromDialog(targetToken, targetToken, sourceLanguage, targetLanguage, savedDialogId, turnIndex, true, sourceLine, targetLine, targetToken);
      if (check.exists) {
        if (!check.id) {
          setWordActionStatus((current) => ({ ...current, [key]: "error" }));
          return;
        }
        await openItem(check.id, check.word_type || "");
        setWordActionStatus((current) => ({ ...current, [key]: "exists" }));
        return;
      }
      const wordType = String(check.word_type || "").trim();
      if (!wordType) {
        setWordActionStatus((current) => ({ ...current, [key]: "error" }));
        return;
      }
      setWordActionStatus((current) => ({ ...current, [key]: "idle" }));
      setPendingWordAdd({ key, source: check.source_text || targetToken, target: check.target_text || targetToken, wordType, sourceLine, targetLine, clickedTargetToken: targetToken, turnIndex, note: check.notes || "" });
    } catch {
      setWordActionStatus((current) => ({ ...current, [key]: "error" }));
    }
  };

  const confirmAddWord = async (): Promise<void> => {
    if (!pendingWordAdd || !savedDialogId || addingWord) return;
    const { key, source, target, sourceLine, targetLine, clickedTargetToken, turnIndex } = pendingWordAdd;
    setWordActionStatus((current) => ({ ...current, [key]: "saving" }));
    setAddingWord(true);
    try {
      const result = await quickAddWordFromDialog(source, target, sourceLanguage, targetLanguage, savedDialogId, turnIndex, false, sourceLine, targetLine, clickedTargetToken);
      setWordActionStatus((current) => ({ ...current, [key]: result.created ? "added" : "exists" }));
    } catch {
      setWordActionStatus((current) => ({ ...current, [key]: "error" }));
    } finally {
      setAddingWord(false);
      setPendingWordAdd(null);
    }
  };

  const addWholeTurnPhrase = async (turn: SavedDialogTurn, turnIndex: number): Promise<void> => {
    if (!savedDialogId || !turn.source_text.trim() || !turn.target_text.trim()) return;
    const key = `saved-${turnIndex}-whole-phrase`;
    setPhraseActionStatus((current) => ({ ...current, [key]: "saving" }));
    setPhraseActionError((current) => ({ ...current, [key]: "" }));
    try {
      const result = await quickAddPhraseFromConversation(turn.source_text, turn.target_text, sourceLanguage, targetLanguage, false, savedDialogId, turnIndex, turn.source_text, turn.target_text);
      if (result.id) await openItem(result.id);
      setPhraseActionStatus((current) => ({ ...current, [key]: result.created ? "added" : "exists" }));
    } catch (error) {
      setPhraseActionStatus((current) => ({ ...current, [key]: "error" }));
      setPhraseActionError((current) => ({ ...current, [key]: error instanceof Error && error.message ? error.message : sentenceAddError }));
    }
  };

  const updateTurnAudio = (turnIndex: number, audioUrl: string, mode: "natural" | "clear"): void => {
    setSavedDialogTurns((current) => current.map((turn, index) => index === turnIndex ? { ...turn, [mode === "clear" ? "clear_audio_url" : "phrase_audio_url"]: audioUrl } : turn));
  };

  return { savedDialogId, savedDialogTurns, phraseActionStatus, phraseActionError, wordActionStatus, pendingWordAdd, addingWord, openedLinkedWord, loadingLinkedWord, reset, setSavedDialog, requestAddWord, confirmAddWord, addWholeTurnPhrase, updateTurnAudio, openItem, closeOpenedLinkedWord: () => setOpenedLinkedWord(null), closePendingWordAdd: () => setPendingWordAdd(null) };
}
