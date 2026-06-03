import { useReducer, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, X } from "lucide-react";

import { ProductCalendar } from "@/components/product/detail/ProductCalendar";
import { StarRating } from "@/components/product/detail/StarRating";
import { PRODUCT_REPORTS_STORAGE_KEY } from "@/constants/storageKeys";
import type { ApiResponse } from "@/types/common";

/** Fixed service fee applied to every rental (EUR). */
const SERVICE_FEE = 5;

/** Per-day insurance rate (EUR). */
const INSURANCE_DAILY_RATE = 2.3;

interface BookingCardProps {
  /** The item UUID, used to build the checkout URL. */
  itemId: string;
  /** Human-readable listing title, stored with local product reports for admin review. */
  itemTitle: string;
  /** Name of the user filing a local product report. */
  reporterName: string;
  /** User id of the customer filing a local product report. */
  reporterId: string;
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
  /** Set of "YYYY-MM-DD" strings already occupied by active bookings. */
  occupiedDates?: Set<string>;
  /**
   * Callback fired when the user changes a date from the booking card inputs.
   * Receives the new start and end dates (either may be null).
   */
  onDateChange?: (start: Date | null, end: Date | null) => void;
}

interface ConversationResponse {
  conversation_id: string;
}

type ProductIncidentType = "misleading" | "damaged" | "prohibited" | "unavailable" | "other";
type ProductIncidentPriority = "low" | "medium" | "high";

interface StoredProductReport {
  report_id: string;
  item_id: string;
  item_title: string;
  reporter_id: string;
  reporter_name: string;
  type: ProductIncidentType;
  priority: ProductIncidentPriority;
  description: string;
  status: "open" | "reviewing" | "escalated" | "resolved";
  reported_at: string;
}

const PRODUCT_INCIDENT_LABELS: Record<ProductIncidentType, string> = {
  misleading: "Informacion incorrecta",
  damaged: "Producto en mal estado",
  prohibited: "Producto no permitido",
  unavailable: "No disponible",
  other: "Otra incidencia",
};

const PRODUCT_INCIDENT_PRIORITY: Record<ProductIncidentType, ProductIncidentPriority> = {
  misleading: "low",
  unavailable: "medium",
  other: "medium",
  damaged: "high",
  prohibited: "high",
};

/** Formats a Date as "YYYY-MM-DD" (the value format required by input[type="date"]). */
function toISODateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Formats a Date as localized Spanish short date, e.g. "28 May 2026". */
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

// ── BookingCard local state ───────────────────────────────────────────────────

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

/** Returns true if any day in [start, end] appears in the occupied set. */
function hasDateConflict(start: Date, end: Date, occupied: Set<string>): boolean {
  const cur = new Date(start);
  cur.setHours(0, 0, 0, 0);
  while (cur <= end) {
    if (occupied.has(toISODateStr(cur))) return true;
    cur.setDate(cur.getDate() + 1);
  }
  return false;
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
    throw new Error(json.error ?? "Error al iniciar la conversación");
  }
  return json.data;
}

interface ProductReportModalProps {
  itemId: string;
  itemTitle: string;
  reporterId: string;
  reporterName: string;
  onClose: () => void;
  onSuccess: () => void;
}

function ProductReportModal({
  itemId,
  itemTitle,
  reporterId,
  reporterName,
  onClose,
  onSuccess,
}: ProductReportModalProps) {
  const [incidentType, setIncidentType] = useState<ProductIncidentType>("misleading");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cleanReporterName = reporterName.trim() || "Usuario";
    if (description.trim().length < 10) {
      setError("Describe la incidencia con al menos 10 caracteres.");
      return;
    }

    const report: StoredProductReport = {
      report_id: crypto.randomUUID(),
      item_id: itemId,
      item_title: itemTitle,
      reporter_id: reporterId,
      reporter_name: cleanReporterName,
      type: incidentType,
      priority: PRODUCT_INCIDENT_PRIORITY[incidentType],
      description: description.trim(),
      status: "open",
      reported_at: new Date().toISOString(),
    };

    const storedReports = JSON.parse(localStorage.getItem(PRODUCT_REPORTS_STORAGE_KEY) ?? "[]") as StoredProductReport[];
    localStorage.setItem(PRODUCT_REPORTS_STORAGE_KEY, JSON.stringify([report, ...storedReports]));
    onSuccess();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4">
      <div className="w-full max-w-md rounded-xl border border-neutral-200 bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-[12px] font-semibold tracking-wide text-amber-700 uppercase">Incidencia</p>
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
              Descripcion
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
            >
              Enviar reporte
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
 * @param isOwner Whether the authenticated user owns this listing. If true, the "Enviar mensaje" button is hidden.
 * @param onDateChange Callback fired when the user changes a date from the booking card inputs. Receives the new start and end dates (either may be null).
 * @returns Booking card JSX.
 */
function BookingCard({
  itemId,
  itemTitle,
  reporterId,
  reporterName,
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
            <span className="booking-rating font-medium">{rating}</span>
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

      {reportOpen && (
        <ProductReportModal
          itemId={itemId}
          itemTitle={itemTitle}
          reporterId={reporterId}
          reporterName={reporterName}
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
