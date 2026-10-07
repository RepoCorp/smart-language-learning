import type { ReactElement, ReactNode } from "react";
import "./ItemViewShell.css";

export default function ItemViewShell({ children, actions, onClose, closeLabel, className = "" }: {
  children: ReactNode;
  actions?: ReactNode;
  onClose?: () => void;
  closeLabel: string;
  className?: string;
}): ReactElement {
  return <div className={`item-view-shell${className ? ` ${className}` : ""}`}>
    {onClose && <button type="button" className="modal-corner-close" aria-label={closeLabel} onClick={onClose}>×</button>}
    {children}
    {actions}
  </div>;
}
