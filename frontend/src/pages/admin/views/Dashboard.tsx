import React, { useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle,
  Clock,
  Package,
  Repeat,
  TrendingUp,
  Users,
  XCircle,
} from "lucide-react";

import type { ApiResponse } from "@/types/common";
import DashboardCharts, { type MonthlyPoint, type CategoryPoint } from "@/pages/admin/views/DashboardCharts";
import { GREEN, MINT } from "@/components/admin/adminTokens";
import { Badge, Card } from "@/components/admin/adminUi";

// ── Types ─────────────────────────────────────────────────────────────────────

interface BookingStats {
  total: number;
  pending: number;
  accepted: number;
  completed: number;
  cancelled: number;
  rejected: number;
}

interface IncidentStats {
  open: number;
  under_review: number;
}

interface RecentIncident {
  incident_id: string;
  type: string;
  item_title: string;
  reporter_name: string;
  status: string;
  priority: string;
  reported_at: string;
}

interface AdminStats {
  users: number;
  products: number;
  bookings: BookingStats;
  revenue: number;
  monthly_revenue: MonthlyPoint[];
  categories: CategoryPoint[];
  incidents: IncidentStats;
  recent_incidents: RecentIncident[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const EUR_FORMAT = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

const STATUS_BADGE: Record<string, "amber" | "blue" | "green" | "red" | "gray"> = {
  open: "amber",
  under_review: "blue",
  resolved: "green",
  closed: "red",
};
const STATUS_LABEL: Record<string, string> = {
  open: "abierta",
  under_review: "en revisión",
  resolved: "resuelta",
  closed: "cerrada",
};
const PRIORITY_COLOR: Record<string, string> = {
  high: "text-red-600",
  medium: "text-amber-600",
  low: "text-neutral-400",
};
const PRIORITY_LABEL: Record<string, string> = { high: "Alta", medium: "Media", low: "Baja" };

// Stable keys for skeleton placeholders — avoids array-index-as-key warnings.
const TOP_KPI_KEYS = ["users", "products", "bookings", "revenue"] as const;
const BOTTOM_KPI_KEYS = ["incidents", "pending", "completed", "cancelled"] as const;
const INCIDENT_SKELETON_KEYS = ["inc-sk-0", "inc-sk-1", "inc-sk-2", "inc-sk-3"] as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Reports whether an incident type relates to a product (vs. a user). */
function isProductIncident(type: string): boolean {
  return ["damage", "item_mismatch", "not_available", "forbidden_item"].includes(type);
}

/** Formats an ISO date as a short Spanish relative label ("Hoy", "Ayer", "N días"). */
function fmtDate(iso: string): string {
  if (!iso) return "—";
  const diffDays = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (diffDays === 0) return "Hoy";
  if (diffDays === 1) return "Ayer";
  return `${diffDays} días`;
}

/** Fetches the aggregated admin dashboard statistics. */
async function fetchStats(): Promise<AdminStats> {
  const res = await fetch("/api/admin/stats", { credentials: "include" });
  const json = (await res.json()) as ApiResponse<AdminStats>;
  if (!res.ok || !json.success || !json.data) throw new Error(json.error ?? "Error al cargar estadísticas");
  return json.data;
}

// ── Shared primitives ─────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  accent?: boolean;
  sub?: string;
}

/** A single KPI tile with icon, value and optional subtitle. */
function KpiCard({ label, value, icon, accent = false, sub }: KpiCardProps) {
  return (
    <Card className="flex items-start gap-4 p-5">
      <div
        className="flex size-11 shrink-0 items-center justify-center rounded-xl"
        style={accent ? { backgroundColor: MINT, color: GREEN } : { backgroundColor: "#f3f4f6", color: "#6b7280" }}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-neutral-500">{label}</p>
        <p className="mt-0.5 text-2xl font-bold text-neutral-900">{value}</p>
        {sub && <p className="mt-0.5 text-xs text-neutral-400">{sub}</p>}
      </div>
    </Card>
  );
}

/** Loading placeholder for a single KPI tile. */
function KpiSkeleton() {
  return (
    <Card className="flex items-start gap-4 p-5">
      <div className="size-11 shrink-0 animate-pulse rounded-xl bg-neutral-100" />
      <div className="space-y-2">
        <div className="h-3 w-20 animate-pulse rounded bg-neutral-100" />
        <div className="h-7 w-28 animate-pulse rounded bg-neutral-100" />
        <div className="h-3 w-16 animate-pulse rounded bg-neutral-100" />
      </div>
    </Card>
  );
}

/** Loading placeholder shown in place of the dashboard charts. */
function ChartFallback() {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Card className="p-5 lg:col-span-2">
        <div className="mb-4 space-y-1">
          <div className="h-4 w-32 animate-pulse rounded bg-neutral-100" />
          <div className="h-3 w-48 animate-pulse rounded bg-neutral-100" />
        </div>
        <div className="h-56 animate-pulse rounded-lg bg-neutral-100" />
      </Card>
      <Card className="p-5">
        <div className="mb-4 space-y-1">
          <div className="h-4 w-32 animate-pulse rounded bg-neutral-100" />
          <div className="h-3 w-36 animate-pulse rounded bg-neutral-100" />
        </div>
        <div className="h-56 animate-pulse rounded-lg bg-neutral-100" />
      </Card>
    </div>
  );
}

