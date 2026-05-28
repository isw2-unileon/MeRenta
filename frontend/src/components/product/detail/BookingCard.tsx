import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { StarRating } from "@/components/product/detail/StarRating";
import type { ApiResponse } from "@/types/common";

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
  /** Whether the authenticated user owns this listing. */
  isOwner?: boolean;
  /**
   * Callback fired when the user changes a date from the booking card inputs.
   * Receives the new start and end dates (either may be null).
   */
  onDateChange?: (start: Date | null, end: Date | null) => void;
}

interface ConversationResponse {
  conversation_id: string;
}

/** Formats a Date as "YYYY-MM-DD" (the value format required by input[type="date"]). */
function toISODateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Parses a "YYYY-MM-DD" string into a local midnight Date. */
function parseISODateStr(value: string): Date {
  const [y, mo, d] = value.split("-").map(Number);
  const date = new Date(y ?? 0, (mo ?? 1) - 1, d ?? 1);
  date.setHours(0, 0, 0, 0);
  return date;
}

/** Formats a Date as localised Spanish short date, e.g. "28 may 2026". */
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

async function startConversation(itemId: string): Promise<ConversationResponse> {
  const res = await fetch("/api/conversations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ item_id: itemId }),
  });
  const json = (await res.json()) as ApiResponse<ConversationResponse>;
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.error ?? "Error al iniciar la conversacion");
  }
  return json.data;
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
  isOwner = false,
  onDateChange,
}: BookingCardProps) {
  const navigate = useNavigate();
  const [messageLoading, setMessageLoading] = useState(false);
  const [messageError, setMessageError] = useState("");

  const startInputRef = useRef<HTMLInputElement>(null);
  const endInputRef = useRef<HTMLInputElement>(null);

  /** Opens the native date picker for the given input ref. */
  const openPicker = (ref: React.RefObject<HTMLInputElement | null>) => {
    const input = ref.current;
    if (!input || input.disabled) return;
    if (typeof input.showPicker === "function") {
      try {
        input.showPicker();
      } catch {
        input.focus();
      }
    } else {
      input.focus();
    }
  };

  /** Today as "YYYY-MM-DD" — used as the minimum selectable date. */
  const todayStr = toISODateStr(new Date());

  /** One day after the selected start — minimum valid end date. */
  const minEndStr = selectedStart
    ? toISODateStr(new Date(selectedStart.getFullYear(), selectedStart.getMonth(), selectedStart.getDate() + 1))
    : todayStr;

  const handleStartInputChange = (value: string) => {
    if (!value) {
      onDateChange?.(null, null);
      return;
    }
    const date = parseISODateStr(value);
    // Clear end date if it's no longer after the new start
    const newEnd = selectedEnd && selectedEnd > date ? selectedEnd : null;
    onDateChange?.(date, newEnd);
  };

  const handleEndInputChange = (value: string) => {
    if (!value) {
      onDateChange?.(selectedStart, null);
      return;
    }
    const date = parseISODateStr(value);
    // Only accept end if it's strictly after start
    if (selectedStart && date > selectedStart) {
      onDateChange?.(selectedStart, date);
    }
  };

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

  const handleMessage = async () => {
    setMessageLoading(true);
    setMessageError("");
    try {
      const conversation = await startConversation(itemId);
      void navigate(`/chat/${conversation.conversation_id}`);
    } catch (err) {
      setMessageError(err instanceof Error ? err.message : "Error al iniciar la conversacion");
    } finally {
      setMessageLoading(false);
    }
  };

  return (
    <div className="booking-card p-5">
      {/* ── Price + rating ── */}
      <div className="mb-4 flex items-start justify-between">
        <p className="booking-price">
          {pricePerDay} EUR<span className="text-2xl">/día</span>
        </p>
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
        {/* Start date cell: clicking opens the native date picker via ref */}
        <button
          type="button"
          className="flex flex-1 flex-col justify-between px-3 py-2 text-left"
          onClick={() => openPicker(startInputRef)}
          aria-label="Seleccionar fecha de recogida"
        >
          <p className="booking-date-label">Recogida</p>
          <p className="booking-date-value">{selectedStart ? formatDateEs(selectedStart) : "Selecciona fecha"}</p>
        </button>
        <input
          ref={startInputRef}
          type="date"
          className="booking-date-hidden"
          value={selectedStart ? toISODateStr(selectedStart) : ""}
          min={todayStr}
          onChange={(e) => handleStartInputChange(e.target.value)}
          aria-label="Fecha de recogida"
          tabIndex={-1}
        />

        <div className="booking-dates-divider" />

        {/* End date cell */}
        <button
          type="button"
          className="flex flex-1 flex-col justify-between px-3 py-2 text-left"
          onClick={() => openPicker(endInputRef)}
          disabled={!selectedStart}
          aria-label="Seleccionar fecha de devolución"
        >
          <p className="booking-date-label">Devolución</p>
          <p className={`booking-date-value${!selectedStart ? "booking-date-value--muted" : ""}`}>
            {selectedEnd ? formatDateEs(selectedEnd) : "Selecciona fecha"}
          </p>
        </button>
        <input
          ref={endInputRef}
          type="date"
          className="booking-date-hidden"
          value={selectedEnd ? toISODateStr(selectedEnd) : ""}
          min={minEndStr}
          disabled={!selectedStart}
          onChange={(e) => handleEndInputChange(e.target.value)}
          aria-label="Fecha de devolución"
          tabIndex={-1}
        />
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
        {!isOwner && (
          <button
            type="button"
            className="btn-secondary btn--md w-full"
            onClick={handleMessage}
            disabled={messageLoading}
          >
            {messageLoading ? "Abriendo chat..." : "Enviar mensaje al propietario"}
          </button>
        )}
      </div>

      {messageError && <p className="field-error mt-3 text-center">{messageError}</p>}

      {/* Disclaimer */}
      <p className="booking-disclaimer mt-3 text-center">No se hará ningún cargo hasta que el propietario acepte</p>

      <hr className="divider-booking my-4" />

      {/* Report link */}
      <p className="booking-report text-center">Reportar producto</p>
    </div>
  );
}

export { BookingCard };
