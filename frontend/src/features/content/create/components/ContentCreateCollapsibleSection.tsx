import type { ReactNode } from "react";

interface ContentCreateCollapsibleSectionProps {
  title: string;
  subtitle?: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
  accent?: "neutral" | "required";
}

export default function ContentCreateCollapsibleSection({
  title,
  subtitle,
  open,
  onToggle,
  children,
  accent = "neutral",
}: ContentCreateCollapsibleSectionProps): JSX.Element {
  return (
    <section
      className={`content-collapsible-section content-collapsible-section-${accent}${open ? " content-collapsible-section-open" : ""}`}
    >
      <button
        type="button"
        className="content-collapsible-trigger"
        aria-expanded={open}
        onClick={onToggle}
      >
        <span className="content-collapsible-trigger-copy">
          <strong>{title}</strong>
          {!!subtitle && <span className="content-collapsible-trigger-subtitle">{subtitle}</span>}
        </span>
        <span className={`content-collapsible-trigger-icon${open ? " content-collapsible-trigger-icon-open" : ""}`} aria-hidden="true">▾</span>
      </button>
      {open && <div className="content-collapsible-body">{children}</div>}
    </section>
  );
}
