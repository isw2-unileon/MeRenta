import { useCallback, useEffect, useReducer, useState } from "react";
import { CalendarCheck, ClipboardList, UserRound } from "lucide-react";

import type { ApiResponse } from "@/types/common";
import type { AuditEntry, AuditLogListResponse } from "@/types/audit";
import { GREEN, MINT } from "@/components/admin/adminTokens";
import { Badge, Card, SectionTitle } from "@/components/admin/adminUi";

// ── Types ─────────────────────────────────────────────────────────────────────

interface PlatformConfig {
  allow_new_registrations: boolean;
  service_fee_eur: number;
  insurance_daily_rate_eur: number;
  booking_expiry_days: number;
  updated_at?: string;
  updated_by_email?: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const LIMIT = 20;

const ACTION_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Todas" },
  { value: "user_status_changed", label: "Cambio de usuario" },
  { value: "booking_status_changed", label: "Cambio de reserva" },
  { value: "verification_updated", label: "Verificación" },
];

const ACTION_LABELS: Record<string, string> = {
  user_status_changed: "Cambio de usuario",
  booking_status_changed: "Cambio de reserva",
  verification_updated: "Verificación",
};

const VALUE_COLORS: Record<string, "green" | "gray" | "amber" | "red" | "blue"> = {
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

// ── Audit log state ───────────────────────────────────────────────────────────

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

const auditInitial: AuditState = { entries: [], total: 0, loading: true, error: null };

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

// ── Config state ──────────────────────────────────────────────────────────────

interface ConfigState {
  config: PlatformConfig | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
}

type ConfigAction =
  | { type: "fetch_start" }
  | { type: "fetch_success"; config: PlatformConfig }
  | { type: "fetch_error"; error: string }
  | { type: "save_start" }
  | { type: "save_success"; config: PlatformConfig }
  | { type: "save_error"; error: string; prev: PlatformConfig }
  | { type: "optimistic"; config: PlatformConfig };

const configInitial: ConfigState = { config: null, loading: true, saving: false, error: null };

function configReducer(state: ConfigState, action: ConfigAction): ConfigState {
  switch (action.type) {
    case "fetch_start":
      return { ...state, loading: true, error: null };
    case "fetch_success":
      return { config: action.config, loading: false, saving: false, error: null };
    case "fetch_error":
      return { ...state, loading: false, error: action.error };
    case "save_start":
      return { ...state, saving: true, error: null };
    case "save_success":
      return { config: action.config, loading: false, saving: false, error: null };
    case "save_error":
      return { config: action.prev, loading: false, saving: false, error: action.error };
    case "optimistic":
      return { ...state, config: action.config };
  }
}

// ── API ───────────────────────────────────────────────────────────────────────

async function fetchAuditLog(action: string, page: number): Promise<AuditLogListResponse> {
  const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
  if (action) params.set("action", action);
  const res = await fetch(`/api/admin/audit?${params.toString()}`, { credentials: "include" });
  const json = (await res.json()) as ApiResponse<AuditLogListResponse>;
  if (!res.ok || !json.success || !json.data) throw new Error(json.error ?? "Error al cargar auditoría");
  return json.data;
}

async function fetchConfig(): Promise<PlatformConfig> {
  const res = await fetch("/api/admin/config", { credentials: "include" });
  const json = (await res.json()) as ApiResponse<PlatformConfig>;
  if (!res.ok || !json.success || !json.data) throw new Error(json.error ?? "Error al cargar configuración");
  return json.data;
}

async function patchConfig(allowNewRegistrations: boolean): Promise<PlatformConfig> {
  const res = await fetch("/api/admin/config", {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ allow_new_registrations: allowNewRegistrations }),
  });
  const json = (await res.json()) as ApiResponse<PlatformConfig>;
  if (!res.ok || !json.success || !json.data) throw new Error(json.error ?? "Error al guardar configuración");
  return json.data;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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

function badgeColor(value: string): "green" | "gray" | "amber" | "red" | "blue" {
  return VALUE_COLORS[value] ?? "gray";
}

// ── Sub-components ────────────────────────────────────────────────────────────

function EntityIcon({ type }: { type: string }) {
  const cls = "shrink-0 text-neutral-400";
  if (type === "user") {
    return (
      <UserRound
        size={15}
        className={cls}
      />
    );
  }
  if (type === "booking") {
    return (
      <ClipboardList
        size={15}
        className={cls}
      />
    );
  }
  return (
    <CalendarCheck
      size={15}
      className={cls}
    />
  );
}

function ChangeCell({ entry }: { entry: AuditEntry }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {entry.old_value ? (
        <Badge color={badgeColor(entry.old_value)}>{entry.old_value}</Badge>
      ) : (
        <span className="text-neutral-300">-</span>
      )}
      <span className="text-neutral-300">→</span>
      <Badge color={badgeColor(entry.new_value)}>{entry.new_value}</Badge>
    </div>
  );
}

// ── Toggle component ──────────────────────────────────────────────────────────

interface ToggleProps {
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
  id: string;
  ariaLabel: string;
}

