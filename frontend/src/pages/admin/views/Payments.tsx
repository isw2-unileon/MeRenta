import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { ExternalLink, ImageIcon, MoreHorizontal, Search } from "lucide-react";

import type { ApiResponse } from "@/types/common";
import type { BookingDetailResponse, BookingListResponse, BookingStatus } from "@/types/booking";
import { GREEN } from "@/components/admin/adminTokens";
import { Badge, Card, ConfirmModal, SectionTitle } from "@/components/admin/adminUi";

// ── Constants ─────────────────────────────────────────────────────────────────

const LIMIT = 20;

const EUR_FORMAT = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 2,
});

const REFUNDED_STATUSES: BookingStatus[] = ["cancelled", "rejected"];

const FILTER_OPTIONS = [
  { value: "", label: "Todos" },
  { value: "paid", label: "Cobrados" },
  { value: "refunded", label: "Reembolsados" },
] as const;

const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  pending: "pendiente",
  accepted: "aceptada",
  rejected: "rechazada",
  cancelled: "cancelada",
  completed: "completada",
};

// Admin-allowed next states per current status.
// Cancelling/rejecting a paid booking triggers an automatic Stripe refund.
const ADMIN_NEXT: Partial<Record<BookingStatus, BookingStatus[]>> = {
  pending: ["accepted", "rejected", "cancelled"],
  accepted: ["completed", "cancelled"],
};

const NEXT_LABELS: Partial<Record<BookingStatus, string>> = {
  accepted: "Aceptar",
  rejected: "Rechazar",
  cancelled: "Cancelar y reembolsar",
  completed: "Completar",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
}

function fmtPrice(value: number | null): string {
  if (value === null) return "—";
  return EUR_FORMAT.format(value);
}

function renterName(b: BookingDetailResponse): string {
  return `${b.renter_first_name} ${b.renter_last_name}`.trim() || b.renter_id.slice(0, 8);
}

function isRefunded(b: BookingDetailResponse): boolean {
  return REFUNDED_STATUSES.includes(b.booking_status);
}

function stripeUrl(id: string): string {
  return `https://dashboard.stripe.com/payments/${id}`;
}

function confirmMsg(next: BookingStatus, item: string): string {
  if (next === "cancelled") return `¿Cancelar la reserva de «${item}» y emitir el reembolso a Stripe?`;
  if (next === "rejected") return `¿Rechazar la reserva de «${item}» y emitir el reembolso a Stripe?`;
  if (next === "accepted") return `¿Aceptar la reserva de «${item}»?`;
  if (next === "completed") return `¿Marcar la reserva de «${item}» como completada?`;
  return `¿Cambiar el estado de «${item}» a ${next}?`;
}

// ── Reducer ───────────────────────────────────────────────────────────────────

interface PaymentsState {
  payments: BookingDetailResponse[];
  total: number;
  loading: boolean;
  error: string | null;
}

type PaymentsAction =
  | { type: "fetch_start" }
  | { type: "fetch_success"; payments: BookingDetailResponse[]; total: number }
  | { type: "fetch_error"; error: string }
  | { type: "patch_status"; bookingId: string; status: BookingStatus };

const initialState: PaymentsState = { payments: [], total: 0, loading: true, error: null };

function paymentsReducer(state: PaymentsState, action: PaymentsAction): PaymentsState {
  switch (action.type) {
    case "fetch_start":
      return { ...state, loading: true, error: null };
    case "fetch_success":
      return { payments: action.payments, total: action.total, loading: false, error: null };
    case "fetch_error":
      return { ...state, loading: false, error: action.error };
    case "patch_status":
      return {
        ...state,
        payments: state.payments.map((p) =>
          p.booking_id === action.bookingId ? { ...p, booking_status: action.status } : p
        ),
      };
  }
}

// ── API ───────────────────────────────────────────────────────────────────────

async function fetchPayments(paymentStatus: string, query: string, page: number): Promise<BookingListResponse> {
  const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
  if (paymentStatus) params.set("payment_status", paymentStatus);
  if (query) params.set("q", query);
  const res = await fetch(`/api/admin/payments?${params.toString()}`, { credentials: "include" });
  const json = (await res.json()) as ApiResponse<BookingListResponse>;
  if (!res.ok || !json.success || !json.data) throw new Error(json.error ?? "Error al cargar transacciones");
  return json.data;
}

