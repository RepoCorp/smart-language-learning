import type { JSX, ReactNode } from "react";

import StrategyLoopPanel from "./StrategyLoopPanel";

type Selection = {
  canSelectEntries: boolean;
  hasSelectedEntries: boolean;
  onUnselectAll: () => void;
  onSelectAll: () => void;
  onSelectRandom: () => void;
};

export default function StrategyLoopContent({
  secondsLeft,
  isRunning,
  isMuted,
  canStart,
  onStart,
  onStop,
  onToggleMute,
  canRegenerateContent,
  regeneratingContent,
  onRegenerateContent,
  selection,
  body,
  additionalDangerAction,
}: {
  secondsLeft: number;
  isRunning: boolean;
  isMuted: boolean;
  canStart: boolean;
  onStart: () => void;
  onStop: () => void;
  onToggleMute: () => void;
  canRegenerateContent: boolean;
  regeneratingContent: boolean;
  onRegenerateContent: () => void;
  selection: Selection;
  body: JSX.Element;
  additionalDangerAction?: ReactNode;
}): JSX.Element {
  return (
    <StrategyLoopPanel
      secondsLeft={secondsLeft}
      isRunning={isRunning}
      isMuted={isMuted}
      canStart={canStart}
      canSelectEntries={selection.canSelectEntries}
      hasSelectedEntries={selection.hasSelectedEntries}
      onUnselectAll={selection.onUnselectAll}
      onSelectAll={selection.onSelectAll}
      onSelectRandom={selection.onSelectRandom}
      onStart={onStart}
      onStop={onStop}
      onToggleMute={onToggleMute}
      canRegenerateContent={canRegenerateContent}
      regeneratingContent={regeneratingContent}
      onRegenerateContent={onRegenerateContent}
      additionalDangerAction={additionalDangerAction}
      body={body}
    />
  );
}
