import { useEffect, useState } from "react";
import type { GuideViewport } from "./guidedTourPosition";

function readViewport(): GuideViewport {
  const viewport = window.visualViewport;
  return {
    top: viewport?.offsetTop ?? 0, left: viewport?.offsetLeft ?? 0,
    width: viewport?.width ?? window.innerWidth,
    height: viewport?.height ?? window.innerHeight,
  };
}

export function useGuideViewport(open: boolean): GuideViewport {
  const [viewport, setViewport] = useState(readViewport);
  useEffect(() => {
    if (!open) return;
    const update = () => setViewport(readViewport());
    update();
    window.addEventListener("resize", update);
    window.visualViewport?.addEventListener("resize", update);
    window.visualViewport?.addEventListener("scroll", update);
    return () => {
      window.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("scroll", update);
    };
  }, [open]);
  return viewport;
}
