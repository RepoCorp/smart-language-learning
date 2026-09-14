import { useMemo } from "react";

import { useI18n, type AppLanguage, type MessageKey } from "../../i18n";
import type { LearningProgressResponse } from "../../types";

type DayStatus = LearningProgressResponse["history"][number]["status"];

type CalendarDay = {
  date: string;
  dayOfMonth: number;
  status: DayStatus | null;
  isToday: boolean;
};

function dateFromIso(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function buildCalendarDays(history: LearningProgressResponse["history"]): Array<CalendarDay | null> {
  const today = history.length ? history[history.length - 1].date : toIsoDate(new Date());
  const todayDate = dateFromIso(today);
  const statusByDate = new Map(history.map((entry) => [entry.date, entry.status]));
  const monthStart = new Date(todayDate.getFullYear(), todayDate.getMonth(), 1);
  const calendarDays: Array<CalendarDay | null> = Array.from({ length: monthStart.getDay() }, () => null);
  const daysInMonth = new Date(todayDate.getFullYear(), todayDate.getMonth() + 1, 0).getDate();

  for (let dayOfMonth = 1; dayOfMonth <= daysInMonth; dayOfMonth += 1) {
    const date = new Date(todayDate.getFullYear(), todayDate.getMonth(), dayOfMonth);
    const isoDate = toIsoDate(date);
    calendarDays.push({
      date: isoDate,
      dayOfMonth,
      status: statusByDate.get(isoDate) || null,
      isToday: isoDate === today,
    });
  }

  return calendarDays;
}

function localeFor(language: AppLanguage): string {
  return language === "es" ? "es-CO" : "en-US";
}

const STATUS_MESSAGE_KEY: Record<DayStatus, MessageKey> = {
  studied: "progress.calendarStudied",
  flex: "progress.calendarFlex",
  paused: "progress.calendarPaused",
  pending: "progress.calendarPending",
  missed: "progress.calendarMissed",
};

export default function ProgressCalendar({
  history,
  onPreviousMonth,
  onNextMonth,
  canViewNextMonth,
  loading,
}: {
  history: LearningProgressResponse["history"];
  onPreviousMonth: () => void;
  onNextMonth: () => void;
  canViewNextMonth: boolean;
  loading: boolean;
}): JSX.Element {
  const { language, t } = useI18n();
  const locale = localeFor(language);
  const calendarDays = useMemo(() => buildCalendarDays(history), [history]);
  const today = history.length ? dateFromIso(history[history.length - 1].date) : new Date();
  const weekdayLabels = Array.from({ length: 7 }, (_, index) => (
    new Intl.DateTimeFormat(locale, { weekday: "short" }).format(new Date(2023, 0, index + 1))
  ));
  const monthLabel = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(today);

  return (
    <section className="card progress-calendar-card">
      <div className="progress-calendar-heading">
        <h2>{t("progress.calendarTitle")}</h2>
        <div className="progress-calendar-month-controls">
          <button type="button" onClick={onPreviousMonth} disabled={loading} aria-label={t("progress.calendarPreviousMonth")}>‹</button>
          <span>{monthLabel}</span>
          <button type="button" onClick={onNextMonth} disabled={loading || !canViewNextMonth} aria-label={t("progress.calendarNextMonth")}>›</button>
        </div>
      </div>
      <div className="progress-calendar" role="grid" aria-label={t("progress.calendarTitle")}>
        {weekdayLabels.map((label, index) => <span className="progress-calendar-weekday" role="columnheader" key={`${label}-${index}`}>{label}</span>)}
        {calendarDays.map((day, index) => (
          day ? (
            <span
              className={`progress-calendar-day${day.status ? ` progress-calendar-${day.status}` : ""}${day.isToday ? " progress-calendar-today" : ""}`}
              role="gridcell"
              key={day.date}
              aria-label={`${day.date}: ${day.status ? t(STATUS_MESSAGE_KEY[day.status]) : t("progress.calendarNoActivity")}`}
            >
              <span>{day.dayOfMonth}</span>
              {day.status ? <i aria-hidden="true" /> : null}
            </span>
          ) : <span className="progress-calendar-empty" aria-hidden="true" key={`empty-${index}`} />
        ))}
      </div>
      <div className="progress-calendar-legend" aria-label={t("progress.historyLegend")}>
        <span><i className="progress-calendar-studied" />{t("progress.calendarStudied")}</span>
        <span><i className="progress-calendar-flex" />{t("progress.calendarFlex")}</span>
        <span><i className="progress-calendar-paused" />{t("progress.calendarPaused")}</span>
      </div>
    </section>
  );
}
