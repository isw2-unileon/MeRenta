import { useCallback, useEffect, useReducer, useState } from "react";
import { AlertTriangle, Check, ChevronDown, Filter, Package, RotateCcw, Users } from "lucide-react";

import type { ApiResponse } from "@/types/common";
import type { IncidentListResponse, IncidentPriority, IncidentResponse, IncidentStatus } from "@/types/incident";
import { GREEN } from "@/components/admin/adminTokens";
import { Badge, Card, Dropdown } from "@/components/admin/adminUi";

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<IncidentStatus, "amber" | "blue" | "red" | "green"> = {
  open: "amber",
  under_review: "blue",
  resolved: "green",
  closed: "red",
};

const STATUS_LABELS: Record<IncidentStatus, string> = {
  open: "abierta",
  under_review: "en revisión",
  closed: "cerrada",
  resolved: "resuelta",
};

const PRIORITY_COLOR: Record<IncidentPriority, string> = {
  high: "text-red-600",
  medium: "text-amber-600",
  low: "text-neutral-400",
};

const PRIORITY_LABEL: Record<IncidentPriority, string> = {
  high: "alta",
  medium: "media",
  low: "baja",
};

/** Formats an ISO date as a short Spanish date. */
function fmtIncidentDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Notifies other views (e.g. the sidebar badge) that incidents changed. */
function notifyIncidentsChanged(): void {
  window.dispatchEvent(new Event("merenta:incidents-updated"));
}

/** Loads a page of incidents and returns the items plus total count. */
async function loadIncidents(
  typeFilter: string,
  statusFilter: string,
  page: number
): Promise<{
  incidents: IncidentResponse[];
  total: number;
}> {
  const data = await fetchIncidents(typeFilter, statusFilter, page);
  return {
    incidents: data.items,
    total: data.total,
  };
}

// ── Reducer ───────────────────────────────────────────────────────────────────

interface IncidentsState {
  incidents: IncidentResponse[];
  total: number;
  loading: boolean;
  error: string | null;
  selected: IncidentResponse | null;
}

type IncidentsAction =
  | { type: "fetch_start" }
  | { type: "fetch_success"; incidents: IncidentResponse[]; total: number }
  | { type: "fetch_error"; error: string }
  | { type: "select"; incident: IncidentResponse }
  | { type: "clear_selection" }
  | { type: "patch_status"; id: string; status: IncidentStatus }
  | { type: "patch_priority"; id: string; priority: IncidentPriority };

const initialState: IncidentsState = {
  incidents: [],
  total: 0,
  loading: true,
  error: null,
  selected: null,
};

/** Reduces incident list/selection/optimistic-patch actions. */
function incidentsReducer(state: IncidentsState, action: IncidentsAction): IncidentsState {
  switch (action.type) {
    case "fetch_start":
      return { ...state, loading: true, error: null };
    case "fetch_success": {
      const selected = state.selected
        ? (action.incidents.find((incident) => incident.incident_id === state.selected?.incident_id) ?? null)
        : null;
      return {
        ...state,
        loading: false,
        error: null,
        incidents: action.incidents,
        total: action.total,
        // Auto-select first incident on initial load or when selection is lost.
        selected: selected ?? action.incidents[0] ?? null,
      };
    }
    case "fetch_error":
      return { ...state, loading: false, error: action.error };
    case "select":
      return { ...state, selected: action.incident };
    case "clear_selection":
      return { ...state, selected: null };
    case "patch_status":
      return {
        ...state,
        incidents: state.incidents.map((i) => (i.incident_id === action.id ? { ...i, status: action.status } : i)),
        selected:
          state.selected?.incident_id === action.id ? { ...state.selected, status: action.status } : state.selected,
      };
    case "patch_priority":
      return {
        ...state,
        incidents: state.incidents.map((i) => (i.incident_id === action.id ? { ...i, priority: action.priority } : i)),
        selected:
          state.selected?.incident_id === action.id ? { ...state.selected, priority: action.priority } : state.selected,
      };
  }
}

// ── API helpers ───────────────────────────────────────────────────────────────

/** Fetches a page of incidents filtered by type and status. */
async function fetchIncidents(typeFilter: string, statusFilter: string, page: number): Promise<IncidentListResponse> {
  const params = new URLSearchParams({ page: String(page), limit: "20" });
  if (typeFilter) params.set("type", typeFilter);
  if (statusFilter) params.set("status", statusFilter);
  const res = await fetch(`/api/admin/incidents?${params.toString()}`, {
    credentials: "include",
  });
  const json = (await res.json()) as ApiResponse<IncidentListResponse>;
  if (!res.ok || !json.success || !json.data) throw new Error(json.error ?? "Error");
  return json.data;
}

