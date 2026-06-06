import { useCallback, useEffect, useReducer, useState } from "react";
import { Check, MoreHorizontal, Search, X } from "lucide-react";

import type { AccountStatus } from "@/types/customer";
import type { AdminUser, AdminUserListResponse } from "@/types/admin";
import { GREEN } from "@/components/admin/adminTokens";
import { getAdminData, sendAdminMutation } from "@/components/admin/adminApi";
import { fmtDate } from "@/components/admin/adminFormat";
import {
  Avatar,
  Badge,
  Card,
  Dropdown,
  FilterPills,
  Pagination,
  SectionTitle,
  TableSkeleton,
} from "@/components/admin/adminUi";

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

function userInitials(u: AdminUser): string {
  return `${u.first_name[0] ?? ""}${u.last_name[0] ?? ""}`.toUpperCase();
}

function UserAvatar({ user, index }: { user: AdminUser; index: number }) {
  if (user.avatar_url) {
    return (
      <img
        src={user.avatar_url}
        alt=""
        className="size-9 rounded-full object-cover"
        loading="lazy"
      />
    );
  }

  return (
    <Avatar
      initials={userInitials(user)}
      index={index}
      size={36}
    />
  );
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

function fetchUsers(query: string, status: string, page: number): Promise<AdminUserListResponse> {
  const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
  if (query) params.set("q", query);
  if (status) params.set("status", status);

  return getAdminData<AdminUserListResponse>(`/api/admin/users?${params.toString()}`, "Error al cargar usuarios");
}

function updateStatus(customerId: string, status: AccountStatus, suspendedUntil?: string): Promise<void> {
  const body: { status: string; suspended_until?: string } = { status };
  if (suspendedUntil) body.suspended_until = suspendedUntil;

  return sendAdminMutation(`/api/admin/users/${customerId}/status`, "PATCH", body, "Error al actualizar el estado");
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
  const [pickingSuspend, setPickingSuspend] = useState(false);
  const [suspendDate, setSuspendDate] = useState("");

  const options = NEXT_STATUSES[user.account_status];
  const todayStr = new Date().toISOString().slice(0, 10);

  function reset() {
    setPickingSuspend(false);
    setSuspendDate("");
  }

  return (
    <Dropdown
      ariaLabel={`Acciones para ${user.first_name} ${user.last_name}`}
      onClose={reset}
      button={<MoreHorizontal size={16} />}
    >
      {(close) =>
        !pickingSuspend ? (
          options.map((next) => (
            <button
              key={next}
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-50"
              onClick={() => {
                if (next === "suspended") {
                  setPickingSuspend(true);
                  return;
                }
                onUpdate(user.customer_id, next);
                close();
              }}
            >
              {NEXT_STATUS_LABELS[next]}
            </button>
          ))
        ) : (
          <div className="w-56 p-3">
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
                onClick={() => {
                  if (!suspendDate) return;
                  const until = new Date(suspendDate + "T23:59:59Z").toISOString();
                  onUpdate(user.customer_id, "suspended", until);
                  close();
                }}
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
        )
      }
    </Dropdown>
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

  return (
    <div className="space-y-4">
      {/* Header + filters */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterPills
          options={FILTER_OPTIONS}
          value={filters.status}
          onChange={handleStatusFilter}
        />
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
              {loading && (
                <TableSkeleton
                  rows={5}
                  cols={6}
                />
              )}

              {!loading &&
                users.map((u, i) => (
                  <tr
                    key={u.customer_id}
                    className="border-b border-neutral-50 hover:bg-neutral-50"
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <UserAvatar
                          user={u}
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

export { UsersView };
