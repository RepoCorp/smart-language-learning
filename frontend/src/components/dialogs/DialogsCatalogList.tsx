import type { ReactNode } from "react";

import { useI18n } from "../../i18n";
import type { ContentDialogRecord, StudyLanguageCode } from "../../types";
import DialogActionIcon from "../DialogActionIcon";
import DialogTurnsList from "../DialogTurnsList";
import type { DialogTurnAudioMode } from "./useDialogTurnPlayback";

type WordActionStatus = "idle" | "saving" | "added" | "exists" | "error";
type PlayingTurn = { dialogId: number; turnIndex: number };
type DialogTurn = NonNullable<ContentDialogRecord["turns"]>[number];

type CatalogState = {
  activeDialogId: number | null;
  dialogs: ContentDialogRecord[];
  error: string;
  hasMore: boolean;
  hideTargetText: boolean;
  loading: boolean;
  loadingDialogId: number | null;
  loadingTurnAudioKey: string;
  page: number;
  playingAll: boolean;
  playingDialogId: number | null;
  playingTurn: PlayingTurn | null;
  phraseActionError: Record<string, string>;
  phraseActionStatus: Record<string, WordActionStatus>;
  sourceLanguage: StudyLanguageCode;
  targetLanguage: StudyLanguageCode;
  turnAudioMode: DialogTurnAudioMode;
  wordActionStatus: Record<string, WordActionStatus>;
};

type CatalogActions = {
  addWholeTurnPhrase: (dialogId: number, turn: DialogTurn, turnIndex: number) => void;
  activateDialog: (dialogId: number) => void;
  getTurnRef: (dialogId: number, turnIndex: number, element: HTMLLIElement | null) => void;
  onNextPage: () => void;
  onOpenItem: (itemId: number) => void;
  onPreviousPage: () => void;
  onTokenClick: (dialogId: number, statusKey: string, token: string, turnIndex: number, sourceText: string, targetText: string) => void;
  playTurn: (dialogId: number, turnIndex: number, audioUrl: string, mode: DialogTurnAudioMode) => void;
  registerDialogRef: (dialogId: number, element: HTMLLIElement | null) => void;
  renderDialogActionButtons: (dialog: ContentDialogRecord) => ReactNode;
  wholeTurnPhraseKey: (dialogId: number, turnIndex: number) => string;
};

type Props = {
  state: CatalogState;
  actions: CatalogActions;
};

