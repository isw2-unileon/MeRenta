/**
 * Chart components for the admin dashboard.
 *
 * recharts is loaded INSIDE the React.lazy() factory so it lands in a separate
 * async chunk — no static top-level import, which satisfies the
 * react-doctor/prefer-dynamic-import rule.
 */
import { lazy, Suspense } from "react";
// Type-only import: erased at build time, zero bundle impact.
// Required so TypeScript can type-check the dynamic import() inside the lazy factory.
import type * as RechartsTypes from "recharts";

import { GREEN, PASTELS } from "@/pages/admin/components/adminTokens";
import { Card } from "@/pages/admin/components/adminUi";

// ── Shared types ──────────────────────────────────────────────────────────────

export interface MonthlyPoint {
  month: string;
  revenue: number;
}

export interface CategoryPoint {
  category: string;
  count: number;
}

interface ChartsProps {
  monthlyRevenue: MonthlyPoint[];
  categories: CategoryPoint[];
}

// ── Module-level constants captured by the lazy factory closure ───────────────

const EUR_FULL = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 2 });

const CATEGORY_LABELS: Record<string, string> = {
  tools: "Herramientas",
  electronics: "Electrónica",
  sports: "Deporte",
  vehicles: "Vehículos",
  home: "Hogar",
  gardening: "Jardinería",
  clothing: "Ropa",
  music: "Música",
  photography: "Fotografía",
  camping: "Camping",
  leisure: "Ocio",
  other: "Otros",
};

// ── Lazy-loaded charts implementation ─────────────────────────────────────────
// recharts is imported inside the async factory — it only loads when the
// Suspense boundary is first rendered, keeping it out of the critical path.

const ChartsImpl = lazy(async () => {
  const Recharts: typeof RechartsTypes = await import("recharts");
  const { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } = Recharts;

  // Revenue tooltip — defined here so it closes over EUR_FULL
  function RevenueTooltip({
    active,
    payload,
    label,
  }: {
    active?: boolean;
    payload?: { value: number }[];
    label?: string;
  }) {
    if (!active || !payload?.length) return null;
    return (
      <div className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs shadow-md">
        <p className="font-medium text-neutral-700">{label}</p>
        <p
          className="font-bold"
          style={{ color: GREEN }}
        >
          {EUR_FULL.format(payload[0].value)}
        </p>
      </div>
    );
  }

  function Impl({ monthlyRevenue, categories }: ChartsProps) {
    const topCats = categories.slice(0, 6).map((c) => ({
      name: CATEGORY_LABELS[c.category] ?? c.category,
      count: c.count,
      key: c.category,
    }));

    return (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Revenue area chart */}
        <Card className="p-5 lg:col-span-2">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-neutral-800">Ingresos por mes</h2>
            <p className="text-xs text-neutral-400">Reservas completadas · últimos 6 meses</p>
          </div>
          <ResponsiveContainer
            width="100%"
            height={220}
          >
            <AreaChart
              data={monthlyRevenue}
              margin={{ left: -10, right: 8, top: 4, bottom: 0 }}
            >
              <defs>
                <linearGradient
                  id="revenueGrad"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="0%"
                    stopColor={GREEN}
                    stopOpacity={0.25}
                  />
                  <stop
                    offset="100%"
                    stopColor={GREEN}
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#f0f0f0"
                vertical={false}
              />
              <XAxis
                dataKey="month"
                tickLine={false}
                axisLine={false}
                fontSize={12}
                stroke="#9ca3af"
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                fontSize={11}
                stroke="#9ca3af"
                tickFormatter={(v: number) => `${v}€`}
              />
              <Tooltip content={<RevenueTooltip />} />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke={GREEN}
                strokeWidth={2.5}
                fill="url(#revenueGrad)"
                dot={{ fill: GREEN, r: 3 }}
                activeDot={{ r: 5, fill: GREEN }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        {/* Category bar chart */}
        <Card className="p-5">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-neutral-800">Productos por categoría</h2>
            <p className="text-xs text-neutral-400">Distribución del catálogo</p>
          </div>
          <ResponsiveContainer
            width="100%"
            height={220}
          >
            <BarChart
              data={topCats}
              margin={{ left: -22, right: 4, bottom: 20 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#f0f0f0"
                vertical={false}
              />
              <XAxis
                dataKey="name"
                tickLine={false}
                axisLine={false}
                fontSize={10}
                stroke="#9ca3af"
                interval={0}
                angle={-30}
                textAnchor="end"
                height={48}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                fontSize={11}
                stroke="#9ca3af"
                allowDecimals={false}
              />
              <Tooltip
                cursor={{ fill: "#f9fafb" }}
                contentStyle={{ borderRadius: 10, border: "1px solid #e5e7eb", fontSize: 12 }}
                formatter={(value: number) => [value, "productos"]}
              />
              <Bar
                dataKey="count"
                radius={[5, 5, 0, 0]}
              >
                {topCats.map((c, i) => (
                  <Cell
                    key={c.key}
                    fill={PASTELS[i % PASTELS.length]}
                    stroke={GREEN}
                    strokeWidth={0.8}
                    strokeOpacity={0.4}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>
    );
  }

  return { default: Impl };
});

// ── Fallback skeleton ─────────────────────────────────────────────────────────

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

// ── Public component ──────────────────────────────────────────────────────────

/**
 * Renders the revenue + category charts with a Suspense boundary.
 * recharts is loaded on demand — it's never in the initial bundle.
 */
export default function DashboardCharts({ monthlyRevenue, categories }: ChartsProps) {
  return (
    <Suspense fallback={<ChartFallback />}>
      <ChartsImpl
        monthlyRevenue={monthlyRevenue}
        categories={categories}
      />
    </Suspense>
  );
}
