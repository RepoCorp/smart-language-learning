import { useEffect, useState } from "react";

import { generateContentDialogTurnClearAudio } from "../../api";
import { useI18n } from "../../i18n";
import DialogActionIcon from "../DialogActionIcon";
import DialogTurnsList from "../DialogTurnsList";
import DialogTurnAudioModeButton from "../dialogs/DialogTurnAudioModeButton";
import type { DialogTurnAudioMode } from "../dialogs/useDialogTurnPlayback";
import useSavedDialogPlayback from "./useSavedDialogPlayback";

type SavedTurn = {
  source_text: string;
  target_text: string;
  speaker?: "a" | "b";
  phrase_audio_url?: string;
  clear_audio_url?: string;
};

export default function SavedDialogCard({
  savedDialogId,
  savedDialogTurns,
  sourceLanguage,
  targetLanguage,
  wordActionStatus,
  phraseActionStatus,
  phraseActionError,
  onUpdateTurnAudio,
  onOpenItem,
  onTokenClick,
  onSavePhrase,
  onPhraseSaveStart,
}: {
  savedDialogId: number | null;
  savedDialogTurns: SavedTurn[];
  sourceLanguage: string;
  targetLanguage: string;
  wordActionStatus: Record<string, "idle" | "saving" | "added" | "exists" | "error">;
  phraseActionStatus: Record<string, "idle" | "saving" | "added" | "exists" | "error">;
  phraseActionError: Record<string, string>;
  onUpdateTurnAudio: (turnIndex: number, audioUrl: string, mode: DialogTurnAudioMode) => void;
  onOpenItem: (itemId: number) => Promise<void>;
  onTokenClick: (statusKey: string, token: string, turnIndex: number, sourceText: string, targetText: string) => void;
  onSavePhrase: (turn: SavedTurn, turnIndex: number) => Promise<void>;
  onPhraseSaveStart: () => void;
}): JSX.Element {
  const { t } = useI18n();
  const [open, setOpen] = useState<boolean>(true);
  const [turnAudioMode, setTurnAudioMode] = useState<DialogTurnAudioMode>("natural");
  const [loadingTurnAudioKey, setLoadingTurnAudioKey] = useState<string>("");
  const { playing, play, stop } = useSavedDialogPlayback(
    savedDialogTurns.map((turn) => turn.phrase_audio_url || "").filter(Boolean),
  );

  const wholeTurnPhraseKey = (turnIndex: number): string => `saved-${turnIndex}-whole-phrase`;

  const playTurn = async (turn: SavedTurn, turnIndex: number): Promise<void> => {
    const existingAudioUrl = turnAudioMode === "clear" ? turn.clear_audio_url || "" : turn.phrase_audio_url || "";
    if (existingAudioUrl) {
      const audio = new Audio(existingAudioUrl);
      void audio.play().catch(() => undefined);
      return;
    }
    if (!savedDialogId) {
      return;
    }
    const key = `${turnAudioMode}:${turnIndex}`;
    setLoadingTurnAudioKey(key);
    try {
      const audioUrl = turnAudioMode === "clear"
        ? await generateContentDialogTurnClearAudio(savedDialogId, turnIndex, sourceLanguage, targetLanguage)
        : "";
      if (audioUrl) {
        onUpdateTurnAudio(turnIndex, audioUrl, turnAudioMode);
        const audio = new Audio(audioUrl);
        void audio.play().catch(() => undefined);
      }
    } finally {
      setLoadingTurnAudioKey((current) => current === key ? "" : current);
    }
  };

  useEffect(() => {
    if (savedDialogTurns.length > 0) {
      setOpen(true);
    }
  }, [savedDialogTurns]);

  return (
    <section className="card content-create-card" data-guide-target="saved-dialog">
      <button
        type="button"
        className="content-collapsible-trigger"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="content-collapsible-trigger-copy">
          <strong>{t("content.result.dialogTitle")}</strong>
          <span className="content-collapsible-trigger-subtitle">{t("content.result.dialogWordHint")}</span>
        </span>
        <span className={`content-collapsible-trigger-icon${open ? " content-collapsible-trigger-icon-open" : ""}`} aria-hidden="true">
          ▾
        </span>
      </button>
      {open && (
        <div className="content-collapsible-body">
          {!!savedDialogTurns.some((turn) => turn.phrase_audio_url) && (
            <div className="actions">
              <button type="button" className="secondary-button" onClick={() => void (playing ? stop() : play())}>
                {playing ? t("dialogs.stopDialog") : t("dialogs.playDialog")}
              </button>
              <DialogTurnAudioModeButton
                mode={turnAudioMode}
                onToggle={() => setTurnAudioMode((current) => current === "natural" ? "clear" : "natural")}
              />
            </div>
          )}
          <DialogTurnsList
            dialogId={savedDialogId || -1}
            turns={savedDialogTurns}
            sourceLanguage={sourceLanguage}
            targetLanguage={targetLanguage}
            tokenStatus={wordActionStatus}
            statusKeyPrefixBase="saved"
            onOpenItem={onOpenItem}
            onTokenClick={(statusKey, token, turnIndex, sourceText, targetText) => onTokenClick(
              statusKey,
              token,
              turnIndex,
              sourceText,
              targetText,
            )}
            renderLeadingAction={(turn, turnIndex) => (
              <button
                type="button"
                className="secondary-button exercise-action-icon-button dialog-inline-action-button"
                disabled={!savedDialogId || loadingTurnAudioKey === `${turnAudioMode}:${turnIndex}`}
                onClick={() => void playTurn(turn, turnIndex)}
                aria-label={t("newItem.playTurnAudio")}
                title={t("newItem.playTurnAudio")}
              >
                <DialogActionIcon name="play" />
              </button>
            )}
            getWholePhraseSaveAction={(turn, index) => {
              const phraseKey = wholeTurnPhraseKey(index);
              return {
                onSave: () => onSavePhrase(turn, index),
                disabled: !savedDialogId,
                status: phraseActionStatus[phraseKey] || "idle",
                error: phraseActionError[phraseKey] || "",
              };
            }}
            onPhraseSaveStart={onPhraseSaveStart}
          />
        </div>
      )}
    </section>
  );
}
