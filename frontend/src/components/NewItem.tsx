import { useEffect, useState } from "react";

import { useI18n } from "../i18n";
import { type StudyLanguageCode, useStudyLanguages } from "../studyLanguages";
import type { SessionItem } from "../types";

interface NewItemProps {
  item: SessionItem;
  onContinue: () => Promise<void>;
}

export default function NewItem({ item, onContinue }: NewItemProps): JSX.Element {
  const { t } = useI18n();
  const { sourceLanguage, targetLanguage } = useStudyLanguages();
  const languageKeyByCode: Record<StudyLanguageCode, Parameters<typeof t>[0]> = {
    spanish: "study.language.spanish",
    english: "study.language.english",
    german: "study.language.german",
    french: "study.language.french",
    italian: "study.language.italian",
    portuguese: "study.language.portuguese",
  };
  const sourceLanguageLabel = t(languageKeyByCode[sourceLanguage]);
  const targetLanguageLabel = t(languageKeyByCode[targetLanguage]);
  const [saving, setSaving] = useState<boolean>(false);
  const [showAllDialogs, setShowAllDialogs] = useState<boolean>(false);
  const [showDialogsModal, setShowDialogsModal] = useState<boolean>(false);

  const markAsSeen = async (): Promise<void> => {
    if (saving) {
      return;
    }
    setSaving(true);
    try {
      await onContinue();
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== "Enter") {
        return;
      }
      event.preventDefault();
      void markAsSeen();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [saving, onContinue]);

  useEffect(() => {
    if (!showDialogsModal) {
      return;
    }
    const timeoutId = window.setTimeout(() => {
      const firstMatch = document.querySelector(".related-dialogs-modal .turn-highlight");
      if (firstMatch instanceof HTMLElement) {
        firstMatch.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 30);
    return () => window.clearTimeout(timeoutId);
  }, [showDialogsModal, showAllDialogs, item.related_dialogs]);

  const wordCandidates = (word: string): string[] => {
    const normalized = word.trim();
    if (!normalized) {
      return [];
    }
    const candidates = [normalized];
    const withoutArticle = normalized.replace(/^(der|die|das)\s+/i, "").trim();
    if (withoutArticle && withoutArticle.toLowerCase() !== normalized.toLowerCase()) {
      candidates.push(withoutArticle);
    }
    return candidates.sort((a, b) => b.length - a.length);
  };

  const containsWordInTurn = (turnTargetText: string, word: string): boolean => {
    const text = turnTargetText.trim();
    if (!text) {
      return false;
    }
    for (const candidate of wordCandidates(word)) {
      const escaped = candidate.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const pattern = new RegExp(`\\b${escaped}\\b`, "i");
      if (pattern.test(text)) {
        return true;
      }
    }
    return false;
  };

  const renderTargetTurn = (turnTargetText: string, word: string): JSX.Element => {
    for (const candidate of wordCandidates(word)) {
      const escaped = candidate.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const pattern = new RegExp(`\\b${escaped}\\b`, "i");
      const match = pattern.exec(turnTargetText);
      if (match && match.index >= 0) {
        const start = match.index;
        const end = start + match[0].length;
        return (
          <>
            {turnTargetText.slice(0, start)}
            <mark className="turn-word-highlight">{turnTargetText.slice(start, end)}</mark>
            {turnTargetText.slice(end)}
          </>
        );
      }
    }
    return <>{turnTargetText}</>;
  };

  const playTurnAudio = async (phraseAudioUrl: string, turnIndex: number, includeWord: boolean): Promise<void> => {
    if (!phraseAudioUrl) {
      return;
    }
    const sequence: string[] = [];
    if (item.item_type === "word" && includeWord && item.audio_url) {
      sequence.push(item.audio_url);
    }
    sequence.push(phraseAudioUrl);
    for (let index = 0; index < sequence.length; index += 1) {
      const source = sequence[index];
      if (!source) {
        continue;
      }
      await new Promise<void>((resolve) => {
        const audio = new Audio(source);
        audio.onended = () => resolve();
        audio.onerror = () => resolve();
        void audio.play().catch(() => resolve());
      });
      if (index === 0 && item.item_type === "word" && turnIndex >= 0) {
        await new Promise<void>((resolve) => window.setTimeout(resolve, 120));
      }
    }
  };

  return (
    <div>
      <p className="prompt">{item.item_type === "word" ? t("newItem.word") : t("newItem.phrase")}</p>
      <p>
        <strong>{t("newItem.sourceLabel", { language: sourceLanguageLabel })}</strong> {item.spanish_text}
      </p>
      <p>
        <strong>{t("newItem.targetLabel", { language: targetLanguageLabel })}</strong> {item.german_text}
      </p>
      <p>
        <strong>{t("newItem.notes")}</strong> {item.notes || "-"}
      </p>
      {item.audio_url && (
        <>
          <audio controls src={item.audio_url}>
            {t("newItem.noAudioSupport")}
          </audio>
          {item.item_type === "word" && (
            <p>
              <a href={item.audio_url} target="_blank" rel="noreferrer">
                {t("newItem.audioLink")}
              </a>
            </p>
          )}
        </>
      )}
      {item.item_type === "word" && (
        <div className="actions">
          <button type="button" onClick={() => setShowDialogsModal(true)}>
            {t("newItem.openRelatedDialogs")}
          </button>
        </div>
      )}
      <div className="actions">
        <button onClick={markAsSeen} disabled={saving}>
          {saving ? t("newItem.saving") : t("newItem.gotIt")}
        </button>
      </div>
      {showDialogsModal && item.item_type === "word" && (
        <div className="blocking-modal-overlay" role="dialog" aria-modal="true">
          <div className="blocking-modal related-dialogs-modal">
            <p>
              <strong>{t("newItem.relatedDialogs", { count: item.related_dialogs?.length || 0 })}</strong>
            </p>
            {!item.related_dialogs?.length && <p>{t("newItem.noRelatedDialogs")}</p>}
            {!!item.related_dialogs?.length && (
              <div className="related-dialogs-scroll">
                {(showAllDialogs ? item.related_dialogs : item.related_dialogs.slice(0, 2)).map((dialog) => {
                const matchedTurnIndexes = new Set(dialog.matched_turns.map((turn) => turn.turn_index));
                return (
                  <div key={dialog.dialog_id} className="related-dialog-card">
                    <p>
                      <strong>{dialog.topic}</strong>
                    </p>
                    <p>
                      <strong>{t("newItem.dialogContext")}:</strong> {dialog.context || t("newItem.dialogNoContext")}
                    </p>
                    {dialog.audio_url && (
                      <>
                        <audio controls src={dialog.audio_url}>
                          {t("newItem.noAudioSupport")}
                        </audio>
                        <p>
                          <a href={dialog.audio_url} target="_blank" rel="noreferrer">
                            {t("newItem.playFullDialog")}
                          </a>
                        </p>
                      </>
                    )}
                    {!!dialog.turns.length && (
                      <>
                        <p><strong>{t("newItem.dialogTurns")}:</strong></p>
                        <ul className="conversation-preview-list">
                          {dialog.turns.map((turn, index) => {
                            const includeWord = item.item_type === "word" && containsWordInTurn(turn.target_text, item.german_text);
                            return (
                              <li
                                key={`${dialog.dialog_id}-full-${index}`}
                                className={`conversation-turn ${index % 2 === 0 ? "speaker-a" : "speaker-b"} ${
                                  matchedTurnIndexes.has(index) ? "turn-highlight" : ""
                                }`}
                              >
                            <p className="conversation-speaker">
                              {index % 2 === 0 ? t("content.preview.personA") : t("content.preview.personB")}
                            </p>
                            <p className="conversation-line conversation-line-translation">
                              {item.item_type === "word" ? renderTargetTurn(turn.target_text, item.german_text) : turn.target_text}
                              <button
                                type="button"
                                className="turn-audio-button"
                                disabled={!turn.phrase_audio_url || (item.item_type === "word" && includeWord && !item.audio_url)}
                                onClick={() => void playTurnAudio(turn.phrase_audio_url || "", index, includeWord)}
                              >
                                {t("newItem.playTurnAudio")}
                              </button>
                            </p>
                            <p className="conversation-line">{turn.source_text}</p>
                          </li>
                            );
                          })}
                      </ul>
                      </>
                    )}
                  </div>
                );
                })}
              </div>
            )}
            <div className="actions">
              {!!item.related_dialogs?.length && item.related_dialogs.length > 2 && (
                <button type="button" onClick={() => setShowAllDialogs((value) => !value)}>
                  {showAllDialogs ? t("newItem.hideMoreDialogs") : t("newItem.showMoreDialogs")}
                </button>
              )}
              <button type="button" onClick={() => setShowDialogsModal(false)}>
                {t("newItem.closeRelatedDialogs")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
