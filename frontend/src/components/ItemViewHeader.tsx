import type { ReactElement, ReactNode } from "react";
import ItemHeaderCard from "./itemView/ItemHeaderCard";

export default function ItemViewHeader({ children, audio }: {
  children: ReactNode;
  audio?: { url: string; unavailableLabel: string };
}): ReactElement {
  return <>
    <ItemHeaderCard>{children}</ItemHeaderCard>
    {audio?.url && <div className="item-view-audio-wrap">
      <audio controls src={audio.url}>{audio.unavailableLabel}</audio>
    </div>}
  </>;
}
