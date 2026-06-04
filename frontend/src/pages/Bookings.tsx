import { useEffect, useReducer, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowRight, BadgeCheck, CalendarDays, Package, X } from "lucide-react";

import { useAuth } from "@/hooks/useAuth";
import type { ApiResponse } from "@/types/common";
import type { BookingDetailResponse, BookingListResponse, BookingStatus } from "@/types/booking";
import type { IncidentType } from "@/types/incident";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(value: string): string {
  const d = new Date(value);
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
}

function fmtPrice(value: number): string {
  return value.toFixed(2).replace(".", ",");
}

const STATUS_LABELS: Record<BookingStatus, string> = {
  pending: "Pendiente",
  accepted: "Aceptada",
  rejected: "Rechazada",
  cancelled: "Cancelada",
  completed: "Completada",
};

const STATUS_CLASSES: Record<BookingStatus, string> = {
  pending: "bg-[#fff0c4] text-[#9b7411]",
  accepted: "bg-primary-light text-primary",
  rejected: "bg-[#ffe4e4] text-[#b91c1c]",
  cancelled: "bg-[#f3f4f6] text-[#6b7280]",
  completed: "bg-[#dcfce7] text-[#15803d]",
};

async function fetchBookings(role: "mine" | "as-owner"): Promise<BookingListResponse> {
  const res = await fetch(`/api/bookings/${role}`, { credentials: "include" });
  const json = (await res.json()) as ApiResponse<BookingListResponse>;
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.error ?? "Error al cargar reservas");
  }
  return json.data;
}

async function openConversation(itemId: string, withUserId?: string): Promise<string> {
  const body: Record<string, string> = { item_id: itemId };
  if (withUserId) body.with_user_id = withUserId;

  const res = await fetch("/api/conversations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as ApiResponse<{ conversation_id: string }>;
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.error ?? "Error al abrir el chat");
  }
  return json.data.conversation_id;
}

async function patchBookingStatus(
  bookingId: string,
  action: "accept" | "reject" | "cancel" | "complete"
): Promise<void> {
  const res = await fetch(`/api/bookings/${bookingId}/${action}`, {
    method: "PATCH",
    credentials: "include",
  });
  const json = (await res.json()) as ApiResponse<unknown>;
  if (!res.ok || !json.success) {
    throw new Error(json.error ?? "Error al actualizar la reserva");
  }
}

// ── Incident helpers ──────────────────────────────────────────────────────────

const INCIDENT_TYPE_LABELS: Record<IncidentType, string> = {
  damage: "Producto dañado",
  late_return: "Devolución tardía",
  item_mismatch: "Producto no coincide",
  not_delivered: "No entregado",
  other: "Otra incidencia",
  not_available: "No disponible",
  forbidden_item: "Producto no permitido",
};

const BOOKING_INCIDENT_TYPES: IncidentType[] = ["damage", "late_return", "item_mismatch", "not_delivered", "other"];

async function submitIncident(bookingId: string, type: IncidentType, description: string): Promise<void> {
  const res = await fetch("/api/incidents", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ booking_id: bookingId, type, description }),
  });
  const json = (await res.json()) as ApiResponse<unknown>;
  if (!res.ok || !json.success) {
    throw new Error(json.error ?? "Error al enviar la incidencia");
  }
}

// ── Incident modal ────────────────────────────────────────────────────────────

interface IncidentModalProps {
  booking: BookingDetailResponse;
  onClose: () => void;
  onSuccess: () => void;
}

