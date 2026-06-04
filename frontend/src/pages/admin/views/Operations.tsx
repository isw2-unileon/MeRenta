import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { CalendarDays, ChevronDown, ImageIcon, MoreHorizontal, Search } from "lucide-react";

import type { ApiResponse } from "@/types/common";
import type { BookingDetailResponse, BookingListResponse, BookingStatus } from "@/types/booking";
import { GREEN } from "@/pages/admin/components/adminTokens";
import { Badge, Card, ConfirmModal, SectionTitle } from "@/pages/admin/components/adminUi";

// ── Constants ─────────────────────────────────────────────────────────────────

const LIMIT = 20;

const EUR_FORMAT = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 2,
});

const STATUS_LABELS: Record<BookingStatus, string> = {
  pending: "pendiente",
  accepted: "aceptada",
  rejected: "rechazada",
  cancelled: "cancelada",
  completed: "completada",
};

const STATUS_BADGE_COLORS: Record<BookingStatus, "green" | "gray" | "amber" | "red" | "blue"> = {
  pending: "amber",
  accepted: "green",
  rejected: "red",
  cancelled: "gray",
  completed: "blue",
};

const FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Todas" },
  { value: "pending", label: "Pendientes" },
  { value: "accepted", label: "Aceptadas" },
  { value: "completed", label: "Completadas" },
  { value: "rejected", label: "Rechazadas" },
  { value: "cancelled", label: "Canceladas" },
];

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: "recent", label: "Más reciente" },
  { value: "oldest", label: "Más antiguo" },
  { value: "amount_desc", label: "Importe ↓" },
  { value: "amount_asc", label: "Importe ↑" },
];

// Next states an admin may set per current booking status (terminal = no options).
const ADMIN_NEXT: Partial<Record<BookingStatus, BookingStatus[]>> = {
  pending: ["accepted", "rejected", "cancelled"],
  accepted: ["completed", "cancelled"],
};

const NEXT_LABELS: Partial<Record<BookingStatus, string>> = {
  accepted: "Aceptar",
  rejected: "Rechazar",
  cancelled: "Cancelar",
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
  const name = `${b.renter_first_name} ${b.renter_last_name}`.trim();
  return name || b.renter_id.slice(0, 8);
}

// ── Reducer ───────────────────────────────────────────────────────────────────

interface OperationsState {
  bookings: BookingDetailResponse[];
  total: number;
  loading: boolean;
  error: string | null;
}

type OperationsAction =
  | { type: "fetch_start" }
  | { type: "fetch_success"; bookings: BookingDetailResponse[]; total: number }
  | { type: "fetch_error"; error: string }
  | { type: "patch_status"; bookingId: string; status: BookingStatus };

const initialState: OperationsState = { bookings: [], total: 0, loading: true, error: null };

function operationsReducer(state: OperationsState, action: OperationsAction): OperationsState {
  switch (action.type) {
    case "fetch_start":
      return { ...state, loading: true, error: null };
    case "fetch_success":
      return { bookings: action.bookings, total: action.total, loading: false, error: null };
    case "fetch_error":
      return { ...state, loading: false, error: action.error };
    case "patch_status":
      return {
        ...state,
        bookings: state.bookings.map((b) =>
          b.booking_id === action.bookingId ? { ...b, booking_status: action.status } : b
        ),
      };
  }
}

// ── API ───────────────────────────────────────────────────────────────────────

async function fetchBookings(status: string, query: string, sort: string, page: number): Promise<BookingListResponse> {
  const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
  if (status) params.set("status", status);
  if (query) params.set("q", query);
  if (sort && sort !== "recent") params.set("sort", sort);
  const res = await fetch(`/api/admin/bookings?${params.toString()}`, { credentials: "include" });
  const json = (await res.json()) as ApiResponse<BookingListResponse>;
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.error ?? "Error al cargar operaciones");
  }
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
  if (!res.ok || !json.success) {
    throw new Error(json.error ?? "Error al actualizar el estado");
  }
}

// ── StatusMenu ────────────────────────────────────────────────────────────────

