// Shared formatting helpers for the admin panel tables.

const DATE_OPTIONS: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" };

/** Formats an ISO date as a short Spanish date, or an em dash when empty. */
function fmtDate(iso: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-ES", DATE_OPTIONS);
}

const EUR_FORMAT = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 2,
});

/** Formats a number as EUR currency, or an em dash when null. */
function fmtPrice(value: number | null): string {
  if (value === null) return "—";
  return EUR_FORMAT.format(value);
}

export { fmtDate, fmtPrice, EUR_FORMAT };
