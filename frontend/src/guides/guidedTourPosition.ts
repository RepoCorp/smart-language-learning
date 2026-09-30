export type GuideTargetRect = Pick<DOMRect, "top" | "left" | "width" | "height" | "bottom">;

export type GuideViewport = { top: number; left: number; width: number; height: number };

export function compactGuidePosition(target: GuideTargetRect | null, viewport: GuideViewport) {
  const margin = 12;
  const gap = 14;
  const top = viewport.top + margin;
  const bottom = viewport.top + viewport.height - margin;
  const above = target ? Math.max(0, Math.min(bottom, target.top - gap) - top) : 0;
  const below = target ? Math.max(0, bottom - Math.max(top, target.bottom + gap)) : bottom - top;
  const placeAbove = above > below;
  const available = Math.max(above, below);
  const cap = Math.min(viewport.height * 0.45, viewport.height - margin * 2);
  const compact = Boolean(target) && Math.min(available, cap) < 120;
  // A learner can reopen a minimized card to read it, then minimize it to act.
  const maxHeight = Math.max(0, compact ? cap : Math.min(available, cap));
  const cardTop = placeAbove ? top : bottom - maxHeight;
  return {
    compact,
    style: {
      top: cardTop, left: viewport.left + margin,
      width: Math.max(0, viewport.width - margin * 2), maxHeight,
    },
    toggleStyle: {
      top: placeAbove ? top : bottom - 44,
      left: viewport.left + viewport.width - margin - 44,
    },
  };
}

export function guidePopoverPosition({
  target, stepId, height, viewportWidth, viewportHeight,
}: {
  target: GuideTargetRect | null;
  stepId: string;
  height: number;
  viewportWidth: number;
  viewportHeight: number;
}) {
  const clearTarget = [
    "save-dialog", "save-word", "save-phrase", "conversation-goal",
    "conversation-start", "conversation-ready",
  ].includes(stepId);
  const menu = ["open-menu", "open-session", "conversation-open-menu"].includes(stepId);
  let createDialogTop: number | undefined;
  if (target && stepId === "create-dialog" && viewportWidth > 640) {
    const below = target.bottom + 14;
    const above = target.top - height - 14;
    createDialogTop = below + height <= viewportHeight - 16 || above < 16 ? below : above;
  }
  const style = target ? {
    top: createDialogTop ?? (clearTarget ? 16
      : menu && viewportWidth > 640 ? Math.max(16, target.top - 4)
        : Math.min(target.bottom + 14, viewportHeight - 228)),
    left: clearTarget ? 16
      : menu && viewportWidth > 640 ? Math.max(16, target.left - 334)
        : Math.max(16, Math.min(target.left, viewportWidth - 336)),
  } : undefined;
  return { style, clearTarget, menu };
}