/** Updates an incident's status. */
async function patchStatus(id: string, status: IncidentStatus): Promise<void> {
  const res = await fetch(`/api/admin/incidents/${id}/status`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  const json = (await res.json()) as ApiResponse<unknown>;
  if (!res.ok || !json.success) throw new Error(json.error ?? "Error");
}

/** Updates an incident's triage priority. */
async function patchPriority(id: string, priority: IncidentPriority): Promise<void> {
  const res = await fetch(`/api/admin/incidents/${id}/priority`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ priority }),
  });
  const json = (await res.json()) as ApiResponse<unknown>;
  if (!res.ok || !json.success) throw new Error(json.error ?? "Error");
}

// ── Sub-components ────────────────────────────────────────────────────────────

const INCIDENT_TYPE_LABELS: Record<string, string> = {
  damage: "Producto dañado",
  late_return: "Devolución tardía",
  item_mismatch: "Producto no coincide",
  not_delivered: "No entregado",
  other: "Otra incidencia",
  not_available: "No disponible",
  forbidden_item: "Producto no permitido",
};

/** Reports whether an incident type relates to a product (vs. a user). */
function isProductIncident(type: string): boolean {
  return ["damage", "item_mismatch", "not_available", "forbidden_item"].includes(type);
}

/** Icon distinguishing product vs. user incidents. */
function TypeIcon({ type }: { type: string }) {
  const isProduct = isProductIncident(type);
  return (
    <div
      className={`flex h-10 w-10 items-center justify-center rounded-lg ${
        isProduct ? "bg-blue-50 text-blue-600" : "bg-red-50 text-red-500"
      }`}
    >
      {isProduct ? <Package size={18} /> : <Users size={18} />}
    </div>
  );
}

const STATUS_OPTIONS: IncidentStatus[] = ["open", "under_review", "resolved", "closed"];
const PRIORITY_OPTIONS: IncidentPriority[] = ["low", "medium", "high"];

const PRIORITY_ACTION_LABELS: Record<IncidentPriority, string> = {
  low: "Baja",
  medium: "Media",
  high: "Alta",
};

const STATUS_ACTION_LABELS: Record<IncidentStatus, string> = {
  open: "Reabrir",
  under_review: "Poner en revisión",
  resolved: "Resolver",
  closed: "Cerrar",
};

interface AdminDropdownProps<T extends string> {
  label: string;
  value: T;
  options: T[];
  labels: Record<T, string>;
  onUpdate: (value: T) => void;
}

/** Generic labeled dropdown for selecting one of a fixed set of values. */
function AdminDropdown<T extends string>({ label, value, options, labels, onUpdate }: AdminDropdownProps<T>) {
  return (
    <Dropdown
      ariaLabel={`${label}: ${labels[value]}`}
      panelClassName="min-w-44 py-1"
      buttonClassName="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
      button={
        <>
          {label}: {labels[value]} <ChevronDown size={14} />
        </>
      }
    >
      {(close) =>
        options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => {
              onUpdate(option);
              close();
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-50"
          >
            {option === value && <Check size={14} />}
            <span className={option === value ? "font-semibold" : ""}>{labels[option]}</span>
          </button>
        ))
      }
    </Dropdown>
  );
}

// Detail panel
interface DetailPanelProps {
  incident: IncidentResponse;
  onStatusUpdate: (id: string, status: IncidentStatus) => void;
  onPriorityUpdate: (id: string, priority: IncidentPriority) => void;
}

