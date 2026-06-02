import { useEffect, useReducer, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarDays, Package, ArrowRight } from "lucide-react";

import { useAuth } from "@/hooks/useAuth";
import type { ApiResponse } from "@/types/common";
import type { BookingDetailResponse, BookingListResponse, BookingStatus } from "@/types/booking";

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

async function patchBookingStatus(bookingId: string, action: "accept" | "reject" | "cancel"): Promise<void> {
  const res = await fetch(`/api/bookings/${bookingId}/${action}`, {
    method: "PATCH",
    credentials: "include",
  });
  const json = (await res.json()) as ApiResponse<unknown>;
  if (!res.ok || !json.success) {
    throw new Error(json.error ?? "Error al actualizar la reserva");
  }
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
  /** Called with itemId and, for owner view, the renter's userId. */
  onMessage?: (itemId: string, withUserId?: string) => void;
  actionLoading: string | null;
}

function BookingCard({ booking, viewMode, onAccept, onReject, onCancel, onMessage, actionLoading }: BookingCardProps) {
  const navigate = useNavigate();
  const isPending = booking.booking_status === "pending";
  const isActive = booking.booking_status === "accepted";
  const isBusy = actionLoading === booking.booking_id;

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
          <p className="text-subtle mb-1 text-[13px]">
            Solicitante: <span className="text-ink font-medium">{renterName}</span>
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
          <button
            type="button"
            className="btn-secondary btn--sm"
            onClick={() => onMessage?.(booking.item_id, viewMode === "owner" ? booking.renter_id : undefined)}
          >
            Enviar mensaje
          </button>
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

  async function handleAction(bookingId: string, action: "accept" | "reject" | "cancel", nextStatus: BookingStatus) {
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
      {state.items.map((booking) => (
        <BookingCard
          key={booking.booking_id}
          booking={booking}
          viewMode={viewMode}
          actionLoading={actionLoading}
          onAccept={(id) => void handleAction(id, "accept", "accepted")}
          onReject={(id) => void handleAction(id, "reject", "rejected")}
          onCancel={(id) => void handleAction(id, "cancel", "cancelled")}
          onMessage={(itemId, withUserId) => {
            openConversation(itemId, withUserId)
              .then((convId) => navigate(`/chat/${convId}`))
              .catch((err: unknown) => {
                setActionError(err instanceof Error ? err.message : "Error al abrir el chat");
              });
          }}
        />
      ))}
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
