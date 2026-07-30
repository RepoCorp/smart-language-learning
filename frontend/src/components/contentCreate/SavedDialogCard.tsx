import { useState } from "react";

import { useI18n } from "../../i18n";
import DialogActionIcon from "../DialogActionIcon";
import DialogTurnsList from "../DialogTurnsList";

type SavedTurn = {
  source_text: string;
  target_text: string;
  speaker?: "a" | "b";
  phrase_audio_url?: string;
};

export default function SavedDialogCard({
  savedDialogId,
  savedDialogTurns,
  sourceLanguage,
  targetLanguage,
  playingSavedDialog,
  wordActionStatus,
  phraseActionStatus,
  phraseActionError,
  onPlaySavedDialog,
  onPlayTurnAudio,
  onOpenItem,
  onTokenClick,
  onSavePhrase,
}: {
  savedDialogId: number | null;
  savedDialogTurns: SavedTurn[];
  sourceLanguage: string;
  targetLanguage: string;
  playingSavedDialog: boolean;
  wordActionStatus: Record<string, "idle" | "saving" | "added" | "exists" | "error">;
  phraseActionStatus: Record<string, "idle" | "saving" | "added" | "exists" | "error">;
  phraseActionError: Record<string, string>;
  onPlaySavedDialog: () => void;
  onPlayTurnAudio: (audioUrl?: string) => void;
  onOpenItem: (itemId: number) => Promise<void>;
  onTokenClick: (statusKey: string, token: string, turnIndex: number, sourceText: string, targetText: string) => void;
  onSavePhrase: (turn: SavedTurn, turnIndex: number) => Promise<void>;
}): JSX.Element {
  const { t } = useI18n();
  const [open, setOpen] = useState<boolean>(false);

  const wholeTurnPhraseKey = (turnIndex: number): string => `saved-${turnIndex}-whole-phrase`;

  return (
    <section className="card content-create-card">
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
              <button type="button" className="secondary-button" onClick={onPlaySavedDialog} disabled={playingSavedDialog}>
                {playingSavedDialog ? t("dialogs.nowPlaying") : t("dialogs.playDialog")}
              </button>
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
            renderLeadingAction={(turn) => turn.phrase_audio_url ? (
              <button
                type="button"
                className="secondary-button exercise-action-icon-button dialog-inline-action-button"
                onClick={() => onPlayTurnAudio(turn.phrase_audio_url)}
                aria-label={t("newItem.playTurnAudio")}
                title={t("newItem.playTurnAudio")}
              >
                <DialogActionIcon name="play" />
              </button>
            ) : null}
            renderTurnActions={(turn, index) => {
              const phraseKey = wholeTurnPhraseKey(index);
              return (
                <>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => void onSavePhrase(turn, index)}
                    disabled={!savedDialogId || phraseActionStatus[phraseKey] === "saving"}
                  >
                    {phraseActionStatus[phraseKey] === "saving"
                      ? t("newItem.sentenceAddSaving")
                      : t("content.preview.savePhrase")}
                  </button>
                  {phraseActionStatus[phraseKey] === "added" && (
                    <span className="turn-token-status">{t("newItem.sentenceAddAdded")}</span>
                  )}
                  {phraseActionStatus[phraseKey] === "exists" && (
                    <span className="turn-token-status">{t("newItem.sentenceAddExists")}</span>
                  )}
                  {phraseActionStatus[phraseKey] === "error" && (
                    <span className="turn-token-status">
                      {phraseActionError[phraseKey] || t("newItem.sentenceAddError")}
                    </span>
                  )}
                </>
              );
            }}
          />
        </div>
      )}
    </section>
  );
}
