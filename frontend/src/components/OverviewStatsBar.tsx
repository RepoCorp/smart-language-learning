import { useEffect, useState } from "react";

import { fetchOverviewStats, getOverviewStatsUpdatedEventName } from "../api";
import type { OverviewStatsResponse } from "../types";

export default function OverviewStatsBar(): JSX.Element {
  const [stats, setStats] = useState<OverviewStatsResponse | null>(null);

  useEffect(() => {
    let mounted = true;
    const updateEvent = getOverviewStatsUpdatedEventName();

    const load = async (): Promise<void> => {
      try {
        const data = await fetchOverviewStats();
        if (mounted) {
          setStats(data);
        }
      } catch {
        if (mounted) {
          setStats(null);
        }
      }
    };

    void load();
    const onStatsUpdated = (): void => {
      void load();
    };
    window.addEventListener(updateEvent, onStatsUpdated);

    return () => {
      mounted = false;
      window.removeEventListener(updateEvent, onStatsUpdated);
    };
  }, []);

  return (
    <header className="overview-stats">
      <div className="overview-stats-content">
        <span>Ready to review: {stats?.ready_to_review ?? "-"}</span>
        <span>Future reviews: {stats?.future_reviews ?? "-"}</span>
        <span>Not started: {stats?.not_started ?? "-"}</span>
      </div>
    </header>
  );
}
