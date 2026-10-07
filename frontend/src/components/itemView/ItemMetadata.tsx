import type { ReactElement, ReactNode } from "react";

type ContentProps = { children: ReactNode };
type FieldProps = ContentProps & { label: string };

export function ItemMetadata({ children }: ContentProps): ReactElement {
  return <div className="item-view-meta-grid">{children}</div>;
}

export function ItemMetadataField({ label, children }: FieldProps): ReactElement {
  return <div className="item-view-meta-card">
    <span className="item-view-meta-label">{label}</span>
    {children}
  </div>;
}

export function ItemType({ label, children, description }: FieldProps & { description?: ReactNode }): ReactElement {
  return <ItemMetadataField label={label}>
    <strong className="item-view-meta-value">{children}</strong>
    {description}
  </ItemMetadataField>;
}

export function ItemTypeDescription({ children }: ContentProps): ReactElement {
  return <p className="item-view-type-description">{children}</p>;
}

export function ItemNotes({ label, children }: FieldProps): ReactElement {
  return <ItemMetadataField label={label}>
    <strong className="item-view-meta-value item-view-meta-value-notes">{children}</strong>
  </ItemMetadataField>;
}