interface StatusMenuProps {
  booking: BookingDetailResponse;
  onUpdate: (bookingId: string, status: BookingStatus) => void;
}

/**
 * Three-dot dropdown that shows allowed next states for a booking.
 * Returns null for terminal statuses (rejected, cancelled, completed).
 */
function StatusMenu({ booking, onUpdate }: StatusMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [open]);

  const options = ADMIN_NEXT[booking.booking_status] ?? [];
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
        aria-label={`Cambiar estado de la reserva ${booking.booking_id.slice(0, 8)}`}
      >
        <MoreHorizontal size={16} />
      </button>

      {open && (
        <div className="absolute right-0 z-10 mt-1 w-36 rounded-lg border border-neutral-200 bg-white py-1 shadow-md">
          {options.map((next) => (
            <button
              key={next}
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-50"
              onClick={() => {
                onUpdate(booking.booking_id, next);
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

// ── Small helpers ─────────────────────────────────────────────────────────────

function BookingThumb({ booking }: { booking: BookingDetailResponse }) {
  if (!booking.item_image_url) {
    return (
      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-400">
        <ImageIcon size={16} />
      </div>
    );
  }
  return (
    <img
      src={booking.item_image_url}
      alt=""
      className="size-10 shrink-0 rounded-lg object-cover"
      loading="lazy"
    />
  );
}

function DateRange({ start, end }: { start: string; end: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-neutral-600">
      <CalendarDays
        size={13}
        className="shrink-0 text-neutral-400"
      />
      {fmtDate(start)}
      <span className="text-neutral-300">→</span>
      {fmtDate(end)}
    </span>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────

/**
 * Admin operations view — paginated table of all rental bookings.
 * Supports: status filter pills, free-text search (product / renter),
 * sort by date or amount, and inline admin status-change via dropdown.
 */
function Operations() {
  const [state, dispatch] = useReducer(operationsReducer, initialState);
  const [rawQuery, setRawQuery] = useState("");
  const [filters, setFilters] = useState({ status: "", query: "", sort: "recent", page: 1 });
  const [pending, setPending] = useState<{ bookingId: string; status: BookingStatus; itemTitle: string } | null>(null);

  // Debounce search — 300 ms
  useEffect(() => {
    const id = setTimeout(() => {
      setFilters((f) => ({ ...f, query: rawQuery.trim(), page: 1 }));
    }, 300);
    return () => clearTimeout(id);
  }, [rawQuery]);

  // Fetch when filters change
  useEffect(() => {
    dispatch({ type: "fetch_start" });
    fetchBookings(filters.status, filters.query, filters.sort, filters.page)
      .then((data) => dispatch({ type: "fetch_success", bookings: data.items, total: data.total }))
      .catch((err: unknown) =>
        dispatch({ type: "fetch_error", error: err instanceof Error ? err.message : "Error desconocido" })
      );
  }, [filters]);

  // Open confirmation modal
  const handleStatusUpdate = useCallback(
    (bookingId: string, status: BookingStatus) => {
      const book = state.bookings.find((b) => b.booking_id === bookingId);
      setPending({ bookingId, status, itemTitle: book?.item_title ?? bookingId.slice(0, 8) });
    },
    [state.bookings]
  );

  // Execute after confirmation — optimistic, reverts on error
  const handleConfirm = useCallback(async () => {
    if (!pending) return;
    const { bookingId, status } = pending;
    setPending(null);
    dispatch({ type: "patch_status", bookingId, status });
    try {
      await patchAdminBookingStatus(bookingId, status);
    } catch {
      dispatch({ type: "fetch_start" });
      fetchBookings(filters.status, filters.query, filters.sort, filters.page)
        .then((data) => dispatch({ type: "fetch_success", bookings: data.items, total: data.total }))
        .catch((err: unknown) =>
          dispatch({ type: "fetch_error", error: err instanceof Error ? err.message : "Error" })
        );
    }
  }, [pending, filters]);

  function handleStatusFilter(value: string) {
    setFilters((f) => ({ ...f, status: value, page: 1 }));
  }

  function handleSort(value: string) {
    setFilters((f) => ({ ...f, sort: value, page: 1 }));
  }

  function handlePage(page: number) {
    setFilters((f) => ({ ...f, page }));
  }

  const { bookings, total, loading, error } = state;
  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  return (
    <div className="space-y-4">
      {pending && (
        <ConfirmModal
          message={`¿Cambiar el estado de «${pending.itemTitle}» a ${pending.status}?`}
          dangerous={pending.status === "cancelled" || pending.status === "rejected"}
          onConfirm={() => void handleConfirm()}
          onCancel={() => setPending(null)}
        />
      )}

      {/* ── Filter bar ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Status pills */}
        <div className="flex flex-wrap gap-2">
          {FILTER_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => handleStatusFilter(value)}
              className="rounded-full border px-3.5 py-1.5 text-sm font-medium transition"
              style={
                filters.status === value
                  ? { backgroundColor: GREEN, color: "#fff", borderColor: GREEN }
                  : { borderColor: "#e5e7eb", color: "#525252" }
              }
            >
              {label}
            </button>
          ))}
        </div>

        {/* Sort + search */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <select
              value={filters.sort}
              onChange={(e) => handleSort(e.target.value)}
              aria-label="Ordenar reservas"
              className="appearance-none rounded-lg border border-neutral-200 py-2 pr-8 pl-3 text-sm text-neutral-600 outline-none focus:border-emerald-500"
            >
              {SORT_OPTIONS.map(({ value, label }) => (
                <option
                  key={value}
                  value={value}
                >
                  {label}
                </option>
              ))}
            </select>
            <ChevronDown
              size={13}
              className="pointer-events-none absolute top-2.5 right-2.5 text-neutral-400"
            />
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
      </div>

      {/* ── Table ── */}
      <Card className="overflow-hidden">
        <div className="border-b border-neutral-100 px-5 py-4">
          <SectionTitle
            title="Operaciones de alquiler"
            sub={loading ? "Cargando..." : `${total.toLocaleString("es-ES")} reservas en total`}
          />
        </div>

        {error && <p className="px-5 py-4 text-sm text-red-600">{error}</p>}

        {!error && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-100 text-left text-xs text-neutral-400">
                <th className="px-5 py-3 font-medium">Producto</th>
                <th className="hidden px-5 py-3 font-medium md:table-cell">Arrendatario</th>
                <th className="hidden px-5 py-3 font-medium lg:table-cell">Periodo</th>
                <th className="px-5 py-3 font-medium">Estado</th>
                <th className="hidden px-5 py-3 font-medium xl:table-cell">Importe</th>
                <th className="hidden px-5 py-3 font-medium xl:table-cell">Solicitada</th>
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
                bookings.map((b) => (
                  <tr
                    key={b.booking_id}
                    className="border-b border-neutral-50 hover:bg-neutral-50"
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex min-w-0 items-center gap-3">
                        <BookingThumb booking={b} />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-neutral-900">{b.item_title}</p>
                          <p className="font-mono text-[10px] text-neutral-400">#{b.booking_id.slice(0, 8)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="hidden px-5 py-3.5 text-neutral-600 md:table-cell">{renterName(b)}</td>
                    <td className="hidden px-5 py-3.5 lg:table-cell">
                      <DateRange
                        start={b.start_date}
                        end={b.end_date}
                      />
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge color={STATUS_BADGE_COLORS[b.booking_status]}>{STATUS_LABELS[b.booking_status]}</Badge>
                    </td>
                    <td className="hidden px-5 py-3.5 font-medium text-neutral-700 xl:table-cell">
                      {fmtPrice(b.estimated_total)}
                    </td>
                    <td className="hidden px-5 py-3.5 text-neutral-500 xl:table-cell">{fmtDate(b.requested_at)}</td>
                    <td className="px-5 py-3.5 text-right">
                      <StatusMenu
                        booking={b}
                        onUpdate={handleStatusUpdate}
                      />
                    </td>
                  </tr>
                ))}

              {!loading && bookings.length === 0 && !error && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-5 py-10 text-center text-sm text-neutral-400"
                  >
                    No se encontraron operaciones.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}

        {/* ── Pagination ── */}
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
    </div>
  );
}

export { Operations };
