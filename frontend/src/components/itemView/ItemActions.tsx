import { useRef, type PointerEvent, type ReactElement } from "react";
import type { ItemActionsProps } from "./actions";

export default function ItemActions({ groups, showMobileActionLabels = false, onShowTooltip, onHideTooltip }: ItemActionsProps): ReactElement | null {
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const didHorizontalScroll = useRef(false);
  const visibleGroups = groups.filter(group => group.actions.length > 0);

  const startGesture = (event: PointerEvent<HTMLDivElement>): void => {
    pointerStart.current = { x: event.clientX, y: event.clientY };
    didHorizontalScroll.current = false;
  };
  const trackGesture = (event: PointerEvent<HTMLDivElement>): void => {
    if (!pointerStart.current) return;
    const horizontal = Math.abs(event.clientX - pointerStart.current.x);
    const vertical = Math.abs(event.clientY - pointerStart.current.y);
    if (horizontal > 8 && horizontal > vertical) didHorizontalScroll.current = true;
  };

  if (!visibleGroups.length) return null;
  return <div className={showMobileActionLabels ? "mobile-action-labels-expanded" : undefined}>
    <div className="actions item-actions-toolbar"
      onPointerDown={startGesture} onPointerMove={trackGesture}
      onPointerUp={() => { pointerStart.current = null; }}
      onPointerCancel={() => { pointerStart.current = null; }}
      onClickCapture={event => {
        if (!didHorizontalScroll.current) return;
        event.preventDefault();
        event.stopPropagation();
        didHorizontalScroll.current = false;
      }}
    >
      {visibleGroups.map(group => <div key={group.id} aria-label={group.label}
        className={`item-action-group${group.tone ? ` item-action-group-${group.tone}` : ""}`}>
        {group.actions.map(action => <button key={action.id} type="button"
          className={`secondary-button item-action-button item-action-button-icon${group.tone === "primary" ? " item-action-button-primary" : ""}${action.hasContent ? " item-action-button-has-content" : ""}`}
          onClick={action.onClick} disabled={action.disabled}
          aria-label={action.label} title={action.label} data-mobile-label={action.label}
          onPointerEnter={event => onShowTooltip?.(event, action.label)} onPointerLeave={onHideTooltip}
          onFocus={event => onShowTooltip?.(event, action.label)} onBlur={onHideTooltip}
        >{action.icon}</button>)}
      </div>)}
    </div>
  </div>;
}
