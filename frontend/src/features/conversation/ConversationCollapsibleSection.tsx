import type { ReactNode } from "react";

export default function ConversationCollapsibleSection({
  title,
  subtitle,
  open,
  onToggle,
  accent = "neutral",
  disabled = false,
  guideTarget,
  children,
}: {
  title: string;
  subtitle?: string;
  open: boolean;
  onToggle: () => void;
  accent?: "neutral" | "required";
  disabled?: boolean;
  guideTarget?: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <section data-guide-target={guideTarget} className={`content-collapsible-section content-collapsible-section-${accent}${open ? " content-collapsible-section-open" : ""}`}>
      <button type="button" className="content-collapsible-trigger" aria-expanded={open} onClick={onToggle} disabled={disabled}>
        <span className="content-collapsible-trigger-copy conversation-setup-trigger-copy">
          <strong>{title}</strong>
          {!!subtitle && <span className="content-collapsible-trigger-subtitle conversation-setup-trigger-subtitle">{subtitle}</span>}
        </span>
        <span className={`content-collapsible-trigger-icon${open ? " content-collapsible-trigger-icon-open" : ""}`} aria-hidden="true">▾</span>
      </button>
      {open && <div className="content-collapsible-body">{children}</div>}
    </section>
  );
}