/** Side panel showing full incident detail with status/priority controls. */
function DetailPanel({ incident, onStatusUpdate, onPriorityUpdate }: DetailPanelProps) {
  return (
    <Card className="sticky top-4 p-5">
      <div className="mb-1 flex items-center justify-between">
        <span className="font-mono text-xs text-neutral-400">{incident.incident_id.slice(0, 8).toUpperCase()}</span>
        <Badge color={STATUS_COLOR[incident.status]}>{STATUS_LABELS[incident.status]}</Badge>
      </div>
      <h3 className="mt-1 text-lg leading-snug font-bold text-neutral-900">{incident.item_title}</h3>
      <p className="mt-0.5 text-sm text-neutral-500">{INCIDENT_TYPE_LABELS[incident.type] ?? "Incidencia"}</p>

      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-lg bg-neutral-50 p-3">
          <p className="text-xs text-neutral-400">Reportante</p>
          <p className="font-medium text-neutral-800">{incident.reporter_name}</p>
        </div>
        <div className="rounded-lg bg-neutral-50 p-3">
          <p className="text-xs text-neutral-400">
            {isProductIncident(incident.type) ? "Producto reportado" : "Reportado"}
          </p>
          <p className="font-medium text-neutral-800">{incident.reported_name}</p>
        </div>
        <div className="rounded-lg bg-neutral-50 p-3">
          <p className="text-xs text-neutral-400">Fechas alquiler</p>
          <p className="text-xs font-medium text-neutral-800">
            {fmtIncidentDate(incident.start_date)} → {fmtIncidentDate(incident.end_date)}
          </p>
        </div>
        <div className="rounded-lg bg-neutral-50 p-3">
          <p className="text-xs text-neutral-400">Prioridad</p>
          <p className={`font-medium capitalize ${PRIORITY_COLOR[incident.priority]}`}>
            {PRIORITY_LABEL[incident.priority]}
          </p>
        </div>
      </div>

      <div className="mt-4">
        <p className="mb-1.5 text-sm font-semibold text-neutral-800">Descripción</p>
        <p className="rounded-lg bg-neutral-50 p-3 text-sm leading-relaxed text-neutral-600">{incident.description}</p>
      </div>

      {incident.associated_cost > 0 && (
        <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm">
          <span className="font-medium text-amber-700">Coste asociado: {incident.associated_cost.toFixed(2)} €</span>
        </div>
      )}

      <div className="mt-5 space-y-2 border-t border-neutral-100 pt-4">
        <div className="flex flex-wrap gap-2">
          <AdminDropdown
            label="Prioridad"
            value={incident.priority}
            options={PRIORITY_OPTIONS}
            labels={PRIORITY_ACTION_LABELS}
            onUpdate={(priority) => onPriorityUpdate(incident.incident_id, priority)}
          />
          <AdminDropdown
            label="Estado"
            value={incident.status}
            options={STATUS_OPTIONS}
            labels={STATUS_ACTION_LABELS}
            onUpdate={(status) => onStatusUpdate(incident.incident_id, status)}
          />
        </div>

        {/* Quick-action button — context-aware, always visible */}
        {incident.status === "resolved" || incident.status === "closed" ? (
          <button
            type="button"
            onClick={() => onStatusUpdate(incident.incident_id, "open")}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-neutral-200 py-2.5 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
          >
            <RotateCcw size={16} /> Reabrir incidencia
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={() => onStatusUpdate(incident.incident_id, "resolved")}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold text-white"
              style={{ backgroundColor: GREEN }}
            >
              <Check size={16} /> Resolver incidencia
            </button>
            <button
              type="button"
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-neutral-200 py-2 text-sm font-medium text-neutral-700"
            >
              <RotateCcw size={14} /> Reembolsar
            </button>
          </>
        )}
      </div>
    </Card>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────

const TYPE_FILTERS = [
  { value: "", label: "Todas" },
  { value: "damage", label: "Producto dañado" },
  { value: "late_return", label: "Devolución tardía" },
  { value: "item_mismatch", label: "Producto no coincide" },
  { value: "not_delivered", label: "No entregado" },
  { value: "not_available", label: "No disponible" },
  { value: "forbidden_item", label: "Producto no permitido" },
  { value: "other", label: "Otra" },
];

const STATUS_FILTERS = [
  { value: "", label: "Todas" },
  { value: "open", label: "Abiertas" },
  { value: "under_review", label: "En revisión" },
  { value: "resolved", label: "Resueltas" },
  { value: "closed", label: "Cerradas" },
];

/**
 * Admin incidents view — filterable list with a detail side-panel.
 */
function Incidents() {
  const [state, dispatch] = useReducer(incidentsReducer, initialState);

  // Filter / pagination — separate state, reset synchronously in handlers
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);

  // Data fetch — setState calls are inside .then/.catch (async callbacks)
  useEffect(() => {
    dispatch({ type: "fetch_start" });
    loadIncidents(typeFilter, statusFilter, page)
      .then((data) => {
        dispatch({
          type: "fetch_success",
          incidents: data.incidents,
          total: data.total,
        });
      })
      .catch((err: unknown) =>
        dispatch({
          type: "fetch_error",
          error: err instanceof Error ? err.message : "Error",
        })
      );
  }, [typeFilter, statusFilter, page]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  // Filter setters reset page & selection synchronously (event handlers — allowed)
  function handleTypeFilter(value: string) {
    setTypeFilter(value);
    setPage(1);
    dispatch({ type: "clear_selection" });
  }

  function handleStatusFilter(value: string) {
    setStatusFilter(value);
    setPage(1);
    dispatch({ type: "clear_selection" });
  }

  const handleStatusUpdate = useCallback(
    async (id: string, status: IncidentStatus) => {
      dispatch({ type: "patch_status", id, status });
      try {
        await patchStatus(id, status);
        notifyIncidentsChanged();
        const data = await loadIncidents(typeFilter, statusFilter, page);
        dispatch({
          type: "fetch_success",
          incidents: data.incidents,
          total: data.total,
        });
      } catch {
        // Re-fetch to restore correct state on failure
        loadIncidents(typeFilter, statusFilter, page)
          .then((data) => {
            dispatch({
              type: "fetch_success",
              incidents: data.incidents,
              total: data.total,
            });
          })
          .catch(() => undefined);
      }
    },
    [typeFilter, statusFilter, page]
  );

  const handlePriorityUpdate = useCallback(
    async (id: string, priority: IncidentPriority) => {
      dispatch({ type: "patch_priority", id, priority });
      try {
        await patchPriority(id, priority);
        notifyIncidentsChanged();
        const data = await loadIncidents(typeFilter, statusFilter, page);
        dispatch({
          type: "fetch_success",
          incidents: data.incidents,
          total: data.total,
        });
      } catch {
        loadIncidents(typeFilter, statusFilter, page)
          .then((data) => {
            dispatch({
              type: "fetch_success",
              incidents: data.incidents,
              total: data.total,
            });
          })
          .catch(() => undefined);
      }
    },
    [typeFilter, statusFilter, page]
  );

  const { incidents, total, loading, error, selected } = state;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1.5">
          {TYPE_FILTERS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => handleTypeFilter(value)}
              className="rounded-full border px-3.5 py-1.5 text-sm font-medium transition"
              style={
                typeFilter === value
                  ? { backgroundColor: GREEN, color: "#fff", borderColor: GREEN }
                  : { borderColor: "#e5e7eb", color: "#525252" }
              }
            >
              {label}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Filter
            size={14}
            className="text-neutral-400"
          />
          <select
            value={statusFilter}
            onChange={(e) => handleStatusFilter(e.target.value)}
            aria-label="Filtrar por estado de incidencia"
            className="rounded-lg border border-neutral-200 px-3 py-1.5 text-sm outline-none focus:border-emerald-500"
          >
            {STATUS_FILTERS.map(({ value, label }) => (
              <option
                key={value}
                value={value}
              >
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* Empty state — full width, shown outside the grid */}
      {!loading && !error && incidents.length === 0 && (
        <Card className="py-16 text-center">
          <AlertTriangle
            size={32}
            className="mx-auto mb-3 text-neutral-300"
          />
          <p className="text-sm text-neutral-500">No hay incidencias con estos filtros.</p>
        </Card>
      )}

      {(loading || incidents.length > 0) && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
          <div className="space-y-2 xl:col-span-3">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="h-20 animate-pulse rounded-xl bg-neutral-100"
                />
              ))
            ) : (
              <Card>
                {incidents.map((inc, idx) => (
                  <button
                    key={inc.incident_id}
                    type="button"
                    onClick={() => dispatch({ type: "select", incident: inc })}
                    className={`flex w-full items-center gap-3 p-4 text-left ${
                      idx !== incidents.length - 1 ? "border-b border-neutral-100" : ""
                    } ${selected?.incident_id === inc.incident_id ? "bg-neutral-50" : "hover:bg-neutral-50"}`}
                  >
                    <TypeIcon type={inc.type} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-neutral-400">
                          {inc.incident_id.slice(0, 8).toUpperCase()}
                        </span>
                        <span className={`text-xs font-semibold ${PRIORITY_COLOR[inc.priority]}`}>
                          ▲ {PRIORITY_LABEL[inc.priority]}
                        </span>
                      </div>
                      <p className="truncate text-sm font-medium text-neutral-900">{inc.item_title}</p>
                      <p className="truncate text-xs text-neutral-500">
                        {inc.reporter_name} → {inc.reported_name} ·{" "}
                        {inc.reported_at
                          ? new Date(inc.reported_at).toLocaleDateString("es-ES", {
                              day: "numeric",
                              month: "short",
                            })
                          : "—"}
                      </p>
                    </div>
                    <Badge color={STATUS_COLOR[inc.status]}>{STATUS_LABELS[inc.status]}</Badge>
                  </button>
                ))}
              </Card>
            )}

            {total > 20 && !loading && (
              <div className="flex justify-between px-1 text-sm text-neutral-500">
                <span>
                  {(page - 1) * 20 + 1}-{Math.min(page * 20, total)} de {total}
                </span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                    aria-label="Página anterior"
                    className="rounded px-2 py-1 hover:bg-neutral-100 disabled:opacity-40"
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    disabled={page * 20 >= total}
                    onClick={() => setPage((p) => p + 1)}
                    aria-label="Página siguiente"
                    className="rounded px-2 py-1 hover:bg-neutral-100 disabled:opacity-40"
                  >
                    ›
                  </button>
                </div>
              </div>
            )}
          </div>

          {selected && (
            <div className="xl:col-span-2">
              <DetailPanel
                incident={selected}
                onStatusUpdate={handleStatusUpdate}
                onPriorityUpdate={handlePriorityUpdate}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export { Incidents };