function Toggle({ checked, disabled = false, onChange, id, ariaLabel }: ToggleProps) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
      style={{ backgroundColor: checked ? GREEN : "#d1d5db" }}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none inline-block size-5 rounded-full bg-white shadow-sm transition-transform"
        style={{ transform: checked ? "translateX(20px)" : "translateX(0)" }}
      />
    </button>
  );
}

// ── Config row ────────────────────────────────────────────────────────────────

function ReadOnlyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-3.5">
      <span className="text-sm text-neutral-600">{label}</span>
      <span className="rounded bg-neutral-100 px-2 py-1 font-mono text-sm text-neutral-700">{value}</span>
    </div>
  );
}

// ── Config panel ──────────────────────────────────────────────────────────────

interface ConfigPanelProps {
  state: ConfigState;
  onToggle: (value: boolean) => void;
}

const EUR = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", minimumFractionDigits: 2 });

function ConfigPanel({ state, onToggle }: ConfigPanelProps) {
  const { config, loading, saving, error } = state;

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((k) => (
          <Card
            key={k}
            className="overflow-hidden"
          >
            <div className="border-b border-neutral-100 px-5 py-4">
              <div className="h-4 w-40 animate-pulse rounded bg-neutral-100" />
              <div className="mt-1.5 h-3 w-60 animate-pulse rounded bg-neutral-100" />
            </div>
            <div className="divide-y divide-neutral-100 px-5">
              {[1, 2].map((j) => (
                <div
                  key={j}
                  className="flex items-center justify-between py-3.5"
                >
                  <div className="h-4 w-48 animate-pulse rounded bg-neutral-100" />
                  <div className="h-6 w-24 animate-pulse rounded bg-neutral-100" />
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    );
  }

  if (!config) {
    return <p className="text-sm text-red-600">{error ?? "No se pudo cargar la configuración."}</p>;
  }

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* ── Acceso a la plataforma ── */}
      <Card className="overflow-hidden">
        <div className="border-b border-neutral-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-neutral-800">🔒 Acceso a la plataforma</h2>
          <p className="mt-0.5 text-xs text-neutral-400">Controla si los usuarios pueden crear nuevas cuentas.</p>
        </div>

        <div className="px-5 py-4">
          <div className="flex items-center justify-between">
            <div>
              <label
                htmlFor="toggle-registrations"
                className="cursor-pointer text-sm font-medium text-neutral-800"
              >
                Nuevos registros
              </label>
              <p className="mt-0.5 text-xs text-neutral-400">
                {config.allow_new_registrations
                  ? "Los nuevos usuarios pueden registrarse."
                  : "El registro está desactivado. Los nuevos usuarios recibirán un error 403."}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span
                className="text-xs font-medium"
                style={{ color: config.allow_new_registrations ? GREEN : "#9ca3af" }}
              >
                {config.allow_new_registrations ? "Activado" : "Desactivado"}
              </span>
              <Toggle
                id="toggle-registrations"
                ariaLabel="Nuevos registros"
                checked={config.allow_new_registrations}
                disabled={saving}
                onChange={onToggle}
              />
            </div>
          </div>

          {config.updated_by_email && (
            <p className="mt-4 border-t border-neutral-100 pt-3 text-xs text-neutral-400">
              Última modificación por{" "}
              <span className="font-medium text-neutral-600">{config.updated_by_email}</span>
              {config.updated_at ? ` · ${fmtDateTime(config.updated_at)}` : ""}
            </p>
          )}
        </div>
      </Card>

      {/* ── Precios (solo lectura) ── */}
      <Card className="overflow-hidden">
        <div className="border-b border-neutral-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-neutral-800">💰 Precios y tarifas</h2>
          <p className="mt-0.5 text-xs text-neutral-400">
            Constantes definidas en el código fuente. Contacta con desarrollo para modificarlas.
          </p>
        </div>
        <div className="divide-y divide-neutral-100 px-5">
          <ReadOnlyRow
            label="Cuota de servicio por reserva"
            value={EUR.format(config.service_fee_eur)}
          />
          <ReadOnlyRow
            label="Seguro (por día de alquiler)"
            value={`${EUR.format(config.insurance_daily_rate_eur)} / día`}
          />
        </div>
      </Card>

      {/* ── Reservas (solo lectura) ── */}
      <Card className="overflow-hidden">
        <div className="border-b border-neutral-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-neutral-800">⏱ Reservas</h2>
          <p className="mt-0.5 text-xs text-neutral-400">Parámetros del ciclo de vida de las reservas. Solo lectura.</p>
        </div>
        <div className="divide-y divide-neutral-100 px-5">
          <ReadOnlyRow
            label="Expiración de reservas pendientes"
            value={`${config.booking_expiry_days} días sin pago`}
          />
          <ReadOnlyRow
            label="Auto-completar alquileres pasados"
            value={`${config.booking_expiry_days} días tras fin del periodo`}
          />
        </div>
      </Card>
    </div>
  );
}

// ── Audit table ───────────────────────────────────────────────────────────────

interface AuditTableProps {
  state: AuditState;
  filters: { action: string; page: number };
  onActionFilter: (action: string) => void;
  onPage: (page: number) => void;
}

function AuditTable({ state, filters, onActionFilter, onPage }: AuditTableProps) {
  const { entries, total, loading, error } = state;
  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {ACTION_OPTIONS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => onActionFilter(value)}
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
            title="Registro de auditoría"
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
                <th className="px-5 py-3 font-medium">Acción</th>
                <th className="px-5 py-3 font-medium">Entidad</th>
                <th className="px-5 py-3 font-medium">Cambio</th>
              </tr>
            </thead>
            <tbody>
              {loading &&
                Array.from({ length: 5 }).map((_, i) => (
                  <tr
                    key={i}
                    className="border-b border-neutral-50"
                  >
                    {Array.from({ length: 5 }).map((__, j) => (
                      <td
                        key={j}
                        className="px-5 py-4"
                        aria-label="Cargando"
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
                entries.map((entry) => (
                  <tr
                    key={entry.log_id}
                    className="border-b border-neutral-50 hover:bg-neutral-50"
                  >
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
                      {entry.detail && (
                        <p className="mt-1 max-w-48 truncate text-xs text-neutral-400">{entry.detail}</p>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <ChangeCell entry={entry} />
                    </td>
                  </tr>
                ))}

              {!loading && entries.length === 0 && !error && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-5 py-10 text-center text-sm text-neutral-400"
                  >
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
              {(filters.page - 1) * LIMIT + 1}–{Math.min(filters.page * LIMIT, total)} de{" "}
              {total.toLocaleString("es-ES")}
            </span>
            <div className="flex gap-1">
              <button
                type="button"
                disabled={filters.page <= 1}
                onClick={() => onPage(filters.page - 1)}
                aria-label="Página anterior"
                className="rounded px-2 py-1 hover:bg-neutral-50 disabled:opacity-40"
              >
                Anterior
              </button>
              <button
                type="button"
                disabled={filters.page >= totalPages}
                onClick={() => onPage(filters.page + 1)}
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

// ── Main view ─────────────────────────────────────────────────────────────────

type Tab = "audit" | "config";

const TABS: { id: Tab; label: string }[] = [
  { id: "audit", label: "Registro de auditoría" },
  { id: "config", label: "Configuración" },
];

/**
 * Admin settings view — two tabs: audit log and platform configuration.
 */
function SettingsView() {
  const [activeTab, setActiveTab] = useState<Tab>("audit");

  // Audit log state
  const [auditState, auditDispatch] = useReducer(auditReducer, auditInitial);
  const [auditFilters, setAuditFilters] = useState({ action: "", page: 1 });

  // Platform config state
  const [configState, configDispatch] = useReducer(configReducer, configInitial);

  // Fetch audit log when tab or filters change
  useEffect(() => {
    if (activeTab !== "audit") return;
    auditDispatch({ type: "fetch_start" });
    fetchAuditLog(auditFilters.action, auditFilters.page)
      .then((data) => auditDispatch({ type: "fetch_success", entries: data.entries, total: data.total }))
      .catch((err: unknown) =>
        auditDispatch({ type: "fetch_error", error: err instanceof Error ? err.message : "Error desconocido" })
      );
  }, [activeTab, auditFilters]);

  // Fetch config once when tab becomes active
  useEffect(() => {
    if (activeTab !== "config" || configState.config !== null) return;
    configDispatch({ type: "fetch_start" });
    fetchConfig()
      .then((cfg) => configDispatch({ type: "fetch_success", config: cfg }))
      .catch((err: unknown) =>
        configDispatch({ type: "fetch_error", error: err instanceof Error ? err.message : "Error desconocido" })
      );
  }, [activeTab, configState.config]);

  const handleToggle = useCallback(
    async (value: boolean) => {
      if (!configState.config) return;
      const prev = configState.config;
      // Optimistic update
      configDispatch({ type: "optimistic", config: { ...prev, allow_new_registrations: value } });
      configDispatch({ type: "save_start" });
      try {
        const updated = await patchConfig(value);
        configDispatch({ type: "save_success", config: updated });
      } catch (err: unknown) {
        configDispatch({
          type: "save_error",
          prev,
          error: err instanceof Error ? err.message : "No se pudo guardar el cambio.",
        });
      }
    },
    [configState.config]
  );

  function handleActionFilter(action: string) {
    setAuditFilters({ action, page: 1 });
  }

  function handlePage(page: number) {
    setAuditFilters((f) => ({ ...f, page }));
  }

  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div className="flex w-fit gap-1 rounded-xl border border-neutral-200 bg-white p-1">
        {TABS.map(({ id, label }) => {
          const active = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className="rounded-lg px-4 py-2 text-sm font-medium transition"
              style={active ? { backgroundColor: MINT, color: GREEN } : { color: "#525252" }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      {activeTab === "audit" && (
        <AuditTable
          state={auditState}
          filters={auditFilters}
          onActionFilter={handleActionFilter}
          onPage={handlePage}
        />
      )}

      {activeTab === "config" && (
        <ConfigPanel
          state={configState}
          onToggle={handleToggle}
        />
      )}
    </div>
  );
}

export { SettingsView };
