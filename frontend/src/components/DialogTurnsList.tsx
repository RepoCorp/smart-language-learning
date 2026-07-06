import type { ReactNode } from "react";

import { useI18n } from "../i18n";
import type { ContentDialogRecord, StudyLanguageCode } from "../types";
import DialogTurnText from "./DialogTurnText";

type DialogTurnRecord = ContentDialogRecord["turns"][number];
type WordActionStatus = "idle" | "saving" | "added" | "exists" | "error";

interface DialogTurnsListProps {
  dialogId: number;
  turns: DialogTurnRecord[];
  sourceLanguage: StudyLanguageCode;
  targetLanguage: StudyLanguageCode;
  hideTargetText?: boolean;
  tokenStatus?: Record<string, WordActionStatus>;
  statusKeyPrefixBase?: string;
  onOpenItem?: (itemId: number) => Promise<void>;
  onTokenClick?: (
    statusKey: string,
    token: string,
    turnIndex: number,
    sourceText: string,
    targetText: string,
  ) => void;
  renderLeadingAction?: (turn: DialogTurnRecord, turnIndex: number) => ReactNode;
  renderTurnActions?: (turn: DialogTurnRecord, turnIndex: number) => ReactNode;
  getTurnRef?: (turnIndex: number, element: HTMLLIElement | null) => void;
  highlightedTurnIndex?: number | null;
  highlightedTurnIndexes?: Iterable<number>;
}

const speakerForTurn = (speaker: string | undefined, index: number): "a" | "b" =>
  speaker === "a" || speaker === "b" ? speaker : (index % 2 === 0 ? "a" : "b");

export default function DialogTurnsList({
  dialogId,
  turns,
  sourceLanguage,
  targetLanguage,
  hideTargetText = false,
  tokenStatus = {},
  statusKeyPrefixBase = "dialog",
  onOpenItem,
  onTokenClick,
  renderLeadingAction,
  renderTurnActions,
  getTurnRef,
  highlightedTurnIndex = null,
  highlightedTurnIndexes,
}: DialogTurnsListProps): JSX.Element {
  const { t } = useI18n();
  const highlightedTurnIndexSet = highlightedTurnIndexes ? new Set(highlightedTurnIndexes) : null;

  return (
    <ul className="conversation-preview-list">
      {turns.map((turn, index) => {
        const speaker = speakerForTurn(turn.speaker, index);
        const isMatchedHighlight = highlightedTurnIndexSet?.has(index) || false;
        const isActiveHighlight = highlightedTurnIndex === index;
        return (
          <li
            key={`${dialogId}-turn-${index}`}
            ref={(element) => getTurnRef?.(index, element)}
            className={`conversation-turn ${speaker === "a" ? "speaker-a" : "speaker-b"} ${isMatchedHighlight ? "turn-highlight" : ""} ${isActiveHighlight ? "turn-active-highlight" : ""}`}
            tabIndex={-1}
          >
            <p className="conversation-speaker">
              {speaker === "a" ? t("content.preview.personA") : t("content.preview.personB")}
            </p>
            <div className="conversation-line conversation-line-translation">
              <DialogTurnText
                dialogId={dialogId}
                turnIndex={index}
                sourceText={turn.source_text}
                targetText={turn.target_text}
                sourceLanguage={sourceLanguage}
                targetLanguage={targetLanguage}
                tokenStatus={tokenStatus}
                statusKeyPrefix={`${statusKeyPrefixBase}-${dialogId}-turn-${index}-target`}
                hideTargetText={hideTargetText}
                onOpenItem={onOpenItem}
                onTokenClick={(statusKey, token) => onTokenClick?.(statusKey, token, index, turn.source_text, turn.target_text)}
                leadingAction={renderLeadingAction?.(turn, index)}
                extraActions={renderTurnActions?.(turn, index)}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
