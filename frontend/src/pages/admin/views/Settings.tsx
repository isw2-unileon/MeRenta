import { useEffect, useReducer, useState } from "react";
import { CalendarCheck, ClipboardList, UserRound } from "lucide-react";

import type { ApiResponse } from "@/types/common";
import type { AuditEntry, AuditLogListResponse } from "@/types/audit";
import { GREEN } from "@/pages/admin/components/adminTokens";
import { Badge, Card, SectionTitle } from "@/pages/admin/components/adminUi";

const LIMIT = 20;

const ACTION_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Todas" },
  { value: "user_status_changed", label: "Cambio de usuario" },
  { value: "booking_status_changed", label: "Cambio de reserva" },
  { value: "verification_updated", label: "Verificacion" },
];

const ACTION_LABELS: Record<string, string> = {
  user_status_changed: "Cambio de usuario",
  booking_status_changed: "Cambio de reserva",
  verification_updated: "Verificacion",
};

const VALUE_COLORS: Record<string, "green" | "gray" | "amber" | "red" | "blue" | "purple"> = {
  active: "green",
  accepted: "green",
  verified: "green",
  pending: "amber",
  suspended: "amber",
  rejected: "red",
  banned: "red",
  cancelled: "gray",
  completed: "blue",
};

interface AuditState {
  entries: AuditEntry[];
  total: number;
  loading: boolean;
  error: string | null;
}

type AuditAction =
  | { type: "fetch_start" }
  | { type: "fetch_success"; entries: AuditEntry[]; total: number }
  | { type: "fetch_error"; error: string };

const initialState: AuditState = { entries: [], total: 0, loading: true, error: null };

function auditReducer(state: AuditState, action: AuditAction): AuditState {
  switch (action.type) {
    case "fetch_start":
      return { ...state, loading: true, error: null };
    case "fetch_success":
      return { entries: action.entries, total: action.total, loading: false, error: null };
    case "fetch_error":
      return { ...state, loading: false, error: action.error };
  }
}

async function fetchAuditLog(action: string, page: number): Promise<AuditLogListResponse> {
  const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
  if (action) params.set("action", action);

  const res = await fetch(`/api/admin/audit?${params.toString()}`, { credentials: "include" });
  const json = (await res.json()) as ApiResponse<AuditLogListResponse>;
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.error ?? "Error al cargar auditoria");
  }
  return json.data;
}

function fmtDateTime(iso: string): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

function badgeColor(value: string): "green" | "gray" | "amber" | "red" | "blue" | "purple" {
  return VALUE_COLORS[value] ?? "gray";
}

function EntityIcon({ type }: { type: string }) {
  const className = "text-neutral-400";
  if (type === "user") return <UserRound size={15} className={className} />;
  if (type === "booking") return <ClipboardList size={15} className={className} />;
  return <CalendarCheck size={15} className={className} />;
}

function ChangeCell({ entry }: { entry: AuditEntry }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {entry.old_value ? <Badge color={badgeColor(entry.old_value)}>{entry.old_value}</Badge> : <span className="text-neutral-300">-</span>}
      <span className="text-neutral-300">-&gt;</span>
      <Badge color={badgeColor(entry.new_value)}>{entry.new_value}</Badge>
    </div>
  );
}

function SettingsView() {
  const [state, dispatch] = useReducer(auditReducer, initialState);
  const [filters, setFilters] = useState({ action: "", page: 1 });

  useEffect(() => {
    dispatch({ type: "fetch_start" });
    fetchAuditLog(filters.action, filters.page)
      .then((data) => dispatch({ type: "fetch_success", entries: data.entries, total: data.total }))
      .catch((err: unknown) =>
        dispatch({ type: "fetch_error", error: err instanceof Error ? err.message : "Error desconocido" })
      );
  }, [filters]);

  function handleActionFilter(action: string) {
    setFilters({ action, page: 1 });
  }

  function handlePage(page: number) {
    setFilters((f) => ({ ...f, page }));
  }

  const { entries, total, loading, error } = state;
  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {ACTION_OPTIONS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => handleActionFilter(value)}
            className="rounded-full border px-3.5 py-1.5 text-sm font-medium transition"
            style={
              filters.action === value
                ? { backgroundColor: GREEN, color: "#fff", borderColor: GREEN }
                : { borderColor: "#e5e7eb", color: "#525252" }
            }
          >
            {label}
          </button>
        ))}
      </div>

      <Card className="overflow-hidden">
        <div className="border-b border-neutral-100 px-5 py-4">
          <SectionTitle
            title="Registro de auditoria"
            sub={loading ? "Cargando..." : `${total.toLocaleString("es-ES")} acciones registradas`}
          />
        </div>

        {error && <p className="px-5 py-4 text-sm text-red-600">{error}</p>}

        {!error && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-100 text-left text-xs text-neutral-400">
                <th className="px-5 py-3 font-medium">Fecha y hora</th>
                <th className="hidden px-5 py-3 font-medium md:table-cell">Admin</th>
                <th className="px-5 py-3 font-medium">Accion</th>
                <th className="px-5 py-3 font-medium">Entidad</th>
                <th className="px-5 py-3 font-medium">Cambio</th>
              </tr>
            </thead>
            <tbody>
              {loading &&
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-neutral-50">
                    {Array.from({ length: 5 }).map((__, j) => (
                      <td key={j} className="px-5 py-4" aria-label="Cargando">
                        <div aria-hidden="true" className="h-4 w-24 animate-pulse rounded bg-neutral-100" />
                      </td>
                    ))}
                  </tr>
                ))}

              {!loading &&
                entries.map((entry) => (
                  <tr key={entry.log_id} className="border-b border-neutral-50 hover:bg-neutral-50">
                    <td className="px-5 py-3.5 text-neutral-600">{fmtDateTime(entry.created_at)}</td>
                    <td className="hidden px-5 py-3.5 text-neutral-600 md:table-cell">{entry.admin_email}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <EntityIcon type={entry.entity_type} />
                        <div>
                          <p className="font-medium text-neutral-800">{actionLabel(entry.action)}</p>
                          <p className="text-xs text-neutral-400 md:hidden">{entry.admin_email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <code className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs text-neutral-700">
                        {entry.entity_id.slice(0, 8)}
                      </code>
                      {entry.detail && <p className="mt-1 max-w-48 truncate text-xs text-neutral-400">{entry.detail}</p>}
                    </td>
                    <td className="px-5 py-3.5">
                      <ChangeCell entry={entry} />
                    </td>
                  </tr>
                ))}

              {!loading && entries.length === 0 && !error && (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-sm text-neutral-400">
                    No hay acciones registradas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}

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
                aria-label="Pagina anterior"
                className="rounded px-2 py-1 hover:bg-neutral-50 disabled:opacity-40"
              >
                Anterior
              </button>
              <button
                type="button"
                disabled={filters.page >= totalPages}
                onClick={() => handlePage(filters.page + 1)}
                aria-label="Pagina siguiente"
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

export { SettingsView };
