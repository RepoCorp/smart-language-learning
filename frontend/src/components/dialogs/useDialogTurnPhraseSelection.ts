import { useState } from "react";

import { quickAddPhraseFromConversation } from "../../api";
import type { StudyLanguageCode } from "../../types";

import type { ActionStatus } from "../DialogTurnText";

type PendingPhraseAdd = {
  sourceText: string;
  targetText: string;
};

const cleanToken = (value: string): string => value.replace(/^[^A-Za-zÀ-ÖØ-öø-ÿ]+|[^A-Za-zÀ-ÖØ-öø-ÿ]+$/g, "").trim();

export function useDialogTurnPhraseSelection({
  dialogId,
  turnIndex,
  sourceText,
  targetText,
  sourceLanguage,
  targetLanguage,
  sentenceAddError,
  onOpenItem,
}: {
  dialogId: number;
  turnIndex: number;
  sourceText: string;
  targetText: string;
  sourceLanguage: StudyLanguageCode;
  targetLanguage: StudyLanguageCode;
  sentenceAddError: string;
  onOpenItem?: (itemId: number) => void | Promise<void>;
}): {
  selectingPhrase: boolean;
  selectedTokenIndexes: number[];
  phraseStatus: ActionStatus;
  phraseError: string;
  pendingPhraseAdd: PendingPhraseAdd | null;
  selectedPhraseTokenClass: (tokenIndex: number) => string;
  togglePhraseSelectionToken: (tokenIndex: number) => void;
  startPhraseSelection: () => void;
  cancelPhraseSelection: () => void;
  prepareSelectedPhrase: (tokens: string[]) => Promise<void>;
  addSelectedPhrase: () => Promise<void>;
  cancelPendingPhraseAdd: () => void;
} {
  const [selectingPhrase, setSelectingPhrase] = useState(false);
  const [selectedTokenIndexes, setSelectedTokenIndexes] = useState<number[]>([]);
  const [phraseStatus, setPhraseStatus] = useState<ActionStatus>("idle");
  const [phraseError, setPhraseError] = useState("");
  const [pendingPhraseAdd, setPendingPhraseAdd] = useState<PendingPhraseAdd | null>(null);

  const selectedPhraseTokenClass = (tokenIndex: number): string => {
    if (!selectedTokenIndexes.includes(tokenIndex)) return "";
    const sortedIndexes = [...selectedTokenIndexes].sort((left, right) => left - right);
    const firstIndex = sortedIndexes[0];
    const lastIndex = sortedIndexes[sortedIndexes.length - 1];
    if (tokenIndex === firstIndex && tokenIndex === lastIndex) return "turn-token-button-selected turn-token-button-selected-single";
    if (tokenIndex === firstIndex) return "turn-token-button-selected turn-token-button-selected-start";
    if (tokenIndex === lastIndex) return "turn-token-button-selected turn-token-button-selected-end";
    return "turn-token-button-selected turn-token-button-selected-middle";
  };

  const togglePhraseSelectionToken = (tokenIndex: number): void => {
    setSelectedTokenIndexes((current) => {
      const sortedIndexes = [...current].sort((left, right) => left - right);
      const firstIndex = sortedIndexes[0] ?? tokenIndex;
      const lastIndex = sortedIndexes[sortedIndexes.length - 1] ?? tokenIndex;
      if (current.includes(tokenIndex)) {
        if (tokenIndex === firstIndex) return sortedIndexes.slice(1);
        if (tokenIndex === lastIndex) return sortedIndexes.slice(0, -1);
        return [tokenIndex];
      }
      const rangeStart = Math.min(firstIndex, tokenIndex);
      const rangeEnd = Math.max(lastIndex, tokenIndex);
      return Array.from({ length: rangeEnd - rangeStart + 1 }, (_, offset) => rangeStart + offset);
    });
  };

  const startPhraseSelection = (): void => {
    setSelectingPhrase(true);
    setSelectedTokenIndexes([]);
    setPhraseError("");
    setPendingPhraseAdd(null);
  };

  const cancelPhraseSelection = (): void => {
    setSelectingPhrase(false);
    setSelectedTokenIndexes([]);
    setPhraseError("");
    setPendingPhraseAdd(null);
  };

  const prepareSelectedPhrase = async (tokens: string[]): Promise<void> => {
    if (selectedTokenIndexes.length < 2) return;
    const selectedTargetText = [...selectedTokenIndexes]
      .sort((left, right) => left - right)
      .map((index) => cleanToken(tokens[index] || ""))
      .filter(Boolean)
      .join(" ");
    if (!selectedTargetText) return;
    setPhraseStatus("saving");
    setPhraseError("");
    try {
      const result = await quickAddPhraseFromConversation(
        "", selectedTargetText, sourceLanguage, targetLanguage, true, dialogId, turnIndex, sourceText, targetText,
      );
      setPendingPhraseAdd({
        sourceText: result.source_text || "",
        targetText: result.target_text || selectedTargetText,
      });
      setPhraseStatus("idle");
    } catch (error) {
      setPhraseStatus("error");
      setPhraseError(error instanceof Error && error.message ? error.message : sentenceAddError);
    }
  };

  const addSelectedPhrase = async (): Promise<void> => {
    if (!pendingPhraseAdd?.targetText) return;
    setPhraseStatus("saving");
    setPhraseError("");
    try {
      const result = await quickAddPhraseFromConversation(
        pendingPhraseAdd.sourceText, pendingPhraseAdd.targetText, sourceLanguage, targetLanguage, false, dialogId, turnIndex, sourceText, targetText,
      );
      if (result.id && onOpenItem) await onOpenItem(result.id);
      setPhraseStatus(result.created ? "added" : "exists");
      setSelectingPhrase(false);
      setSelectedTokenIndexes([]);
      setPendingPhraseAdd(null);
    } catch (error) {
      setPhraseStatus("error");
      setPhraseError(error instanceof Error && error.message ? error.message : sentenceAddError);
    }
  };

  return {
    selectingPhrase,
    selectedTokenIndexes,
    phraseStatus,
    phraseError,
    pendingPhraseAdd,
    selectedPhraseTokenClass,
    togglePhraseSelectionToken,
    startPhraseSelection,
    cancelPhraseSelection,
    prepareSelectedPhrase,
    addSelectedPhrase,
    cancelPendingPhraseAdd: () => setPendingPhraseAdd(null),
  };
}