function IncidentModal({ booking, onClose, onSuccess }: IncidentModalProps) {
  const [type, setType] = useState<IncidentType>("damage");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (description.trim().length < 10) {
      setError("La descripción debe tener al menos 10 caracteres.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await submitIncident(booking.booking_id, type, description.trim());
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
      <div className="w-full max-w-md rounded-xl border border-neutral-200 bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-bold text-neutral-900">Reportar incidencia</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="text-neutral-400 hover:text-neutral-700"
          >
            <X size={18} />
          </button>
        </div>

        <p className="mb-4 text-sm text-neutral-500">
          Reserva: <span className="font-medium text-neutral-800">{booking.item_title}</span>
        </p>

        <form
          onSubmit={(e) => void handleSubmit(e)}
          className="space-y-4"
        >
          {/* Type */}
          <div>
            <p className="mb-1.5 text-sm font-medium text-neutral-700">Tipo de incidencia</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {BOOKING_INCIDENT_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className="rounded-lg border px-3 py-2.5 text-left text-sm font-medium transition"
                  style={
                    type === t
                      ? { borderColor: "#15734f", backgroundColor: "#e6f2ec", color: "#15734f" }
                      : { borderColor: "#e5e7eb", color: "#525252" }
                  }
                >
                  {INCIDENT_TYPE_LABELS[t]}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label
              htmlFor="incident-description"
              className="mb-1.5 block text-sm font-medium text-neutral-700"
            >
              Descripción del problema
            </label>
            <textarea
              id="incident-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="Describe con detalle qué ocurrió…"
              className="w-full resize-none rounded-lg border border-neutral-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-500"
            />
            <p className="mt-1 text-xs text-neutral-400">{description.length}/2000 caracteres</p>
          </div>

          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 rounded-lg py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              style={{ backgroundColor: "#15734f" }}
            >
              {loading ? "Enviando…" : "Enviar incidencia"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-neutral-200 py-2.5 text-sm text-neutral-600"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── State ─────────────────────────────────────────────────────────────────────

interface BookingsState {
  items: BookingDetailResponse[];
  total: number;
  loading: boolean;
  error: string;
}

type BookingsAction =
  | { type: "fetch_start" }
  | { type: "fetch_success"; payload: BookingListResponse }
  | { type: "fetch_error"; error: string }
  | { type: "update_status"; bookingId: string; status: BookingStatus };

const initialState: BookingsState = { items: [], total: 0, loading: true, error: "" };

function bookingsReducer(state: BookingsState, action: BookingsAction): BookingsState {
  switch (action.type) {
    case "fetch_start":
      return { ...state, loading: true, error: "" };
    case "fetch_success":
      return { items: action.payload.items, total: action.payload.total, loading: false, error: "" };
    case "fetch_error":
      return { ...state, loading: false, error: action.error };
    case "update_status":
      return {
        ...state,
        items: state.items.map((b) =>
          b.booking_id === action.bookingId ? { ...b, booking_status: action.status } : b
        ),
      };
    default:
      return state;
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface BookingCardProps {
  booking: BookingDetailResponse;
  viewMode: "renter" | "owner";
  onAccept?: (id: string) => void;
  onReject?: (id: string) => void;
  onCancel?: (id: string) => void;
  onComplete?: (id: string) => void;
  /** Called with itemId and, for owner view, the renter's userId. */
  onMessage?: (itemId: string, withUserId?: string) => void;
  onReport?: (booking: BookingDetailResponse) => void;
  actionLoading: string | null;
}

function BookingCard({
  booking,
  viewMode,
  onAccept,
  onReject,
  onCancel,
  onComplete,
  onMessage,
  onReport,
  actionLoading,
}: BookingCardProps) {
  const navigate = useNavigate();
  const isPending = booking.booking_status === "pending";
  const isActive = booking.booking_status === "accepted";
  const isBusy = actionLoading === booking.booking_id;

  // Complete is available on or after the end date for accepted bookings.
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endDate = new Date(booking.end_date);
  endDate.setHours(0, 0, 0, 0);
  const canComplete = isActive && today >= endDate;

  const renterName = `${booking.renter_first_name} ${booking.renter_last_name}`.trim();

  return (
    <article className="border-border-main bg-page flex gap-4 overflow-hidden rounded-xl border p-4">
      {/* Image */}
      <button
        type="button"
        className="size-20 flex-shrink-0 overflow-hidden rounded-lg p-0"
        onClick={() => navigate(`/product/${booking.item_id}`)}
        aria-label={`Abrir ${booking.item_title}`}
      >
        {booking.item_image_url ? (
          <img
            src={booking.item_image_url}
            alt={booking.item_title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="bg-primary-light h-full w-full" />
        )}
      </button>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex flex-wrap items-start justify-between gap-2">
          <button
            type="button"
            className="text-ink text-card-sm p-0 text-left font-semibold hover:underline"
            onClick={() => navigate(`/product/${booking.item_id}`)}
          >
            {booking.item_title}
          </button>
          <span
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${STATUS_CLASSES[booking.booking_status]}`}
          >
            {STATUS_LABELS[booking.booking_status]}
          </span>
        </div>

        {viewMode === "owner" && (
          <p className="text-subtle mb-1 flex items-center gap-1 text-[13px]">
            Solicitante:&nbsp;
            <span className="text-ink font-medium">{renterName}</span>
            {booking.renter_verification_status === "verified" && (
              <BadgeCheck
                size={14}
                className="text-primary shrink-0"
                aria-label="Perfil verificado"
              />
            )}
          </p>
        )}

        <div className="text-subtle flex items-center gap-1 text-[13px]">
          <CalendarDays size={12} />
          <span>
            {fmtDate(booking.start_date)} → {fmtDate(booking.end_date)}
          </span>
        </div>

        {booking.estimated_total !== null && (
          <p className="text-primary mt-1 text-[14px] font-bold">{fmtPrice(booking.estimated_total)} EUR</p>
        )}

        {booking.notes && <p className="text-subtle mt-1 line-clamp-1 text-[12px] italic">"{booking.notes}"</p>}

        {/* Actions */}
        <div className="mt-3 flex flex-wrap gap-2">
          {viewMode === "owner" && isPending && (
            <>
              <button
                type="button"
                className="btn-booking btn--sm flex-1"
                onClick={() => onAccept?.(booking.booking_id)}
                disabled={isBusy}
              >
                {isBusy ? "..." : "Aceptar"}
              </button>
              <button
                type="button"
                className="btn-secondary btn--sm flex-1"
                onClick={() => onReject?.(booking.booking_id)}
                disabled={isBusy}
              >
                {isBusy ? "..." : "Rechazar"}
              </button>
            </>
          )}
          {viewMode === "renter" && (isPending || isActive) && (
            <button
              type="button"
              className="btn-secondary btn--sm"
              onClick={() => onCancel?.(booking.booking_id)}
              disabled={isBusy}
            >
              {isBusy ? "..." : "Cancelar solicitud"}
            </button>
          )}
          {canComplete && (
            <button
              type="button"
              className="btn-secondary btn--sm"
              style={{ borderColor: "#15734f", color: "#15734f" }}
              onClick={() => onComplete?.(booking.booking_id)}
              disabled={isBusy}
            >
              {isBusy ? "..." : "Completar alquiler"}
            </button>
          )}
          <button
            type="button"
            className="btn-secondary btn--sm"
            onClick={() => onMessage?.(booking.item_id, viewMode === "owner" ? booking.renter_id : undefined)}
          >
            Enviar mensaje
          </button>
          {onReport && (
            <button
              type="button"
              className="btn-secondary btn--sm flex items-center gap-1.5 border-amber-200 text-amber-700 hover:bg-amber-50"
              onClick={() => onReport(booking)}
            >
              <AlertTriangle size={13} /> Reportar
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

// ── Tab panel ─────────────────────────────────────────────────────────────────

interface TabPanelProps {
  viewMode: "renter" | "owner";
  state: BookingsState;
  dispatch: React.Dispatch<BookingsAction>;
}

function TabPanel({ viewMode, state, dispatch }: TabPanelProps) {
  const navigate = useNavigate();
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");
  const [reportingBooking, setReportingBooking] = useState<BookingDetailResponse | null>(null);
  const [reportSuccess, setReportSuccess] = useState(false);

  async function handleAction(
    bookingId: string,
    action: "accept" | "reject" | "cancel" | "complete",
    nextStatus: BookingStatus
  ) {
    setActionLoading(bookingId);
    setActionError("");
    try {
      await patchBookingStatus(bookingId, action);
      dispatch({ type: "update_status", bookingId, status: nextStatus });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Error al actualizar la reserva");
    } finally {
      setActionLoading(null);
    }
  }

  if (state.loading) {
    return (
      <div className="profile-info-panel mt-4 flex min-h-36 items-center justify-center">
        <p className="text-subtle">Cargando reservas…</p>
      </div>
    );
  }

  if (state.error) {
    return (
      <p className="border-report bg-error-danger text-report mt-4 rounded-lg border p-3 text-[13px]">{state.error}</p>
    );
  }

  if (state.items.length === 0) {
    return (
      <div className="profile-info-panel mt-4 flex min-h-36 flex-col items-center justify-center gap-2 text-center">
        <Package
          size={32}
          className="text-subtle"
        />
        <p className="text-ink font-medium">
          {viewMode === "renter"
            ? "Todavía no has hecho ninguna reserva"
            : "Todavía no tienes reservas de tus artículos"}
        </p>
        <p className="text-subtle text-[13px]">
          {viewMode === "renter"
            ? "Explora artículos y solicita un alquiler."
            : "Cuando alguien solicite tus artículos aparecerán aquí."}
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-3">
      {actionError && (
        <p className="border-report bg-error-danger text-report rounded-lg border p-3 text-[13px]">{actionError}</p>
      )}
      {reportSuccess && (
        <p className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
          Incidencia enviada correctamente. El equipo la revisará pronto.
        </p>
      )}
      {state.items.map((booking) => (
        <BookingCard
          key={booking.booking_id}
          booking={booking}
          viewMode={viewMode}
          actionLoading={actionLoading}
          onAccept={(id) => void handleAction(id, "accept", "accepted")}
          onReject={(id) => void handleAction(id, "reject", "rejected")}
          onCancel={(id) => void handleAction(id, "cancel", "cancelled")}
          onComplete={(id) => void handleAction(id, "complete", "completed")}
          onReport={(b) => {
            setReportingBooking(b);
            setReportSuccess(false);
          }}
          onMessage={(itemId, withUserId) => {
            openConversation(itemId, withUserId)
              .then((convId) => navigate(`/chat/${convId}`))
              .catch((err: unknown) => {
                setActionError(err instanceof Error ? err.message : "Error al abrir el chat");
              });
          }}
        />
      ))}

      {reportingBooking && (
        <IncidentModal
          booking={reportingBooking}
          onClose={() => setReportingBooking(null)}
          onSuccess={() => {
            setReportingBooking(null);
            setReportSuccess(true);
          }}
        />
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

type Tab = "renter" | "owner";

/**
 * Bookings management page.
 * Shows two tabs: bookings made by the user as renter, and bookings received
 * as owner of a listing.
 *
 * @returns Bookings page JSX.
 */
function Bookings() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("renter");
  const [renterState, dispatchRenter] = useReducer(bookingsReducer, initialState);
  const [ownerState, dispatchOwner] = useReducer(bookingsReducer, initialState);

  const firstName = user?.first_name ?? "";

  // Load both lists on mount
  useEffect(() => {
    const controller = new AbortController();

    dispatchRenter({ type: "fetch_start" });
    fetchBookings("mine")
      .then((data) => dispatchRenter({ type: "fetch_success", payload: data }))
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        dispatchRenter({ type: "fetch_error", error: err instanceof Error ? err.message : "Error" });
      });

    dispatchOwner({ type: "fetch_start" });
    fetchBookings("as-owner")
      .then((data) => dispatchOwner({ type: "fetch_success", payload: data }))
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        dispatchOwner({ type: "fetch_error", error: err instanceof Error ? err.message : "Error" });
      });

    return () => controller.abort();
  }, []);

  const tabs: { id: Tab; label: string; count: number | null }[] = [
    {
      id: "renter",
      label: "Mis solicitudes",
      count: renterState.loading ? null : renterState.total,
    },
    {
      id: "owner",
      label: "Solicitudes recibidas",
      count: ownerState.loading ? null : ownerState.total,
    },
  ];

  return (
    <div className="bg-page min-h-screen">
      {/* Hero strip */}
      <section className="profile-hero h-auto min-h-28">
        <div className="mx-auto flex h-full max-w-340 flex-col justify-center gap-1 px-6 py-6 md:px-10">
          <p className="text-subtle text-[13px]">Hola, {firstName}</p>
          <h1 className="text-ink text-2xl font-bold">Mis reservas</h1>
          <p className="text-subtle text-[14px]">
            Gestiona tus solicitudes de alquiler como arrendatario y las de tus artículos como propietario.
          </p>
        </div>
      </section>

      <main className="mx-auto max-w-340 px-6 pt-8 pb-12 md:px-10">
        <div className="mx-auto max-w-3xl">
          {/* Tabs */}
          <div className="border-border-main flex border-b">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`flex items-center gap-2 border-b-2 px-4 py-3 text-[14px] font-medium transition-colors ${
                  activeTab === tab.id ? "border-primary text-primary" : "text-subtle hover:text-ink border-transparent"
                }`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
                {tab.count !== null && tab.count > 0 && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                      activeTab === tab.id ? "bg-primary-light text-primary" : "bg-border-main text-subtle"
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Tab content */}
          {activeTab === "renter" && (
            <TabPanel
              viewMode="renter"
              state={renterState}
              dispatch={dispatchRenter}
            />
          )}
          {activeTab === "owner" && (
            <TabPanel
              viewMode="owner"
              state={ownerState}
              dispatch={dispatchOwner}
            />
          )}

          {/* Link to explore */}
          {activeTab === "renter" && !renterState.loading && renterState.items.length === 0 && (
            <div className="mt-4 text-center">
              <a
                href="/search"
                className="text-primary inline-flex items-center gap-1 text-[14px] font-medium hover:underline"
              >
                Explorar artículos <ArrowRight size={14} />
              </a>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export { Bookings };