export default function DialogsCatalogList({ state, actions }: Props): JSX.Element {
  const { t } = useI18n();
  const activeDialog = state.activeDialogId === null
    ? null
    : state.dialogs.find((dialog) => dialog.dialog_id === state.activeDialogId) || null;

  return (
    <div>
      {activeDialog && (
        <section className="card dialog-global-controls-card">
          <div className="dialog-global-controls-header">
            <strong className="dialog-list-topic">{activeDialog.topic}</strong>
            <span className="dialog-list-context">{activeDialog.context || t("dialogs.noContext")}</span>
            {state.playingDialogId === activeDialog.dialog_id && <span className="manage-item-meta">{t("dialogs.nowPlaying")}</span>}
          </div>
          <div className="dialog-list-controls dialog-global-controls-row">
            {actions.renderDialogActionButtons(activeDialog)}
          </div>
        </section>
      )}
      {state.loading && <p className="hint">{t("dialogs.loading")}</p>}
      {state.error && <p className="error">{state.error}</p>}
      {!state.loading && !state.error && state.dialogs.length === 0 && <p className="hint">{t("dialogs.empty")}</p>}
      {!state.loading && state.dialogs.length > 0 && (
        <section className="card">
          <ul className="manage-list">
            {state.dialogs.map((dialog, index) => {
              const expanded = state.activeDialogId === dialog.dialog_id;
              return (
                <li
                  key={dialog.dialog_id}
                  ref={(element) => actions.registerDialogRef(dialog.dialog_id, element)}
                  className={`related-dialog-card dialog-list-card ${state.playingDialogId === dialog.dialog_id ? "dialog-list-card-playing" : ""}`}
                  tabIndex={-1}
                >
                  <div className="dialog-list-row">
                    <button
                      type="button"
                      className="dialog-list-main dialog-list-main-trigger"
                      onClick={() => actions.activateDialog(dialog.dialog_id)}
                      disabled={state.loadingDialogId === dialog.dialog_id}
                      aria-expanded={expanded}
                    >
                      <strong className="dialog-list-topic">
                        <span className="dialog-list-position" aria-hidden="true">{index + 1}. </span>
                        {dialog.topic}
                      </strong>
                      <span className="dialog-list-context">{dialog.context || t("dialogs.noContext")}</span>
                      {state.playingAll && state.playingDialogId === dialog.dialog_id && <span className="manage-item-meta">{t("dialogs.nowPlaying")}</span>}
                    </button>
                  </div>
                  {expanded && !!dialog.turns?.length && (
                    <>
                      <p><strong>{t("newItem.dialogTurns")}:</strong></p>
                      <DialogTurnsList
                        dialogId={dialog.dialog_id}
                        turns={dialog.turns}
                        sourceLanguage={state.sourceLanguage}
                        targetLanguage={state.targetLanguage}
                        hideTargetText={state.hideTargetText}
                        tokenStatus={state.wordActionStatus}
                        statusKeyPrefixBase="dialog"
                        onOpenItem={actions.onOpenItem}
                        onTokenClick={(statusKey, token, turnIndex, sourceText, targetText) => actions.onTokenClick(dialog.dialog_id, statusKey, token, turnIndex, sourceText, targetText)}
                        getTurnRef={(turnIndex, element) => actions.getTurnRef(dialog.dialog_id, turnIndex, element)}
                        highlightedTurnIndex={state.playingTurn?.dialogId === dialog.dialog_id ? state.playingTurn.turnIndex : null}
                        renderLeadingAction={(turn, index) => (
                          <button
                            type="button"
                            className="secondary-button exercise-action-icon-button dialog-inline-action-button"
                            onClick={() => actions.playTurn(
                              dialog.dialog_id,
                              index,
                              state.turnAudioMode === "clear" ? turn.clear_audio_url || "" : turn.phrase_audio_url || "",
                              state.turnAudioMode,
                            )}
                            disabled={state.loadingTurnAudioKey === `${state.turnAudioMode}:${dialog.dialog_id}:${index}`}
                            aria-label={state.loadingTurnAudioKey === `${state.turnAudioMode}:${dialog.dialog_id}:${index}` ? t("dialogs.loading") : t("newItem.playTurnAudio")}
                            title={state.loadingTurnAudioKey === `${state.turnAudioMode}:${dialog.dialog_id}:${index}` ? t("dialogs.loading") : t("newItem.playTurnAudio")}
                          >
                            <DialogActionIcon name="play" />
                          </button>
                        )}
                        getWholePhraseSaveAction={(turn, index) => {
                          const phraseKey = actions.wholeTurnPhraseKey(dialog.dialog_id, index);
                          return {
                            onSave: () => actions.addWholeTurnPhrase(dialog.dialog_id, turn, index),
                            status: state.phraseActionStatus[phraseKey] || "idle",
                            error: state.phraseActionError[phraseKey] || "",
                          };
                        }}
                      />
                      <div className="actions">
                        <button type="button" className="secondary-button" onClick={() => actions.activateDialog(dialog.dialog_id)}>
                          {t("dialogs.hideDialog")}
                        </button>
                      </div>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
          <div className="actions">
            <button type="button" className="secondary-button" onClick={actions.onPreviousPage} disabled={state.page <= 1 || state.loading}>
              {t("dialogs.previousPage")}
            </button>
            <span>{t("dialogs.pageLabel", { page: state.page })}</span>
            <button type="button" className="secondary-button" onClick={actions.onNextPage} disabled={!state.hasMore || state.loading}>
              {t("dialogs.nextPage")}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
