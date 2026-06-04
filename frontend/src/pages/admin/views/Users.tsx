import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { Check, MoreHorizontal, Search, X } from "lucide-react";

import type { ApiResponse } from "@/types/common";
import type { AccountStatus } from "@/types/customer";
import type { AdminUser, AdminUserListResponse } from "@/types/admin";
import { GREEN } from "@/components/admin/adminTokens";
import { Avatar, Badge, Card, SectionTitle } from "@/components/admin/adminUi";

// ── Constants ─────────────────────────────────────────────────────────────────

const LIMIT = 20;

const STATUS_LABELS: Record<AccountStatus, string> = {
  active: "activo",
  suspended: "suspendido",
  banned: "bloqueado",
};

const STATUS_BADGE_COLORS: Record<AccountStatus, "green" | "gray" | "amber" | "red"> = {
  active: "green",
  suspended: "amber",
  banned: "red",
};

const NEXT_STATUSES: Record<AccountStatus, AccountStatus[]> = {
  active: ["suspended", "banned"],
  suspended: ["active", "banned"],
  banned: ["active"],
};

const NEXT_STATUS_LABELS: Record<AccountStatus, string> = {
  active: "Activar",
  suspended: "Suspender",
  banned: "Bloquear",
};

const FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Todos" },
  { value: "active", label: "Activos" },
  { value: "suspended", label: "Suspendidos" },
  { value: "banned", label: "Bloqueados" },
];

// ── Pure helpers (module scope) ───────────────────────────────────────────────

function fmtDate(iso: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function userInitials(u: AdminUser): string {
  return `${u.first_name[0] ?? ""}${u.last_name[0] ?? ""}`.toUpperCase();
}

// ── Reducer ───────────────────────────────────────────────────────────────────

interface UsersState {
  users: AdminUser[];
  total: number;
  loading: boolean;
  error: string | null;
}

type UsersAction =
  | { type: "fetch_start" }
  | { type: "fetch_success"; users: AdminUser[]; total: number }
  | { type: "fetch_error"; error: string }
  | { type: "patch_status"; customerId: string; status: AccountStatus };

const initialState: UsersState = { users: [], total: 0, loading: true, error: null };

function usersReducer(state: UsersState, action: UsersAction): UsersState {
  switch (action.type) {
    case "fetch_start":
      return { ...state, loading: true, error: null };
    case "fetch_success":
      return { loading: false, error: null, users: action.users, total: action.total };
    case "fetch_error":
      return { ...state, loading: false, error: action.error };
    case "patch_status":
      return {
        ...state,
        users: state.users.map((u) =>
          u.customer_id === action.customerId ? { ...u, account_status: action.status } : u
        ),
      };
  }
}

// ── API helpers ───────────────────────────────────────────────────────────────

async function fetchUsers(query: string, status: string, page: number): Promise<AdminUserListResponse> {
  const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
  if (query) params.set("q", query);
  if (status) params.set("status", status);

  const res = await fetch(`/api/admin/users?${params.toString()}`, { credentials: "include" });
  const json = (await res.json()) as ApiResponse<AdminUserListResponse>;
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.error ?? "Error al cargar usuarios");
  }
  return json.data;
}

