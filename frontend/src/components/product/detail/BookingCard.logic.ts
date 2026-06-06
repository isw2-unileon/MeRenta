// Pure helpers and reducer backing the product detail booking card: date math,
// price breakdown and availability checks.
import { insuranceDailyRate } from "@/components/product/insurance";

/** Fixed platform service fee (EUR) added to every booking. */
const SERVICE_FEE = 5;

/** UI state for the booking card (message/booking errors and calendar toggle). */
interface BookingCardFormState {
  messageLoading: boolean;
  messageError: string;
  bookingError: string;
  calendarOpen: boolean;
}

/** Reducer actions driving the booking card UI state. */
type BookingCardFormAction =
  | { type: "message:start" }
  | { type: "message:done" }
  | { type: "message:error"; error: string }
  | { type: "booking:error"; error: string }
  | { type: "booking:clear" }
  | { type: "calendar:toggle" }
  | { type: "calendar:close" };

/** Initial booking card UI state. */
const initialFormState: BookingCardFormState = {
  messageLoading: false,
  messageError: "",
  bookingError: "",
  calendarOpen: false,
};

/** Formats a Date as a local "YYYY-MM-DD" string (no timezone shift). */
function toISODateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Formats a Date as a short Spanish date (e.g. "5 jun 2026"). */
function formatDateEs(date: Date): string {
  return date.toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Formats a price with two decimals and a comma decimal separator. */
function fmtPrice(value: number): string {
  return value.toFixed(2).replace(".", ",");
}

/** Formats a rating value with two decimals. */
function formatRating(value: number): string {
  return value.toFixed(2);
}

/** Reduces booking card UI actions into the next state. */
function formReducer(state: BookingCardFormState, action: BookingCardFormAction): BookingCardFormState {
  switch (action.type) {
    case "message:start":
      return { ...state, messageLoading: true, messageError: "" };
    case "message:done":
      return { ...state, messageLoading: false };
    case "message:error":
      return { ...state, messageLoading: false, messageError: action.error };
    case "booking:error":
      return { ...state, bookingError: action.error };
    case "booking:clear":
      return { ...state, bookingError: "" };
    case "calendar:toggle":
      return { ...state, calendarOpen: !state.calendarOpen };
    case "calendar:close":
      return { ...state, calendarOpen: false };
    default:
      return state;
  }
}

/**
 * Reports whether any day in the [start, end] range falls on an occupied
 * (already-booked) date.
 */
function hasDateConflict(start: Date, end: Date, occupied: Set<string>): boolean {
  const cur = new Date(start);
  cur.setHours(0, 0, 0, 0);
  while (cur <= end) {
    if (occupied.has(toISODateStr(cur))) return true;
    cur.setDate(cur.getDate() + 1);
  }
  return false;
}

/** Returns the number of nights between two dates, or 0 when either is null. */
function rentalDays(start: Date | null, end: Date | null): number {
  return start && end ? Math.round((end.getTime() - start.getTime()) / 86400000) : 0;
}

/**
 * Computes the booking price breakdown: subtotal, insurance premium, fixed
 * service fee and total.
 */
function priceBreakdown(pricePerDay: number, days: number, category?: string) {
  const subtotal = pricePerDay * days;
  const insurance = Math.round(insuranceDailyRate(category) * days * 100) / 100;
  const total = subtotal + SERVICE_FEE + insurance;
  return { subtotal, insurance, serviceFee: SERVICE_FEE, total };
}

/**
 * Evaluates whether the selected number of days satisfies the listing's
 * min/max rental constraints and can therefore be booked.
 */
function bookingAvailability(days: number, minDays: number, maxDay?: number | null) {
  const isBelowMinimum = days > 0 && days < minDays;
  const isAboveMaximum = days > 0 && maxDay !== null && maxDay !== undefined && days > maxDay;
  return {
    isBelowMinimum,
    isAboveMaximum,
    canBook: days > 0 && !isBelowMinimum && !isAboveMaximum,
  };
}

export {
  SERVICE_FEE,
  initialFormState,
  toISODateStr,
  formatDateEs,
  fmtPrice,
  formatRating,
  formReducer,
  hasDateConflict,
  rentalDays,
  priceBreakdown,
  bookingAvailability,
};
export type { BookingCardFormAction, BookingCardFormState };
