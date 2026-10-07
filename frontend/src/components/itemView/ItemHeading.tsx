import type { ReactElement, ReactNode } from "react";

type ContentProps = { children: ReactNode };

export function ItemHeading({ children }: ContentProps): ReactElement {
  return <div className="item-view-title-row">
    <div className="item-view-title-block">{children}</div>
  </div>;
}

export function ItemTitle({ children }: ContentProps): ReactElement {
  return <h2 className="item-view-title">{children}</h2>;
}

export function ItemSubtitle({ children }: ContentProps): ReactElement {
  return <p className="item-view-subtitle">{children}</p>;
}
