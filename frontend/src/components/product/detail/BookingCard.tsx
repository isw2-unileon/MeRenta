import React, { useReducer, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, X } from "lucide-react";

import { ProductCalendar } from "@/components/product/detail/ProductCalendar";
import { StarRating } from "@/components/product/detail/StarRating";
import {
  bookingAvailability,
  fmtPrice,
  formReducer,
  formatDateEs,
  formatRating,
  hasDateConflict,
  initialFormState,
  priceBreakdown,
  rentalDays,
  toISODateStr,
} from "@/components/product/detail/BookingCard.logic";
import type { ApiResponse } from "@/types/common";

interface ConversationResponse {
  conversation_id: string;
}

interface BookingCardProps {
  itemId: string;
  itemTitle: string;
  reporterName: string;
  reporterId: string;
  pricePerDay: number;
  rating: number;
  reviewCount: number;
  selectedStart: Date | null;
  selectedEnd: Date | null;
  minDays: number;
  maxDay?: number | null;
  isOwner?: boolean;
  occupiedDates?: Set<string>;
  onDateChange?: (start: Date | null, end: Date | null) => void;
}

type ProductIncidentType = "item_mismatch" | "damage" | "forbidden_item" | "not_available" | "other";

const PRODUCT_INCIDENT_LABELS: Record<ProductIncidentType, string> = {
  item_mismatch: "InformaciÃ³n incorrecta",
  damage: "Producto en mal estado",
  forbidden_item: "Producto no permitido",
  not_available: "No disponible",
  other: "Otra incidencia",
};

async function startConversation(itemId: string): Promise<ConversationResponse> {
  const res = await fetch("/api/conversations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ item_id: itemId }),
  });
  const json = (await res.json()) as ApiResponse<ConversationResponse>;
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.error ?? "Error al iniciar la conversación");
  }
  return json.data;
}

interface ProductReportModalProps {
  itemId: string;
  onClose: () => void;
  onSuccess: () => void;
}

