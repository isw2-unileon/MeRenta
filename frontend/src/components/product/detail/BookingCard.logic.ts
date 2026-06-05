const SERVICE_FEE = 5;
const INSURANCE_DAILY_RATE = 2.3;

interface BookingCardFormState {
  messageLoading: boolean;
  messageError: string;
  bookingError: string;
  calendarOpen: boolean;
}

type BookingCardFormAction =
  | { type: "message:start" }
  | { type: "message:done" }
  | { type: "message:error"; error: string }
  | { type: "booking:error"; error: string }
  | { type: "booking:clear" }
  | { type: "calendar:toggle" }
  | { type: "calendar:close" };

const initialFormState: BookingCardFormState = {
  messageLoading: false,
  messageError: "",
  bookingError: "",
  calendarOpen: false,
};

function toISODateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDateEs(date: Date): string {
  return date.toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function fmtPrice(value: number): string {
  return value.toFixed(2).replace(".", ",");
}

function formatRating(value: number): string {
  return value.toFixed(2);
}

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

function hasDateConflict(start: Date, end: Date, occupied: Set<string>): boolean {
  const cur = new Date(start);
  cur.setHours(0, 0, 0, 0);
  while (cur <= end) {
    if (occupied.has(toISODateStr(cur))) return true;
    cur.setDate(cur.getDate() + 1);
  }
  return false;
}

function rentalDays(start: Date | null, end: Date | null): number {
  return start && end ? Math.round((end.getTime() - start.getTime()) / 86400000) : 0;
}

function priceBreakdown(pricePerDay: number, days: number) {
  const subtotal = pricePerDay * days;
  const insurance = Math.round(INSURANCE_DAILY_RATE * days * 100) / 100;
  const total = subtotal + SERVICE_FEE + insurance;
  return { subtotal, insurance, serviceFee: SERVICE_FEE, total };
}

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
  INSURANCE_DAILY_RATE,
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
