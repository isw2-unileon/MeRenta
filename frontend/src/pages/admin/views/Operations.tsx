import { useCallback, useEffect, useReducer, useState } from "react";
import { CalendarDays, ImageIcon, MoreHorizontal, Search } from "lucide-react";

import type { BookingDetailResponse, BookingListResponse, BookingStatus } from "@/types/booking";
import { getAdminData, sendAdminMutation } from "@/components/admin/adminApi";
import { fmtDate, fmtPrice } from "@/components/admin/adminFormat";
import {
  Badge,
  Card,
  ConfirmModal,
  Dropdown,
  FilterPills,
  Pagination,
  SectionTitle,
  TableSkeleton,
} from "@/components/admin/adminUi";

// ── Constants ─────────────────────────────────────────────────────────────────

const LIMIT = 20;

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

/** Returns the renter's full name, or a short ID fallback. */
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

/** Reduces booking-list fetch and optimistic status-patch actions. */
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

/** Fetches a page of bookings filtered by status/search and sorted as requested. */
function fetchBookings(status: string, query: string, sort: string, page: number): Promise<BookingListResponse> {
  const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
  if (status) params.set("status", status);
  if (query) params.set("q", query);
  if (sort && sort !== "recent") params.set("sort", sort);
  return getAdminData<BookingListResponse>(`/api/admin/bookings?${params.toString()}`, "Error al cargar operaciones");
}

/** Sets a booking's status via the admin override endpoint. */
function patchAdminBookingStatus(bookingId: string, status: BookingStatus): Promise<void> {
  return sendAdminMutation(
    `/api/admin/bookings/${bookingId}/status`,
    "PATCH",
    { status },
    "Error al actualizar el estado"
  );
}

// ── StatusMenu ────────────────────────────────────────────────────────────────

interface StatusMenuProps {
  booking: BookingDetailResponse;
  onUpdate: (bookingId: string, status: BookingStatus) => void;
}

/**
 * Three-dot dropdown that shows allowed next states for a booking.
 * Returns null for terminal statuses (rejected, canceled, completed).
 */
function StatusMenu({ booking, onUpdate }: StatusMenuProps) {
  const options = ADMIN_NEXT[booking.booking_status] ?? [];
  if (options.length === 0) return null;

  return (
    <Dropdown
      ariaLabel={`Cambiar estado de la reserva ${booking.booking_id.slice(0, 8)}`}
      button={<MoreHorizontal size={16} />}
    >
      {(close) =>
        options.map((next) => (
          <button
            key={next}
            type="button"
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-50"
            onClick={() => {
              onUpdate(booking.booking_id, next);
              close();
            }}
          >
            {NEXT_LABELS[next]}
          </button>
        ))
      }
    </Dropdown>
  );
}

// ── Small helpers ─────────────────────────────────────────────────────────────

/** Booking item thumbnail, with a placeholder when no image exists. */
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

/** Renders a "start → end" date range with a calendar icon. */
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
        <FilterPills
          options={FILTER_OPTIONS}
          value={filters.status}
          onChange={handleStatusFilter}
        />

        {/* Sort + search */}
        <div className="flex items-center gap-2">
          <select
            value={filters.sort}
            onChange={(e) => handleSort(e.target.value)}
            aria-label="Ordenar reservas"
            className="h-auto w-auto rounded-lg border border-neutral-200 py-2 pr-9 pl-3 text-sm text-neutral-600 focus:border-emerald-500"
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
              {loading && (
                <TableSkeleton
                  rows={6}
                  cols={7}
                />
              )}

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
        {!loading && (
          <Pagination
            page={filters.page}
            total={total}
            limit={LIMIT}
            onPage={handlePage}
          />
        )}
      </Card>
    </div>
  );
}

export { Operations };
