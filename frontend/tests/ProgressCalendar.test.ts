import { describe, expect, it } from "vitest";

import { buildCalendarDays } from "../src/features/progress/ProgressCalendar";

describe("buildCalendarDays", () => {
  it("lays out a complete 31-day month and preserves daily statuses", () => {
    const days = buildCalendarDays([
      { date: "2026-01-01", status: "studied" },
      { date: "2026-01-30", status: "flex" },
      { date: "2026-01-31", status: "paused" },
    ]);
    const populatedDays = days.filter((day) => day !== null);

    expect(populatedDays).toHaveLength(31);
    expect(populatedDays[0]).toMatchObject({ date: "2026-01-01", status: "studied" });
    expect(populatedDays[29]).toMatchObject({ date: "2026-01-30", status: "flex" });
    expect(populatedDays[30]).toMatchObject({ date: "2026-01-31", status: "paused", isToday: true });
  });

  it("adds leading empty cells so dates line up with their weekday", () => {
    const days = buildCalendarDays([{ date: "2026-09-13", status: "pending" }]);

    expect(days.slice(0, 2)).toEqual([null, null]);
    expect(days[2]).toMatchObject({ date: "2026-09-01", dayOfMonth: 1 });
  });
});
