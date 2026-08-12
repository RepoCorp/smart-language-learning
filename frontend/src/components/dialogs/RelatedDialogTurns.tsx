import type { FocusEvent, PointerEvent } from "react";

import { useI18n } from "../../i18n";
import type { SessionItem, StudyLanguageCode } from "../../types";
import DialogActionIcon from "../DialogActionIcon";
import DialogTurnsList from "../DialogTurnsList";
import type { ActionStatus } from "../DialogTurnText";
import type { DialogTurnAudioMode } from "./useDialogTurnPlayback";

type RelatedDialog = NonNullable<SessionItem["related_dialogs"]>[number];
type RelatedTurn = RelatedDialog["turns"][number];

type Props = {
  dialog: RelatedDialog;
  sourceLanguage: StudyLanguageCode;
  targetLanguage: StudyLanguageCode;
  hideTargetText: boolean;
  turnAudioMode: DialogTurnAudioMode;
  playingDialogId: number | null;
  playingTurn: { dialogId: number; turnIndex: number } | null;
  loadingTurnAudioKey: string;
  matchedTurnIndexes: Iterable<number>;
  wordActionStatus: Record<string, ActionStatus>;
  phraseActionStatus: Record<string, ActionStatus>;
  phraseActionError: Record<string, string>;
  onOpenItem: (itemId: number) => void | Promise<void>;
  onTokenClick: (
    statusKey: string,
    token: string,
    turnIndex: number,
    sourceText: string,
    targetText: string,
  ) => void;
  onPlayTurn: (dialogId: number, turnIndex: number, audioUrl: string, mode: DialogTurnAudioMode) => void;
  onSaveWholeTurn: (dialogId: number, turn: RelatedTurn, turnIndex: number) => Promise<void>;
  wholeTurnPhraseKey: (dialogId: number, turnIndex: number) => string;
  onShowTooltip: (event: PointerEvent<HTMLButtonElement> | FocusEvent<HTMLButtonElement>, label: string) => void;
  onHideTooltip: () => void;
};

export default function RelatedDialogTurns({
  dialog,
  sourceLanguage,
  targetLanguage,
  hideTargetText,
  turnAudioMode,
  playingDialogId,
  playingTurn,
  loadingTurnAudioKey,
  matchedTurnIndexes,
  wordActionStatus,
  phraseActionStatus,
  phraseActionError,
  onOpenItem,
  onTokenClick,
  onPlayTurn,
  onSaveWholeTurn,
  wholeTurnPhraseKey,
  onShowTooltip,
  onHideTooltip,
}: Props): JSX.Element {
  const { t } = useI18n();

  return (
    <DialogTurnsList
      dialogId={dialog.dialog_id}
      turns={dialog.turns}
      sourceLanguage={sourceLanguage}
      targetLanguage={targetLanguage}
      hideTargetText={hideTargetText}
      tokenStatus={wordActionStatus}
      statusKeyPrefixBase="related"
      onOpenItem={onOpenItem}
      onTokenClick={(statusKey, token, turnIndex, sourceText, targetText) =>
        onTokenClick(statusKey, token, turnIndex, sourceText, targetText)
      }
      highlightedTurnIndex={
        playingTurn?.dialogId === dialog.dialog_id ? playingTurn.turnIndex : null
      }
      highlightedTurnIndexes={matchedTurnIndexes}
      renderLeadingAction={(turn, turnIndex) => {
        const isLoading = loadingTurnAudioKey === `${turnAudioMode}:${dialog.dialog_id}:${turnIndex}`;
        const label = isLoading ? t("dialogs.loading") : t("newItem.playTurnAudio");
        return (
          <button
            type="button"
            className="secondary-button exercise-action-icon-button dialog-inline-action-button"
            disabled={playingDialogId !== null || isLoading}
            onClick={() =>
              onPlayTurn(
                dialog.dialog_id,
                turnIndex,
                turnAudioMode === "clear" ? turn.clear_audio_url || "" : turn.phrase_audio_url || "",
                turnAudioMode,
              )
            }
            aria-label={label}
            title={label}
            onPointerEnter={(event) => onShowTooltip(event, label)}
            onPointerLeave={onHideTooltip}
            onFocus={(event) => onShowTooltip(event, label)}
            onBlur={onHideTooltip}
          >
            <DialogActionIcon name="play" />
          </button>
        );
      }}
      getWholePhraseSaveAction={(turn, turnIndex) => {
        const phraseKey = wholeTurnPhraseKey(dialog.dialog_id, turnIndex);
        return {
          onSave: () => onSaveWholeTurn(dialog.dialog_id, turn, turnIndex),
          status: phraseActionStatus[phraseKey] || "idle",
          error: phraseActionError[phraseKey] || "",
        };
      }}
    />
  );
}
