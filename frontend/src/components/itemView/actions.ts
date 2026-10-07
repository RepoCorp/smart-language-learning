import type { FocusEvent, PointerEvent, ReactNode } from "react";

export type ItemActionTooltipEvent = PointerEvent<HTMLButtonElement> | FocusEvent<HTMLButtonElement>;

export interface ItemAction {
  id: string;
  label: string;
  icon: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  hasContent?: boolean;
}

export interface ItemActionGroup {
  id: string;
  label: string;
  tone?: "primary" | "danger";
  actions: readonly ItemAction[];
}

export interface ItemActionsProps {
  groups: readonly ItemActionGroup[];
  showMobileActionLabels?: boolean;
  onShowTooltip?: (event: ItemActionTooltipEvent, label: string) => void;
  onHideTooltip?: () => void;
}
