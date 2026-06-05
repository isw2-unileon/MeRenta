import { describe, expect, it } from "vitest";

import {
  bookingAvailability,
  formReducer,
  hasDateConflict,
  initialFormState,
  priceBreakdown,
  rentalDays,
  toISODateStr,
} from "./BookingCard.logic";

describe("BookingCard logic", () => {
  it("formats local dates as ISO input values", () => {
    expect(toISODateStr(new Date(2026, 5, 5))).toBe("2026-06-05");
  });

  it("tracks message and booking reducer states", () => {
    const loading = formReducer(initialFormState, { type: "message:start" });
    const failed = formReducer(loading, { type: "message:error", error: "No chat" });
    const bookingFailed = formReducer(failed, { type: "booking:error", error: "Fechas ocupadas" });
    const cleared = formReducer(bookingFailed, { type: "booking:clear" });

    expect(loading).toMatchObject({ messageLoading: true, messageError: "" });
    expect(failed).toMatchObject({ messageLoading: false, messageError: "No chat" });
    expect(bookingFailed.bookingError).toBe("Fechas ocupadas");
    expect(cleared.bookingError).toBe("");
  });

  it("detects occupied dates inside the selected range", () => {
    const occupied = new Set(["2026-06-07"]);

    expect(hasDateConflict(new Date(2026, 5, 5), new Date(2026, 5, 8), occupied)).toBe(true);
    expect(hasDateConflict(new Date(2026, 5, 8), new Date(2026, 5, 10), occupied)).toBe(false);
  });

  it("calculates days and price breakdown", () => {
    const days = rentalDays(new Date(2026, 5, 5), new Date(2026, 5, 8));

    expect(days).toBe(3);
    expect(priceBreakdown(10, days)).toEqual({
      subtotal: 30,
      insurance: 6.9,
      serviceFee: 5,
      total: 41.9,
    });
  });

  it("enforces minimum and maximum rental periods", () => {
    expect(bookingAvailability(1, 2, 7)).toMatchObject({ canBook: false, isBelowMinimum: true });
    expect(bookingAvailability(8, 2, 7)).toMatchObject({ canBook: false, isAboveMaximum: true });
    expect(bookingAvailability(4, 2, 7)).toMatchObject({ canBook: true });
    expect(bookingAvailability(8, 2, null)).toMatchObject({ canBook: true });
  });
});
