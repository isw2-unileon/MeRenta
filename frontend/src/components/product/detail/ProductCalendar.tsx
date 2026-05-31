import { useState, useSyncExternalStore } from "react";

interface ProductCalendarProps {
  /** Set of ISO date strings ("YYYY-MM-DD") that are already booked. */
  occupiedDates: Set<string>;
  /** Currently selected start date, or null if none. */
  selectedStart: Date | null;
  /** Currently selected end date, or null if none. */
  selectedEnd: Date | null;
  /** Callback fired when the user clicks an available day cell. */
  onDateSelect: (date: Date) => void;
  /**
   * When provided, the calendar navigates to the month of this date.
   * Used to sync the calendar view when dates are changed from the booking card.
   */
  navigateTo?: Date | null;
}

interface CalendarCell {
  key: string;
  day: number | null;
}

const WEEKDAY_LABELS = ["L", "M", "X", "J", "V", "S", "D"] as const;
const SERVER_TODAY_ISO = "1970-01-01";

const MONTH_NAMES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
] as const;

/** Formats a Date as "YYYY-MM-DD" without time zone conversion. */
function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getToday(): Date {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function getTodayISO(): string {
  return toISODate(getToday());
}

function subscribeToTodayChange(onStoreChange: () => void): () => void {
  const intervalId = window.setInterval(onStoreChange, 60_000);
  return () => window.clearInterval(intervalId);
}

function parseISODateParts(value: string): { year: number; month: number; day: number } {
  const [year = 1970, month = 1, day = 1] = value.split("-").map(Number);
  return { year, month: month - 1, day };
}

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function getDaysInMonth(year: number, month: number): number {
  if (month === 1) return isLeapYear(year) ? 29 : 28;
  return [0, 2, 4, 6, 7, 9, 11].includes(month) ? 31 : 30;
}

function getFirstDayOffset(year: number, month: number): number {
  const m = month < 2 ? month + 12 : month;
  const y = month < 2 ? year - 1 : year;
  const dayOfWeek =
    (1 + Math.floor((13 * (m + 1)) / 5) + y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400)) % 7;
  return (dayOfWeek + 5) % 7;
}

function isSameCalendarDay(year: number, month: number, day: number, date: Date | null): boolean {
  return date !== null && date.getFullYear() === year && date.getMonth() === month && date.getDate() === day;
}

/**
 * Interactive monthly calendar for selecting a rental date range.
 *
 * - Occupied dates (from the API) are shown greyed out and are not clickable.
 * - Past dates are also disabled.
 * - First click sets the start date; second click (on a later date) sets the end.
 * - Dates between start and end are highlighted at reduced opacity.
 * @param occupiedDates Set of "YYYY-MM-DD" strings representing booked days.
 * @param selectedStart Currently active start date.
 * @param selectedEnd Currently active end date.
 * @param onDateSelect Called with the clicked Date when the user taps a valid cell.
 * @param navigateTo Path to navigate
 * @returns Calendar JSX.
 */
function ProductCalendar({
  occupiedDates,
  selectedStart,
  selectedEnd,
  onDateSelect,
  navigateTo,
}: ProductCalendarProps) {
  const todayISO = useSyncExternalStore(subscribeToTodayChange, getTodayISO, () => SERVER_TODAY_ISO);
  const todayParts = parseISODateParts(todayISO);
  const [monthOffset, setMonthOffset] = useState(0);

  const anchorYear = navigateTo?.getFullYear() ?? todayParts.year;
  const anchorMonth = navigateTo?.getMonth() ?? todayParts.month;
  const viewMonthIndex = anchorYear * 12 + anchorMonth + monthOffset;
  const year = Math.floor(viewMonthIndex / 12);
  const month = ((viewMonthIndex % 12) + 12) % 12;

  /** Monday-first offset: Mon=0 … Sun=6 */
  const firstDayOffset = getFirstDayOffset(year, month);
  const daysInMonth = getDaysInMonth(year, month);

  /** Flat array of day numbers with leading nulls for empty cells. */
  const cells: CalendarCell[] = [
    ...Array.from({ length: firstDayOffset }, (_, index) => ({ key: `empty-start-${index + 1}`, day: null })),
    ...Array.from({ length: daysInMonth }, (_, index) => {
      const day = index + 1;
      return { key: `day-${day}`, day };
    }),
  ];
  // Pad to a complete 7-column grid
  while (cells.length % 7 !== 0) cells.push({ key: `empty-end-${cells.length}`, day: null });

  const handleDayClick = (day: number) => {
    const date = new Date(year, month, day);
    date.setHours(0, 0, 0, 0);
    const isoDate = toISODate(date);
    if (isoDate < todayISO || occupiedDates.has(isoDate)) return;
    onDateSelect(date);
  };

  const canGoPrev = year > todayParts.year || month > todayParts.month;

  return (
    <div>
      <p className="calendar-hint mb-3">Los días en gris están ocupados</p>

      <div className="border-border-main bg-surface rounded-xl border p-4">
        {/* Month navigation */}
        <div className="mb-3 flex items-center justify-between">
          <button
            type="button"
            className="btn-ghost btn--sm"
            onClick={() => setMonthOffset((prev) => prev - 1)}
            disabled={!canGoPrev}
            aria-label="Mes anterior"
          >
            ‹
          </button>
          <p className="calendar-month">
            {MONTH_NAMES[month]} {year}
          </p>
          <button
            type="button"
            className="btn-ghost btn--sm"
            onClick={() => setMonthOffset((prev) => prev + 1)}
            aria-label="Mes siguiente"
          >
            ›
          </button>
        </div>

        {/* Weekday header row */}
        <div className="mb-1 grid grid-cols-7">
          {WEEKDAY_LABELS.map((label) => (
            <div
              key={label}
              className="flex items-center justify-center py-1"
            >
              <p className="calendar-weekday">{label}</p>
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7 gap-y-0.5">
          {cells.map(({ key, day }) => {
            if (!day) {
              return <div key={key} />;
            }

            const isoDate = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const isPast = isoDate < todayISO;
            const isOccupied = occupiedDates.has(isoDate) || isPast;
            const isStart = isSameCalendarDay(year, month, day, selectedStart);
            const isEnd = isSameCalendarDay(year, month, day, selectedEnd);
            const isSelected = isStart || isEnd;
            const inRange =
              selectedStart !== null &&
              selectedEnd !== null &&
              isoDate > toISODate(selectedStart) &&
              isoDate < toISODate(selectedEnd);

            let cellClass = "calendar-day-cell p-0";
            let textClass = "calendar-day";

            if (isOccupied) {
              cellClass += " calendar-day-cell--occupied";
              textClass = "calendar-day--occupied";
            } else if (isSelected) {
              cellClass += " calendar-day-cell--selected";
              textClass = "calendar-day--selected";
            } else if (inRange) {
              cellClass += " calendar-day-cell--selected opacity-40";
              textClass = "calendar-day--selected";
            }

            return (
              <button
                key={key}
                type="button"
                className={cellClass}
                onClick={() => {
                  if (!isOccupied) handleDayClick(day);
                }}
                disabled={isOccupied}
                aria-label={`${day} de ${MONTH_NAMES[month]}`}
              >
                <p className={textClass}>{day}</p>
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="mt-3 flex items-center justify-end gap-4">
          <div className="flex items-center gap-1.5">
            <span className="calendar-legend-dot calendar-legend-dot--occupied" />
            <p className="calendar-legend">Ocupado</p>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="calendar-legend-dot calendar-legend-dot--selected" />
            <p className="calendar-legend">Seleccionado</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export { ProductCalendar };