function ProductReportModal({ itemId, onClose, onSuccess }: ProductReportModalProps) {
  const [incidentType, setIncidentType] = useState<ProductIncidentType>("item_mismatch");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (description.trim().length < 10) {
      setError("Describe la incidencia con al menos 10 caracteres.");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/items/${itemId}/reports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          type: incidentType,
          description: description.trim(),
        }),
      });
      const json = (await res.json()) as ApiResponse<unknown>;
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Error al guardar la incidencia");
      }
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar la incidencia");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4">
      <div className="w-full max-w-md rounded-xl border border-neutral-200 bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-card-loc font-semibold tracking-wide text-amber-700 uppercase">Incidencia</p>
            <h2 className="text-base font-bold text-neutral-900">Reportar producto</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-full p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
          >
            <X size={18} />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4"
        >
          <div>
            <p className="mb-1.5 text-sm font-medium text-neutral-700">Tipo de incidencia</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {(Object.keys(PRODUCT_INCIDENT_LABELS) as ProductIncidentType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setIncidentType(type)}
                  className={`rounded-lg border px-3 py-2.5 text-left text-sm font-medium transition ${
                    incidentType === type
                      ? "border-emerald-700 bg-emerald-50 text-emerald-700"
                      : "border-neutral-200 text-neutral-600 hover:border-neutral-300"
                  }`}
                >
                  {PRODUCT_INCIDENT_LABELS[type]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label
              htmlFor="product-report-description"
              className="mb-1.5 block text-sm font-medium text-neutral-700"
            >
              Descripción
            </label>
            <textarea
              id="product-report-description"
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                setError("");
              }}
              rows={4}
              maxLength={1000}
              placeholder="Explica brevemente que ocurre con este producto..."
              className="w-full resize-none rounded-lg border border-neutral-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-500"
            />
            <p className="mt-1 text-xs text-neutral-400">{description.length}/1000 caracteres</p>
          </div>

          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              className="btn-booking flex-1"
              disabled={submitting}
            >
              {submitting ? "Enviando..." : "Enviar reporte"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary btn--md flex-1"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
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
 * @param isOwner Whether the authenticated user owns this listing. If true, owner-only actions are hidden.
 * @param occupiedDates Set of "YYYY-MM-DD" strings representing dates already booked for this listing. Used to prevent double-booking.
 * @param onDateChange Callback fired when the user changes a date from the booking card inputs. Receives the new start and end dates (either may be null).
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
  occupiedDates,
  onDateChange,
}: BookingCardProps) {
  const navigate = useNavigate();
  const [formState, dispatchForm] = useReducer(formReducer, initialFormState);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportSuccess, setReportSuccess] = useState(false);
  const { messageLoading, messageError, bookingError, calendarOpen } = formState;

  /**
   * Two-click state machine for the mini calendar:
   * – No start yet (or range already complete) → set start, clear end.
   * – Start set, date after start → set end and close calendar.
   * – Start set, date on/before start → reset to new start.
   */
  const handleCalendarDateSelect = (date: Date) => {
    if (!selectedStart || selectedEnd !== null) {
      onDateChange?.(date, null);
      return;
    }
    if (date <= selectedStart) {
      onDateChange?.(date, null);
      return;
    }
    onDateChange?.(selectedStart, date);
    dispatchForm({ type: "calendar:close" });
  };

  const days = rentalDays(selectedStart, selectedEnd);
  const { subtotal, insurance, serviceFee, total } = priceBreakdown(pricePerDay, days);
  const { isBelowMinimum, isAboveMaximum, canBook } = bookingAvailability(days, minDays, maxDay);
  const periodHint = maxDay ? `Mín. ${minDays} días · Máx. ${maxDay} días` : `Mín. ${minDays} días`;
  const ratingLabel = formatRating(rating);

  const handleBook = () => {
    if (!canBook || !selectedStart || !selectedEnd) return;
    if (occupiedDates && hasDateConflict(selectedStart, selectedEnd, occupiedDates)) {
      dispatchForm({ type: "booking:error", error: "Estas fechas ya están reservadas. Por favor, elige otras." });
      return;
    }
    dispatchForm({ type: "booking:clear" });
    const start = toISODateStr(selectedStart);
    const end = toISODateStr(selectedEnd);
    void navigate(`/checkout/${itemId}?start=${start}&end=${end}`);
  };

  const handleMessage = async () => {
    dispatchForm({ type: "message:start" });
    try {
      const conversation = await startConversation(itemId);
      void navigate(`/chat/${conversation.conversation_id}`);
    } catch (err) {
      dispatchForm({
        type: "message:error",
        error: err instanceof Error ? err.message : "Error al iniciar la conversación",
      });
    } finally {
      dispatchForm({ type: "message:done" });
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
            <span className="booking-rating font-medium">{ratingLabel}</span>
            <span className="booking-rating">({reviewCount})</span>
          </div>
        )}
      </div>

      {/* ── Rental dates summary — clicking toggles the mini calendar ── */}
      <p className="booking-field-label mb-2">Fechas del alquiler</p>
      <div className="booking-dates mb-2">
        <button
          type="button"
          className="flex flex-1 flex-col justify-between px-3 py-2 text-left"
          onClick={() => dispatchForm({ type: "calendar:toggle" })}
          aria-expanded={calendarOpen}
          aria-label="Seleccionar fecha de recogida"
        >
          <p className="booking-date-label">Recogida</p>
          <p className="booking-date-value">{selectedStart ? formatDateEs(selectedStart) : "Selecciona fecha"}</p>
        </button>

        <div className="booking-dates-divider" />

        <button
          type="button"
          className="flex flex-1 flex-col justify-between px-3 py-2 text-left"
          onClick={() => dispatchForm({ type: "calendar:toggle" })}
          aria-expanded={calendarOpen}
          aria-label="Seleccionar fecha de devolución"
        >
          <p className="booking-date-label">Devolución</p>
          <p className={`booking-date-value${!selectedStart ? "booking-date-value--muted" : ""}`}>
            {selectedEnd ? formatDateEs(selectedEnd) : "Selecciona fecha"}
          </p>
        </button>
      </div>
      <p className="booking-row-label mb-2">{periodHint}</p>

      {/* ── Mini calendar dropdown ── */}
      {calendarOpen && (
        <div className="mb-4">
          <ProductCalendar
            occupiedDates={occupiedDates ?? new Set<string>()}
            selectedStart={selectedStart}
            selectedEnd={selectedEnd}
            onDateSelect={handleCalendarDateSelect}
            navigateTo={selectedStart}
          />
        </div>
      )}

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
            <p className="booking-row-value">{serviceFee} EUR</p>
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

      {bookingError && <p className="field-error mt-3 text-center">{bookingError}</p>}
      {messageError && <p className="field-error mt-3 text-center">{messageError}</p>}
      {reportSuccess && (
        <p className="mt-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-center text-sm text-green-700">
          Reporte registrado. Revisaremos el producto pronto.
        </p>
      )}

      {/* Disclaimer */}
      <p className="booking-disclaimer mt-3 text-center">
        El pago queda retenido hasta que el propietario acepte. Si rechaza o no responde en 5 días, recibirás un
        reembolso completo.
      </p>

      {!isOwner && (
        <>
          <hr className="divider-booking my-4" />

          {/* Report link */}
          <button
            type="button"
            className="booking-report flex w-full items-center justify-center gap-1.5 bg-transparent p-0 text-center"
            onClick={() => {
              setReportSuccess(false);
              setReportOpen(true);
            }}
          >
            <AlertTriangle size={14} /> Reportar producto
          </button>
        </>
      )}

      {!isOwner && reportOpen && (
        <ProductReportModal
          itemId={itemId}
          onClose={() => setReportOpen(false)}
          onSuccess={() => {
            setReportOpen(false);
            setReportSuccess(true);
          }}
        />
      )}
    </div>
  );
}

export { BookingCard };