// ── Section components ────────────────────────────────────────────────────────

/** Top row of headline KPIs (users, products, bookings, revenue). */
function TopKpis({ stats }: { stats: AdminStats }) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <KpiCard
        label="Usuarios registrados"
        value={stats.users.toLocaleString("es-ES")}
        icon={<Users size={20} />}
        accent
        sub="plataforma activa"
      />
      <KpiCard
        label="Productos publicados"
        value={stats.products.toLocaleString("es-ES")}
        icon={<Package size={20} />}
      />
      <KpiCard
        label="Reservas totales"
        value={stats.bookings.total.toLocaleString("es-ES")}
        icon={<Repeat size={20} />}
        sub={`${stats.bookings.accepted} activas ahora`}
      />
      <KpiCard
        label="Ingresos confirmados"
        value={EUR_FORMAT.format(stats.revenue)}
        icon={<TrendingUp size={20} />}
        accent
        sub="reservas completadas"
      />
    </div>
  );
}

/** Secondary row of KPIs (incidents, pending, completed, cancelled). */
function SecondaryKpis({ stats }: { stats: AdminStats }) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <KpiCard
        label="Incidencias abiertas"
        value={stats.incidents.open}
        icon={<AlertTriangle size={20} />}
        sub={`${stats.incidents.under_review} en revisión`}
      />
      <KpiCard
        label="Pendientes de acción"
        value={stats.bookings.pending}
        icon={<Clock size={20} />}
        sub="esperan respuesta del propietario"
      />
      <KpiCard
        label="Reservas completadas"
        value={stats.bookings.completed.toLocaleString("es-ES")}
        icon={<CheckCircle size={20} />}
        accent
      />
      <KpiCard
        label="Canceladas / rechazadas"
        value={(stats.bookings.cancelled + stats.bookings.rejected).toLocaleString("es-ES")}
        icon={<XCircle size={20} />}
      />
    </div>
  );
}

interface RecentIncidentsSectionProps {
  incidents: RecentIncident[];
  onViewAll: () => void;
}