async function updateStatus(customerId: string, status: AccountStatus, suspendedUntil?: string): Promise<void> {
  const body: { status: string; suspended_until?: string } = { status };
  if (suspendedUntil) body.suspended_until = suspendedUntil;

  const res = await fetch(`/api/admin/users/${customerId}/status`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as ApiResponse<unknown>;
  if (!res.ok || !json.success) {
    throw new Error(json.error ?? "Error al actualizar el estado");
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface StatusMenuProps {
  user: AdminUser;
  onUpdate: (customerId: string, status: AccountStatus, suspendedUntil?: string) => void;
}

/**
 * Dropdown menu for changing a user's account status.
 * Shows an inline date picker when "suspended" is selected.
 */
function StatusMenu({ user, onUpdate }: StatusMenuProps) {
  const [open, setOpen] = useState(false);
  const [pickingSuspend, setPickingSuspend] = useState(false);
  const [suspendDate, setSuspendDate] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setPickingSuspend(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const options = NEXT_STATUSES[user.account_status];
  const todayStr = new Date().toISOString().slice(0, 10);

  function handleOptionClick(next: AccountStatus) {
    if (next === "suspended") {
      setPickingSuspend(true);
      return;
    }
    onUpdate(user.customer_id, next);
    setOpen(false);
  }

  function handleConfirmSuspend() {
    if (!suspendDate) return;
    const until = new Date(suspendDate + "T23:59:59Z").toISOString();
    onUpdate(user.customer_id, "suspended", until);
    setOpen(false);
    setPickingSuspend(false);
    setSuspendDate("");
  }

  return (
    <div
      className="relative"
      ref={ref}
    >
      <button
        type="button"
        className="rounded p-1 text-neutral-400 hover:text-neutral-700"
        onClick={() => {
          setOpen((v) => !v);
          setPickingSuspend(false);
        }}
        aria-label={`Acciones para ${user.first_name} ${user.last_name}`}
      >
        <MoreHorizontal size={16} />
      </button>

      {open && !pickingSuspend && (
        <div className="absolute right-0 z-10 mt-1 w-36 rounded-lg border border-neutral-200 bg-white py-1 shadow-md">
          {options.map((next) => (
            <button
              key={next}
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-50"
              onClick={() => handleOptionClick(next)}
            >
              {NEXT_STATUS_LABELS[next]}
            </button>
          ))}
        </div>
      )}

      {open && pickingSuspend && (
        <div className="absolute right-0 z-10 mt-1 w-56 rounded-lg border border-neutral-200 bg-white p-3 shadow-md">
          <label
            htmlFor="suspend-date"
            className="mb-2 block text-xs font-medium text-neutral-600"
          >
            Suspender hasta:
          </label>
          <input
            id="suspend-date"
            type="date"
            min={todayStr}
            value={suspendDate}
            onChange={(e) => setSuspendDate(e.target.value)}
            className="w-full rounded border border-neutral-200 px-2 py-1.5 text-sm outline-none focus:border-emerald-500"
          />
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              disabled={!suspendDate}
              onClick={handleConfirmSuspend}
              className="flex-1 rounded py-1.5 text-xs font-semibold text-white disabled:opacity-40"
              style={{ backgroundColor: GREEN }}
            >
              Confirmar
            </button>
            <button
              type="button"
              onClick={() => setPickingSuspend(false)}
              className="flex-1 rounded border border-neutral-200 py-1.5 text-xs text-neutral-600"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Verification badges ───────────────────────────────────────────────────────

function VerifBadges({ hasPhone }: { hasPhone: boolean }) {
  const items: { key: string; label: string; verified: boolean }[] = [
    { key: "email", label: "Email verificado", verified: true },
    { key: "tel", label: hasPhone ? "Teléfono verificado" : "Teléfono no verificado", verified: hasPhone },
  ];

  return (
    <div className="flex gap-1">
      {items.map(({ key, label, verified }) => (
        <span
          key={key}
          title={label}
          aria-label={label}
          className="flex size-5 items-center justify-center rounded-full"
          style={
            verified ? { backgroundColor: GREEN, color: "#fff" } : { backgroundColor: "#f3f4f6", color: "#d1d5db" }
          }
        >
          {verified ? <Check size={11} /> : <X size={11} />}
        </span>
      ))}
    </div>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────

/**
 * Admin users view — paginated user table with search, status filter and
 * inline status-change actions.
 */
function UsersView() {
  const [state, dispatch] = useReducer(usersReducer, initialState);

  // rawQuery drives the controlled input; filters drives fetching.
  // Separating them avoids re-renders on every keypress.
  const [rawQuery, setRawQuery] = useState("");
  const [filters, setFilters] = useState({ query: "", status: "", page: 1 });

  // Debounce: single setFilters call inside setTimeout (not synchronous)
  useEffect(() => {
    const id = setTimeout(() => {
      setFilters((f) => ({ ...f, query: rawQuery, page: 1 }));
    }, 300);
    return () => clearTimeout(id);
  }, [rawQuery]);

  // Fetch: dispatch in .then/.catch callbacks (not synchronous setState)
  useEffect(() => {
    dispatch({ type: "fetch_start" });
    fetchUsers(filters.query, filters.status, filters.page)
      .then((data) => dispatch({ type: "fetch_success", users: data.users, total: data.total }))
      .catch((err: unknown) =>
        dispatch({
          type: "fetch_error",
          error: err instanceof Error ? err.message : "Error desconocido",
        })
      );
  }, [filters]);

  // Filter setters: event handlers — setState in handlers is always fine
  function handleStatusFilter(value: string) {
    setFilters({ query: rawQuery, status: value, page: 1 });
  }

  function handlePage(p: number) {
    setFilters((f) => ({ ...f, page: p }));
  }

  const handleStatusUpdate = useCallback(
    async (customerId: string, status: AccountStatus, suspendedUntil?: string) => {
      dispatch({ type: "patch_status", customerId, status }); // optimistic
      try {
        await updateStatus(customerId, status, suspendedUntil);
      } catch {
        dispatch({ type: "fetch_start" });
        fetchUsers(filters.query, filters.status, filters.page)
          .then((data) => dispatch({ type: "fetch_success", users: data.users, total: data.total }))
          .catch((err: unknown) =>
            dispatch({
              type: "fetch_error",
              error: err instanceof Error ? err.message : "Error",
            })
          );
      }
    },
    [filters]
  );

  const { users, total, loading, error } = state;
  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  return (
    <div className="space-y-4">
      {/* Header + filters */}
      <div className="flex flex-wrap items-center justify-between gap-3">
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
        <div className="relative">
          <Search
            size={15}
            className="absolute top-2.5 left-3 text-neutral-400"
          />
          <input
            value={rawQuery}
            onChange={(e) => setRawQuery(e.target.value)}
            placeholder="Buscar por nombre o email..."
            aria-label="Buscar usuarios por nombre o email"
            className="w-64 rounded-lg border border-neutral-200 py-2 pr-3 pl-9 text-sm outline-none focus:border-emerald-500"
          />
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="border-b border-neutral-100 px-5 py-4">
          <SectionTitle
            title="Usuarios"
            sub={loading ? "Cargando..." : `${total.toLocaleString("es-ES")} usuarios registrados`}
          />
        </div>

        {error && <p className="px-5 py-4 text-sm text-red-600">{error}</p>}

        {!error && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-100 text-left text-xs text-neutral-400">
                <th className="px-5 py-3 font-medium">Usuario</th>
                <th className="hidden px-5 py-3 font-medium md:table-cell">Email</th>
                <th className="px-5 py-3 font-medium">Alta</th>
                <th className="hidden px-5 py-3 font-medium lg:table-cell">Verificaciones</th>
                <th className="px-5 py-3 font-medium">Estado</th>
                <th className="px-5 py-3">
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {loading &&
                Array.from({ length: 5 }).map((_, i) => (
                  <tr
                    key={i}
                    className="border-b border-neutral-50"
                  >
                    {Array.from({ length: 6 }).map((__, j) => (
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
                users.map((u, i) => (
                  <tr
                    key={u.customer_id}
                    className="border-b border-neutral-50 hover:bg-neutral-50"
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <Avatar
                          initials={userInitials(u)}
                          index={i}
                        />
                        <div>
                          <p className="font-medium text-neutral-900">
                            {u.first_name} {u.last_name}
                          </p>
                          <p className="text-xs text-neutral-400 md:hidden">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="hidden px-5 py-3.5 text-neutral-600 md:table-cell">{u.email}</td>
                    <td className="px-5 py-3.5 text-neutral-500">{fmtDate(u.registration_date)}</td>
                    <td className="hidden px-5 py-3.5 lg:table-cell">
                      <VerifBadges hasPhone={!!u.phone} />
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge color={STATUS_BADGE_COLORS[u.account_status]}>{STATUS_LABELS[u.account_status]}</Badge>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <StatusMenu
                        user={u}
                        onUpdate={handleStatusUpdate}
                      />
                    </td>
                  </tr>
                ))}

              {!loading && users.length === 0 && !error && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-5 py-10 text-center text-sm text-neutral-400"
                  >
                    No se encontraron usuarios.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {totalPages > 1 && !loading && (
          <div className="flex items-center justify-between border-t border-neutral-100 px-5 py-3 text-sm text-neutral-500">
            <span>
              {(filters.page - 1) * LIMIT + 1}-{Math.min(filters.page * LIMIT, total)} de {total}
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

export { UsersView };
