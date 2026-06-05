/** Formats a Date as a short Spanish date string, e.g. "15 May 2025". */
function fmtDateEs(date: Date): string {
  return date.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
}

/** Formats a number as a price with comma decimal separator, e.g. "6,90". */
function fmtPrice(value: number): string {
  return value.toFixed(2).replace(".", ",");
}

interface RentalSummaryProps {
  /** Listing title shown in the summary card. */
  itemTitle: string;
  /** URL of the primary listing image. Undefined renders a tinted placeholder. */
  imageUrl?: string;
  /** Owner's full name. */
  ownerName: string;
  /** Owner's average rating (0 – 5). */
  ownerRating: number;
  /** Rental start date. */
  startDate: Date;
  /** Rental end date. */
  endDate: Date;
  /** Base price per rental day in EUR. */
  pricePerDay: number;
  /** Fixed platform service fee in EUR. */
  serviceFee: number;
  /** Computed insurance cost in EUR. */
  insurance: number;
  /** Grand total in EUR (pricePerDay × days + serviceFee + insurance). */
  total: number;
}

/**
 * Right-column card that summarizes what the renter is paying for.
 * Mirrors the breakdown computed by the booking card and repeated server-side.
 *
 * @param itemTitle Listing title.
 * @param imageUrl Primary image URL.
 * @param ownerName Owner display name.
 * @param ownerRating Owner average rating.
 * @param startDate Rental start.
 * @param endDate Rental end.
 * @param pricePerDay Price per day.
 * @param serviceFee Service fee.
 * @param insurance Insurance cost.
 * @param total Grand total.
 * @returns Summary card JSX.
 */
function RentalSummary({
  itemTitle,
  imageUrl,
  ownerName,
  ownerRating,
  startDate,
  endDate,
  pricePerDay,
  serviceFee,
  insurance,
  total,
}: RentalSummaryProps) {
  const days = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const subtotal = pricePerDay * days;

  return (
    <div className="flex flex-col gap-5">
      {/* ── Header ── */}
      <h2 className="heading-panel">Resumen del alquiler</h2>

      {/* ── Item card ── */}
      <div className="border-border-main flex items-start gap-4 rounded-lg border bg-white p-4">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={itemTitle}
            className="size-20 shrink-0 rounded-md object-cover"
          />
        ) : (
          <div className="bg-primary-light size-20 shrink-0 rounded-md" />
        )}

        <div className="flex flex-col gap-1">
          <p className="summary-product-name">{itemTitle}</p>
          <p className="summary-owner">Propietario: {ownerName}</p>
          <p className="summary-owner">
            <span style={{ color: "var(--color-rating)" }}>★</span> {ownerRating.toFixed(1)}
          </p>
        </div>
      </div>

      {/* ── Dates ── */}
      <div>
        <p className="summary-dates-label mb-1">Fechas del alquiler</p>
        <p className="summary-dates">
          {fmtDateEs(startDate)} → {fmtDateEs(endDate)} · {days} {days === 1 ? "día" : "días"}
        </p>
      </div>

      <hr className="divider-subtle" />

      {/* ── Price breakdown ── */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <p className="summary-row-label">Precio por día</p>
          <p className="summary-row-value">{fmtPrice(pricePerDay)} EUR</p>
        </div>
        <div className="flex items-center justify-between">
          <p className="summary-row-label">
            {days} {days === 1 ? "dia" : "días"} de alquiler
          </p>
          <p className="summary-row-value">{fmtPrice(subtotal)} EUR</p>
        </div>
        <div className="flex items-center justify-between">
          <p className="summary-row-label--muted">Tarifa de servicio MeRenta</p>
          <p className="summary-row-value">{fmtPrice(serviceFee)} EUR</p>
        </div>

        {/* Insurance row */}
        <div className="bg-insurance flex items-center justify-between rounded-md px-3 py-2">
          <div>
            <p className="insurance-name flex items-center gap-2">
              Seguro obligatorio
              <span className="badge-obligatorio">OBLIGATORIO</span>
            </p>
            <p className="insurance-desc-checkout">Daños, robo y responsabilidad civil</p>
          </div>
          <p className="insurance-price-checkout font-bold">{fmtPrice(insurance)} EUR</p>
        </div>
      </div>

      <hr className="divider-total" />

      {/* ── Total ── */}
      <div className="flex items-center justify-between">
        <p className="summary-total-label">Total</p>
        <p className="summary-total-value">{fmtPrice(total)} EUR</p>
      </div>

      {/* ── Security badges ── */}
      <div className="flex items-center justify-around pt-1">
        <div className="text-subtle flex items-center gap-1">
          <span className="text-sm">🔒</span>
          <p className="security-badge-text">SSL Seguro</p>
        </div>
        <div className="text-subtle flex items-center gap-1">
          <span className="text-sm">✓</span>
          <p className="security-badge-text">Pago verificado</p>
        </div>
        <div className="text-subtle flex items-center gap-1">
          <span className="text-sm">🛡</span>
          <p className="security-badge-text">Stripe PCI DSS</p>
        </div>
      </div>
    </div>
  );
}

export { RentalSummary };