/** Card listing the most recent incidents with a "view all" action. */
function RecentIncidentsSection({ incidents, onViewAll }: RecentIncidentsSectionProps) {
  return (
    <Card>
      <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold text-neutral-800">Incidencias recientes</h2>
          <p className="text-xs text-neutral-400">Las últimas abiertas en la plataforma</p>
        </div>
        <button
          type="button"
          onClick={onViewAll}
          className="inline-flex items-center gap-1 text-xs font-medium"
          style={{ color: GREEN }}
        >
          Ver todas <ArrowRight size={13} />
        </button>
      </div>

      {incidents.length === 0 ? (
        <p className="py-10 text-center text-sm text-neutral-400">Sin incidencias recientes.</p>
      ) : (
        <div className="divide-y divide-neutral-50">
          {incidents.map((inc) => (
            <div
              key={inc.incident_id}
              className="flex items-center gap-3 px-5 py-3.5 hover:bg-neutral-50"
            >
              <div
                className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${
                  isProductIncident(inc.type) ? "bg-blue-50 text-blue-600" : "bg-red-50 text-red-500"
                }`}
              >
                {isProductIncident(inc.type) ? <Package size={17} /> : <Users size={17} />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-neutral-900">{inc.item_title}</p>
                <p className="truncate text-xs text-neutral-500">
                  <span className={`font-medium ${PRIORITY_COLOR[inc.priority]}`}>{PRIORITY_LABEL[inc.priority]}</span>
                  {" · "}
                  {inc.reporter_name}
                  {" · "}
                  {fmtDate(inc.reported_at)}
                </p>
              </div>
              <Badge color={STATUS_BADGE[inc.status] ?? "gray"}>{STATUS_LABEL[inc.status] ?? inc.status}</Badge>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// ── Skeleton views ────────────────────────────────────────────────────────────

/** Loading placeholder for the top KPI row. */
function TopKpisSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {TOP_KPI_KEYS.map((k) => (
        <KpiSkeleton key={k} />
      ))}
    </div>
  );
}

/** Loading placeholder for the secondary KPI row. */
function SecondaryKpisSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {BOTTOM_KPI_KEYS.map((k) => (
        <KpiSkeleton key={k} />
      ))}
    </div>
  );
}

/** Loading placeholder for the recent-incidents card. */
function RecentIncidentsSkeleton() {
  return (
    <Card>
      <div className="border-b border-neutral-100 px-5 py-4">
        <div className="h-4 w-40 animate-pulse rounded bg-neutral-100" />
      </div>
      <div className="divide-y divide-neutral-50">
        {INCIDENT_SKELETON_KEYS.map((k) => (
          <div
            key={k}
            className="flex items-center gap-3 px-5 py-4"
          >
            <div className="size-10 animate-pulse rounded-lg bg-neutral-100" />
            <div className="flex-1 space-y-2">
              <div className="h-3.5 w-40 animate-pulse rounded bg-neutral-100" />
              <div className="h-3 w-24 animate-pulse rounded bg-neutral-100" />
            </div>
            <div className="h-5 w-16 animate-pulse rounded-full bg-neutral-100" />
          </div>
        ))}
      </div>
    </Card>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

/**
 * Admin dashboard — KPIs, revenue + category charts (lazy), and recent incidents.
 */
interface DashboardProps {
  onViewAllIncidents?: () => void;
}

function Dashboard({ onViewAllIncidents = () => undefined }: DashboardProps) {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStats()
      .then(setStats)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Error desconocido"));
  }, []);

  if (error) {
    return (
      <Card className="py-16 text-center">
        <p className="text-sm text-red-600">{error}</p>
      </Card>
    );
  }

  if (!stats) {
    return (
      <div className="space-y-5">
        <TopKpisSkeleton />
        <ChartFallback />
        <SecondaryKpisSkeleton />
        <RecentIncidentsSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <TopKpis stats={stats} />

      <DashboardCharts
        monthlyRevenue={stats.monthly_revenue}
        categories={stats.categories}
      />

      <SecondaryKpis stats={stats} />
      <RecentIncidentsSection
        incidents={stats.recent_incidents}
        onViewAll={onViewAllIncidents}
      />
    </div>
  );
}

export { Dashboard };
