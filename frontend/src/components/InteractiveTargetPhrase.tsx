import { useState } from "react";

import { fetchContentItemDetail, quickAddWordFromDialog } from "../api";
import { useI18n } from "../i18n";
import { useStudyLanguages } from "../studyLanguages";
import type { SessionItem } from "../types";
import DialogTurnText from "./DialogTurnText";
import NewItem from "./NewItem";

type WordActionStatus = "idle" | "saving" | "added" | "exists" | "error";

type PendingWordAdd = {
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

interface InteractiveTargetPhraseProps {
  className?: string;
  targetText: string;
  sourceText: string;
  hideTargetText?: boolean;
  dialogId?: number;
  turnIndex?: number;
  statusKeyPrefix: string;
}

function cleanToken(value: string): string {
  return value.replace(/^[^A-Za-zÀ-ÖØ-öø-ÿ]+|[^A-Za-zÀ-ÖØ-öø-ÿ]+$/g, "").trim();
}

export default function InteractiveTargetPhrase({
  className,
  targetText,
  sourceText,
  hideTargetText = false,
  dialogId,
  turnIndex,
  statusKeyPrefix,
}: InteractiveTargetPhraseProps): JSX.Element {
  const { t } = useI18n();
  const { sourceLanguage, targetLanguage } = useStudyLanguages();
  const [wordActionStatus, setWordActionStatus] = useState<Record<string, WordActionStatus>>({});
  const [pendingWordAdd, setPendingWordAdd] = useState<PendingWordAdd | null>(null);
  const [addingWord, setAddingWord] = useState<boolean>(false);
  const [openedLinkedWord, setOpenedLinkedWord] = useState<SessionItem | null>(null);
  const [loadingLinkedWord, setLoadingLinkedWord] = useState<boolean>(false);

  const openLinkedWordItem = async (itemId: number): Promise<void> => {
    setLoadingLinkedWord(true);
    try {
      const detail = await fetchContentItemDetail(itemId, sourceLanguage, targetLanguage);
      setOpenedLinkedWord({
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
        compare_words: detail.compare_words || [],
        compare_words_insights: detail.compare_words_insights || "",
        item_questions: detail.item_questions || [],
      });
    } finally {
      setLoadingLinkedWord(false);
    }
  };

  const requestAddWordFromDialogToken = async (
    key: string,
    targetTokenRaw: string,
  ): Promise<void> => {
    const targetToken = cleanToken(targetTokenRaw);
    if (!targetToken) {
      return;
    }

    setWordActionStatus((current) => ({ ...current, [key]: "saving" }));
    try {
      const check = await quickAddWordFromDialog(
        targetToken,
        targetToken,
        sourceLanguage,
        targetLanguage,
        dialogId,
        turnIndex,
        true,
        sourceText,
        targetText,
        targetToken,
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
      setWordActionStatus((current) => ({ ...current, [key]: "idle" }));
      const resolvedWordType = String(check.word_type || "").trim();
      if (!resolvedWordType) {
        setWordActionStatus((current) => ({ ...current, [key]: "error" }));
        return;
      }
      setPendingWordAdd({
        key,
        source: check.source_text || targetToken,
        target: check.target_text || targetToken,
        wordType: resolvedWordType,
        dialogId,
        turnIndex,
        sourceLine: sourceText,
        targetLine: targetText,
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

    const { key, source, target, sourceLine, targetLine, clickedTargetToken } = pendingWordAdd;
    setWordActionStatus((current) => ({ ...current, [key]: "saving" }));
    setAddingWord(true);
    try {
      const result = await quickAddWordFromDialog(
        source,
        target,
        sourceLanguage,
        targetLanguage,
        pendingWordAdd.dialogId,
        pendingWordAdd.turnIndex,
        false,
        sourceLine,
        targetLine,
        clickedTargetToken,
      );
      if (result.exists) {
        if (!result.id) {
          setWordActionStatus((current) => ({ ...current, [key]: "error" }));
          return;
        }
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

  return (
    <>
      <div className={className}>
        <DialogTurnText
          dialogId={dialogId ?? -1}
          turnIndex={turnIndex ?? -1}
          sourceText={sourceText}
          targetText={targetText}
          sourceLanguage={sourceLanguage}
          targetLanguage={targetLanguage}
          tokenStatus={wordActionStatus}
          statusKeyPrefix={statusKeyPrefix}
          hideTargetText={hideTargetText}
          showPhraseSelection={false}
          onOpenItem={openLinkedWordItem}
          onTokenClick={(key, token) => void requestAddWordFromDialogToken(key, token)}
        />
      </div>
      {pendingWordAdd && (
        <div className="blocking-modal-overlay" role="dialog" aria-modal="true">
          <div className="blocking-modal add-word-modal">
            <p className="add-word-modal-title">
              <strong>{t("newItem.wordAddTitle")}</strong>
            </p>
            <p className="add-word-modal-word">{pendingWordAdd.target}</p>
            <p className="add-word-modal-meaning">
              {t("newItem.wordAddMeaning", { translation: pendingWordAdd.source })}
            </p>
            <p className="add-word-modal-type">
              <strong>{t("newItem.wordAddType", { type: pendingWordAdd.wordType })}</strong>
            </p>
            {pendingWordAdd.note && (
              <p className="hint">{t("newItem.wordAddNote", { note: pendingWordAdd.note })}</p>
            )}
            <p className="hint">{t("newItem.wordAddPrompt")}</p>
            <div className="actions">
              <button type="button" className="secondary-button" onClick={() => setPendingWordAdd(null)} disabled={addingWord}>
                {t("newItem.wordAddCancel")}
              </button>
              <button type="button" onClick={() => void confirmAddWordFromDialog()} disabled={addingWord}>
                {addingWord ? t("newItem.wordAddSaving") : t("newItem.wordAddConfirmButton")}
              </button>
            </div>
          </div>
        </div>
      )}
      {loadingLinkedWord && (
        <div className="blocking-modal-overlay" role="dialog" aria-modal="true">
          <div className="blocking-modal add-word-modal">
            <p>{t("session.loading")}</p>
          </div>
        </div>
      )}
      {openedLinkedWord && (
        <div className="blocking-modal-overlay" role="dialog" aria-modal="true">
          <div className="blocking-modal words-item-modal">
            <NewItem item={openedLinkedWord} readOnly onClose={() => setOpenedLinkedWord(null)} />
          </div>
        </div>
      )}
    </>
  );
}