async function patchAdminBookingStatus(bookingId: string, status: BookingStatus): Promise<void> {
  const res = await fetch(`/api/admin/bookings/${bookingId}/status`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  const json = (await res.json()) as ApiResponse<unknown>;
  if (!res.ok || !json.success) throw new Error(json.error ?? "Error al actualizar el estado");
}

// ── StatusMenu ────────────────────────────────────────────────────────────────

interface StatusMenuProps {
  payment: BookingDetailResponse;
  onRequest: (bookingId: string, status: BookingStatus) => void;
}

function StatusMenu({ payment, onRequest }: StatusMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const options = ADMIN_NEXT[payment.booking_status] ?? [];
  if (options.length === 0) return null;

  return (
    <div
      className="relative"
      ref={ref}
    >
      <button
        type="button"
        className="rounded p-1 text-neutral-400 hover:text-neutral-700"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Acciones para ${payment.item_title}`}
      >
        <MoreHorizontal size={16} />
      </button>
      {open && (
        <div className="absolute right-0 z-10 mt-1 w-44 rounded-lg border border-neutral-200 bg-white py-1 shadow-md">
          {options.map((next) => (
            <button
              key={next}
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-50"
              onClick={() => {
                onRequest(payment.booking_id, next);
                setOpen(false);
              }}
            >
              {NEXT_LABELS[next]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────

/**
 * Admin transactions view — paginated list of all Stripe charges.
 * Admins can change booking status; cancellation/rejection triggers a Stripe refund.
 * A confirmation popup is shown before every status change.
 */
function Payments() {
  const [state, dispatch] = useReducer(paymentsReducer, initialState);
  const [rawQuery, setRawQuery] = useState("");
  const [filters, setFilters] = useState({ paymentStatus: "", query: "", page: 1 });
  const [pending, setPending] = useState<{ bookingId: string; status: BookingStatus; itemTitle: string } | null>(null);

  useEffect(() => {
    const id = setTimeout(() => setFilters((f) => ({ ...f, query: rawQuery.trim(), page: 1 })), 300);
    return () => clearTimeout(id);
  }, [rawQuery]);

  useEffect(() => {
    dispatch({ type: "fetch_start" });
    fetchPayments(filters.paymentStatus, filters.query, filters.page)
      .then((data) => dispatch({ type: "fetch_success", payments: data.items, total: data.total }))
      .catch((err: unknown) =>
        dispatch({ type: "fetch_error", error: err instanceof Error ? err.message : "Error desconocido" })
      );
  }, [filters]);

  const handleConfirm = useCallback(async () => {
    if (!pending) return;
    const { bookingId, status } = pending;
    setPending(null);
    dispatch({ type: "patch_status", bookingId, status });
    try {
      await patchAdminBookingStatus(bookingId, status);
    } catch {
      dispatch({ type: "fetch_start" });
      fetchPayments(filters.paymentStatus, filters.query, filters.page)
        .then((data) => dispatch({ type: "fetch_success", payments: data.items, total: data.total }))
        .catch((err: unknown) =>
          dispatch({ type: "fetch_error", error: err instanceof Error ? err.message : "Error" })
        );
    }
  }, [pending, filters]);

  function handleFilter(value: string) {
    setFilters({ paymentStatus: value, query: rawQuery.trim(), page: 1 });
  }

  function handlePage(page: number) {
    setFilters((f) => ({ ...f, page }));
  }

  const { payments, total, loading, error } = state;
  const totalPages = Math.max(1, Math.ceil(total / LIMIT));
  const isDangerous = pending?.status === "cancelled" || pending?.status === "rejected";

  return (
    <div className="space-y-4">
      {pending && (
        <ConfirmModal
          message={confirmMsg(pending.status, pending.itemTitle)}
          confirmLabel={isDangerous ? "Cancelar y reembolsar" : "Confirmar"}
          dangerous={isDangerous}
          onConfirm={() => void handleConfirm()}
          onCancel={() => setPending(null)}
        />
      )}

      {/* Filter bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {FILTER_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => handleFilter(value)}
              className="rounded-full border px-3.5 py-1.5 text-sm font-medium transition"
              style={
                filters.paymentStatus === value
                  ? { backgroundColor: GREEN, color: "#fff", borderColor: GREEN }
                  : { borderColor: "#e5e7eb", color: "#525252" }
              }
            >
              {label}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search
            size={15}
            className="absolute top-2.5 left-3 text-neutral-400"
          />
          <input
            value={rawQuery}
            onChange={(e) => setRawQuery(e.target.value)}
            placeholder="Producto o arrendatario..."
            aria-label="Buscar por producto o arrendatario"
            className="w-56 rounded-lg border border-neutral-200 py-2 pr-3 pl-9 text-sm outline-none focus:border-emerald-500"
          />
        </div>
      </div>

      {!loading && !error && payments.length === 0 && (
        <Card className="py-16 text-center">
          <p className="text-2xl">💳</p>
          <p className="mt-2 text-sm text-neutral-500">No hay transacciones con estos filtros.</p>
        </Card>
      )}

      {(loading || payments.length > 0) && (
        <Card className="overflow-hidden">
          <div className="border-b border-neutral-100 px-5 py-4">
            <SectionTitle
              title="Historial de transacciones"
              sub={loading ? "Cargando..." : `${total.toLocaleString("es-ES")} transacciones`}
            />
          </div>

          {error && <p className="px-5 py-4 text-sm text-red-600">{error}</p>}

          {!error && (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-100 text-left text-xs text-neutral-400">
                  <th className="px-5 py-3 font-medium">Reserva</th>
                  <th className="hidden px-5 py-3 font-medium md:table-cell">Arrendatario</th>
                  <th className="px-5 py-3 font-medium">Importe</th>
                  <th className="px-5 py-3 font-medium">Pago</th>
                  <th className="hidden px-5 py-3 font-medium lg:table-cell">Estado reserva</th>
                  <th className="hidden px-5 py-3 font-medium xl:table-cell">Fecha</th>
                  <th className="px-5 py-3">
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading &&
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr
                      key={i}
                      className="border-b border-neutral-50"
                    >
                      {Array.from({ length: 7 }).map((__, j) => (
                        <td
                          key={j}
                          aria-label="Cargando"
                          className="px-5 py-4"
                        >
                          <div
                            aria-hidden="true"
                            className="h-4 w-24 animate-pulse rounded bg-neutral-100"
                          />
                        </td>
                      ))}
                    </tr>
                  ))}

                {!loading &&
                  payments.map((p) => {
                    const refunded = isRefunded(p);
                    return (
                      <tr
                        key={p.booking_id}
                        className="border-b border-neutral-50 hover:bg-neutral-50"
                      >
                        <td className="px-5 py-3.5">
                          <div className="flex min-w-0 items-center gap-3">
                            {p.item_image_url ? (
                              <img
                                src={p.item_image_url}
                                alt=""
                                className="size-10 shrink-0 rounded-lg object-cover"
                                loading="lazy"
                              />
                            ) : (
                              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-400">
                                <ImageIcon size={16} />
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="truncate font-medium text-neutral-900">{p.item_title}</p>
                              <p className="font-mono text-[10px] text-neutral-400">#{p.booking_id.slice(0, 8)}</p>
                            </div>
                          </div>
                        </td>
                        <td className="hidden px-5 py-3.5 text-neutral-600 md:table-cell">{renterName(p)}</td>
                        <td className="px-5 py-3.5 font-medium">
                          {refunded ? (
                            <span className="text-neutral-400 line-through">{fmtPrice(p.estimated_total)}</span>
                          ) : (
                            <span className="text-neutral-800">{fmtPrice(p.estimated_total)}</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          <Badge color={refunded ? "gray" : "green"}>{refunded ? "Reembolsado" : "Cobrado"}</Badge>
                        </td>
                        <td className="hidden px-5 py-3.5 lg:table-cell">
                          <Badge color="gray">{BOOKING_STATUS_LABELS[p.booking_status]}</Badge>
                        </td>
                        <td className="hidden px-5 py-3.5 text-neutral-500 xl:table-cell">{fmtDate(p.requested_at)}</td>
                        <td className="px-5 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <StatusMenu
                              payment={p}
                              onRequest={(bookingId, status) =>
                                setPending({ bookingId, status, itemTitle: p.item_title })
                              }
                            />
                            {p.payment_intent_id && (
                              <a
                                href={stripeUrl(p.payment_intent_id)}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label="Ver en Stripe"
                                className="rounded p-1 text-neutral-400 hover:text-neutral-700"
                              >
                                <ExternalLink size={15} />
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          )}

          {totalPages > 1 && !loading && (
            <div className="flex items-center justify-between border-t border-neutral-100 px-5 py-3 text-sm text-neutral-500">
              <span>
                {(filters.page - 1) * LIMIT + 1}–{Math.min(filters.page * LIMIT, total)} de{" "}
                {total.toLocaleString("es-ES")}
              </span>
              <div className="flex gap-1">
                <button
                  type="button"
                  disabled={filters.page <= 1}
                  onClick={() => handlePage(filters.page - 1)}
                  aria-label="Página anterior"
                  className="rounded px-2 py-1 hover:bg-neutral-50 disabled:opacity-40"
                >
                  Anterior
                </button>
                <button
                  type="button"
                  disabled={filters.page >= totalPages}
                  onClick={() => handlePage(filters.page + 1)}
                  aria-label="Página siguiente"
                  className="rounded px-2 py-1 hover:bg-neutral-50 disabled:opacity-40"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

export { Payments };
