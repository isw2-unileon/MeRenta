import { useNavigate } from "react-router-dom";

import { StarRating } from "@/components/product/detail/StarRating";

/** Fixed service fee applied to every rental (EUR). */
const SERVICE_FEE = 5;

/** Per-day insurance rate (EUR). */
const INSURANCE_DAILY_RATE = 2.3;

interface BookingCardProps {
  /** The item UUID, used to build the checkout URL. */
  itemId: string;
  /** Base rental price per day in EUR. */
  pricePerDay: number;
  /** Average rating for the listing (0 – 5). */
  rating: number;
  /** Total number of reviews. */
  reviewCount: number;
  /** Currently selected rental start date. */
  selectedStart: Date | null;
  /** Currently selected rental end date. */
  selectedEnd: Date | null;
  /** Minimum number of rental days configured by the owner. */
  minDays: number;
  /** Maximum number of rental days configured by the owner. Null means unlimited. */
  maxDay?: number | null;
}

/** Formats a Date as localised Spanish short date, e.g. "15 may 2025". */
function formatDateEs(date: Date): string {
  return date.toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Formats a number as a price string with comma decimal, e.g. "6,90". */
function fmtPrice(value: number): string {
  return value.toFixed(2).replace(".", ",");
}

/**
 * Sticky right-column card that shows the price, date picker summary,
 * a live price breakdown, and the "Solicitar alquiler" / "Enviar mensaje" actions.
 *
 * The price breakdown is only rendered once both start and end dates are selected.
 * Navigates to `/checkout/:itemId?start=…&end=…` when the user books.
 * @param itemId UUID of the listing.
 * @param pricePerDay Price per day in EUR.
 * @param rating Average item rating.
 * @param reviewCount Number of reviews.
 * @param selectedStart Rental start date or null.
 * @param selectedEnd Rental end date or null.
 * @param minDays Minimum rental days configured for the listing.
 * @param maxDay Maximum rental days configured for the listing. Null means unlimited.
 * @returns Booking card JSX.
 */
function BookingCard({
  itemId,
  pricePerDay,
  rating,
  reviewCount,
  selectedStart,
  selectedEnd,
  minDays,
  maxDay,
}: BookingCardProps) {
  const navigate = useNavigate();

  const days =
    selectedStart && selectedEnd
      ? Math.round((selectedEnd.getTime() - selectedStart.getTime()) / (1000 * 60 * 60 * 24))
      : 0;

  const subtotal = pricePerDay * days;
  const insurance = Math.round(INSURANCE_DAILY_RATE * days * 100) / 100;
  const total = subtotal + SERVICE_FEE + insurance;
  const isBelowMinimum = days > 0 && days < minDays;
  const isAboveMaximum = days > 0 && maxDay !== null && maxDay !== undefined && days > maxDay;
  const canBook = days > 0 && !isBelowMinimum && !isAboveMaximum;
  const periodHint = maxDay ? `Min. ${minDays} días · Max. ${maxDay} días` : `Min. ${minDays} días`;

  const handleBook = () => {
    if (!canBook || !selectedStart || !selectedEnd) return;
    const start = selectedStart.toISOString().split("T")[0] ?? "";
    const end = selectedEnd.toISOString().split("T")[0] ?? "";
    void navigate(`/checkout/${itemId}?start=${start}&end=${end}`);
  };

  const handleMessage = () => {
    void navigate(`/chat`);
  };

  return (
    <div className="booking-card p-5">
      {/* ── Price + rating ── */}
      <div className="mb-4 flex items-start justify-between">
        <p className="booking-price">{pricePerDay} EUR</p>
        {reviewCount > 0 && (
          <div className="flex items-center gap-1 pt-1">
            <StarRating
              rating={rating}
              max={1}
              className="text-base"
            />
            <span className="booking-rating font-medium">{rating}</span>
            <span className="booking-rating">({reviewCount})</span>
          </div>
        )}
      </div>

      {/* ── Rental dates summary ── */}
      <p className="booking-field-label mb-2">Fechas del alquiler</p>
      <div className="booking-dates mb-4">
        <div className="flex flex-1 flex-col justify-center px-3">
          <p className="booking-date-label">Recogida</p>
          <p className="booking-date-value">{selectedStart ? formatDateEs(selectedStart) : "Selecciona fecha"}</p>
        </div>
        <div className="booking-dates-divider" />
        <div className="flex flex-1 flex-col justify-center px-3">
          <p className="booking-date-label">Devolución</p>
          <p className="booking-date-value">{selectedEnd ? formatDateEs(selectedEnd) : "Selecciona fecha"}</p>
        </div>
      </div>
      <p className="booking-row-label -mt-2 mb-4">{periodHint}</p>

      {/* ── Price breakdown (only when dates are selected) ── */}
      {canBook && (
        <div className="mb-4 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <p className="booking-row-label">
              {pricePerDay} EUR x {days} {days === 1 ? "día" : "días"}
            </p>
            <p className="booking-row-value">{fmtPrice(subtotal)} EUR</p>
          </div>
          <div className="flex items-center justify-between">
            <p className="booking-row-label">Tarifa de servicio</p>
            <p className="booking-row-value">{SERVICE_FEE} EUR</p>
          </div>
          <div className="flex items-center justify-between">
            <p className="booking-row-label">Seguro obligatorio</p>
            <p className="booking-row-value">{fmtPrice(insurance)} EUR</p>
          </div>
          <hr className="divider-booking my-1" />
          <div className="flex items-center justify-between">
            <p className="booking-total-label">Total (con seguro)</p>
            <p className="booking-total-value">{fmtPrice(total)} EUR</p>
          </div>
        </div>
      )}

      {(isBelowMinimum || isAboveMaximum) && (
        <p className="field-error mb-4">
          {isBelowMinimum
            ? `El alquiler mínimo es de ${minDays} ${minDays === 1 ? "día" : "días"}.`
            : `El alquiler máximo es de ${maxDay} días.`}
        </p>
      )}

      {/* ── Actions ── */}
      <div className="flex flex-col gap-2">
        <button
          type="button"
          className="btn-booking"
          onClick={handleBook}
          disabled={!canBook}
        >
          Solicitar alquiler
        </button>
        <button
          type="button"
          className="btn-secondary btn--md w-full"
          onClick={handleMessage}
        >
          Enviar mensaje al propietario
        </button>
      </div>

      {/* Disclaimer */}
      <p className="booking-disclaimer mt-3 text-center">No se hará ningún cargo hasta que el propietario acepte</p>

      <hr className="divider-booking my-4" />

      {/* Report link */}
      <p className="booking-report text-center">Reportar producto</p>
    </div>
  );
}

export { BookingCard };
