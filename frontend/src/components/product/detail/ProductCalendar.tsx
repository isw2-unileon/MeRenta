import { useEffect, useState } from "react";

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

const WEEKDAY_LABELS = ["L", "M", "X", "J", "V", "S", "D"] as const;

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

/** Returns true when two Date objects refer to the same calendar day. */
function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** Returns true when date falls strictly between start and end. */
function isInRange(date: Date, start: Date | null, end: Date | null): boolean {
  if (!start || !end) return false;
  return date > start && date < end;
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
 * @returns Calendar JSX.
 */
function ProductCalendar({
  occupiedDates,
  selectedStart,
  selectedEnd,
  onDateSelect,
  navigateTo,
}: ProductCalendarProps) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [viewMonth, setViewMonth] = useState<Date>(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  });

  // Navigate the calendar view when a date is selected from the booking card inputs
  useEffect(() => {
    if (!navigateTo) return;
    setViewMonth(new Date(navigateTo.getFullYear(), navigateTo.getMonth(), 1));
  }, [navigateTo]);

  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();

  /** Monday-first offset: Mon=0 … Sun=6 */
  const firstDayOffset = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  /** Flat array of day numbers with leading nulls for empty cells. */
  const cells: (number | null)[] = [
    ...Array.from<null>({ length: firstDayOffset }).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  // Pad to a complete 7-column grid
  while (cells.length % 7 !== 0) cells.push(null);

  const handleDayClick = (day: number) => {
    const date = new Date(year, month, day);
    date.setHours(0, 0, 0, 0);
    if (date < today || occupiedDates.has(toISODate(date))) return;
    onDateSelect(date);
  };

  const canGoPrev = year > today.getFullYear() || month > today.getMonth();

  return (
    <div>
      <p className="calendar-hint mb-3">Los días en gris están ocupados</p>

      <div className="border-border-main bg-surface rounded-xl border p-4">
        {/* Month navigation */}
        <div className="mb-3 flex items-center justify-between">
          <button
            type="button"
            className="btn-ghost btn--sm"
            onClick={() => setViewMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
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
            onClick={() => setViewMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
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
          {cells.map((day, i) => {
            if (!day) {
              return <div key={`empty-${i}`} />;
            }

            const date = new Date(year, month, day);
            date.setHours(0, 0, 0, 0);

            const isPast = date < today;
            const isOccupied = occupiedDates.has(toISODate(date)) || isPast;
            const isStart = selectedStart !== null && isSameDay(date, selectedStart);
            const isEnd = selectedEnd !== null && isSameDay(date, selectedEnd);
            const isSelected = isStart || isEnd;
            const inRange = isInRange(date, selectedStart, selectedEnd);

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
                key={`day-${day}`}
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
