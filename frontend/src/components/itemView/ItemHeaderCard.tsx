import type { ReactElement, ReactNode } from "react";
import "./ItemHeaderCard.css";

export default function ItemHeaderCard({ children }: {
  children: ReactNode;
}): ReactElement {
  return <section className="item-view-header-card">
    {children}
  </section>;
}
