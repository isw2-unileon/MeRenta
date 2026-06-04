import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CreditCard,
  LayoutDashboard,
  Package,
  Repeat,
  Settings as SettingsIcon,
  ShieldCheck,
  Users,
} from "lucide-react";

import type { ApiResponse } from "@/types/common";
import type { AdminVerificationListResponse } from "@/types/admin";
import type { IncidentListResponse, IncidentStatus } from "@/types/incident";
import type { SearchItemsResponse } from "@/types/item";
import { GREEN, MINT } from "@/components/admin/adminTokens";
import { Dashboard } from "@/pages/admin/views/Dashboard";
import { Incidents } from "@/pages/admin/views/Incidents";
import { Operations } from "@/pages/admin/views/Operations";
import { UsersView } from "@/pages/admin/views/Users";
import { Products } from "@/pages/admin/views/Products";
import { Payments } from "@/pages/admin/views/Payments";
import { Verification } from "@/pages/admin/views/Verification";
import { SettingsView } from "@/pages/admin/views/Settings";

// ── Nav config ─────────────────────────────────────────────────────────────────

type SectionId =
  | "dashboard"
  | "incidents"
  | "operations"
  | "users"
  | "products"
  | "payments"
  | "verification"
  | "settings";

interface NavItem {
  id: SectionId;
  label: string;
  Icon: React.ComponentType<{ size?: number }>;
  badge?: number | null;
}

const DEFAULT_NAV_ITEM: NavItem = { id: "dashboard", label: "Resumen", Icon: LayoutDashboard };

const NAV: NavItem[] = [
  DEFAULT_NAV_ITEM,
  { id: "incidents", label: "Incidencias", Icon: AlertTriangle },
  { id: "operations", label: "Operaciones", Icon: Repeat },
  { id: "users", label: "Usuarios", Icon: Users },
  { id: "products", label: "Productos", Icon: Package },
  { id: "payments", label: "Transacciones", Icon: CreditCard },
  { id: "verification", label: "Verificación", Icon: ShieldCheck, badge: 23 },
  { id: "settings", label: "Auditoría", Icon: SettingsIcon },
];

const VIEWS: Record<Exclude<SectionId, "dashboard">, React.ComponentType> = {
  incidents: Incidents,
  operations: Operations,
  users: UsersView,
  products: Products,
  payments: Payments,
  verification: Verification,
  settings: SettingsView,
};

async function fetchIncidentTotal(status: IncidentStatus): Promise<number> {
  const params = new URLSearchParams({ page: "1", limit: "1" });
  params.set("status", status);
  const res = await fetch(`/api/admin/incidents?${params.toString()}`, {
    credentials: "include",
  });
  const json = (await res.json()) as ApiResponse<IncidentListResponse>;
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.error ?? "Error al cargar incidencias");
  }
  return json.data.total;
}

async function fetchUnresolvedIncidentTotal(): Promise<number> {
  const totals = await Promise.all([fetchIncidentTotal("open"), fetchIncidentTotal("under_review")]);
  return totals.reduce((sum, total) => sum + total, 0);
}

async function fetchProductTotal(): Promise<number> {
  const params = new URLSearchParams({ page: "1", limit: "1" });
  const res = await fetch(`/api/admin/items?${params.toString()}`, {
    credentials: "include",
  });
  const json = (await res.json()) as ApiResponse<SearchItemsResponse>;
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.error ?? "Error al cargar productos");
  }
  return json.data.total;
}

async function fetchPendingVerificationTotal(): Promise<number> {
  const params = new URLSearchParams({ status: "pending", page: "1", limit: "1" });
  const res = await fetch(`/api/admin/verification?${params.toString()}`, {
    credentials: "include",
  });
  const json = (await res.json()) as ApiResponse<AdminVerificationListResponse>;
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.error ?? "Error al cargar verificaciones");
  }
  return json.data.total;
}

// ── Sidebar ────────────────────────────────────────────────────────────────────

interface SidebarProps {
  active: SectionId;
  navItems: NavItem[];
  onSelect: (id: SectionId) => void;
}

function Sidebar({ active, navItems, onSelect }: SidebarProps) {
  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-neutral-200 bg-white">
      {/* Logo */}
      <div className="flex h-16 items-center border-b border-neutral-100 px-5">
        <a
          href="/"
          aria-label="Ir a la página principal"
          className="text-logo text-ink inline-flex items-baseline gap-0 whitespace-nowrap font-bold tracking-normal"
        >
          <span>Me</span>
          <span className="text-primary">Renta</span>
        </a>
        <span
          className="ml-2 rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase"
          style={{ backgroundColor: MINT, color: GREEN }}
        >
          Admin
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
        {navItems.map(({ id, label, Icon, badge }) => {
          const on = active === id;
          return (
            <button
              type="button"
              key={id}
              onClick={() => onSelect(id)}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition"
              style={on ? { backgroundColor: MINT, color: GREEN } : { color: "#525252" }}
            >
              <Icon size={18} />
              <span className="flex-1 text-left">{label}</span>
              {badge !== undefined && (
                <span
                  className="rounded-full px-1.5 py-0.5 text-xs font-semibold"
                  style={
                    on ? { backgroundColor: "#fff", color: GREEN } : { backgroundColor: "#f3f4f6", color: "#6b7280" }
                  }
                >
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

    </aside>
  );
}

// ── Main shell ────────────────────────────────────────────────────────────────

/**
 * Admin panel shell — sidebar navigation + dynamic section rendering.
 * Each section is implemented progressively; unfinished ones show a placeholder.
 */
function AdminPanel() {
  const [active, setActive] = useState<SectionId>("dashboard");
  const [incidentBadge, setIncidentBadge] = useState<number | null>(null);
  const [productBadge, setProductBadge] = useState<number | null>(null);
  const [verificationBadge, setVerificationBadge] = useState<number | null>(null);

  const navItems = useMemo(
    () =>
      NAV.map((item) => {
        if (item.id === "incidents") return { ...item, badge: incidentBadge };
        if (item.id === "products") return { ...item, badge: productBadge };
        if (item.id === "verification") return { ...item, badge: verificationBadge };
        return item;
      }),
    [incidentBadge, productBadge, verificationBadge]
  );
  const current = navItems.find((n) => n.id === active) ?? DEFAULT_NAV_ITEM;

  const refreshIncidentBadge = useCallback(() => {
    fetchUnresolvedIncidentTotal()
      .then((total) => setIncidentBadge(total))
      .catch(() => setIncidentBadge(0));
  }, []);
  const refreshProductBadge = useCallback(() => {
    fetchProductTotal()
      .then((total) => setProductBadge(total))
      .catch(() => setProductBadge(0));
  }, []);
  const refreshVerificationBadge = useCallback(() => {
    fetchPendingVerificationTotal()
      .then((total) => setVerificationBadge(total))
      .catch(() => setVerificationBadge(0));
  }, []);
  const refreshIncidentBadgeRef = useRef(refreshIncidentBadge);
  const refreshProductBadgeRef = useRef(refreshProductBadge);
  const refreshVerificationBadgeRef = useRef(refreshVerificationBadge);

  useEffect(() => {
    refreshIncidentBadgeRef.current = refreshIncidentBadge;
  }, [refreshIncidentBadge]);

  useEffect(() => {
    refreshProductBadgeRef.current = refreshProductBadge;
  }, [refreshProductBadge]);

  useEffect(() => {
    refreshVerificationBadgeRef.current = refreshVerificationBadge;
  }, [refreshVerificationBadge]);

  useEffect(() => {
    const handleIncidentBadgeRefresh = () => {
      refreshIncidentBadgeRef.current();
    };
    handleIncidentBadgeRefresh();
    window.addEventListener("focus", handleIncidentBadgeRefresh);
    window.addEventListener("storage", handleIncidentBadgeRefresh);
    window.addEventListener("merenta:incidents-updated", handleIncidentBadgeRefresh);
    return () => {
      window.removeEventListener("focus", handleIncidentBadgeRefresh);
      window.removeEventListener("storage", handleIncidentBadgeRefresh);
      window.removeEventListener("merenta:incidents-updated", handleIncidentBadgeRefresh);
    };
  }, []);

  useEffect(() => {
    const handleProductBadgeRefresh = () => {
      refreshProductBadgeRef.current();
    };
    handleProductBadgeRefresh();
    window.addEventListener("focus", handleProductBadgeRefresh);
    window.addEventListener("storage", handleProductBadgeRefresh);
    window.addEventListener("merenta:products-updated", handleProductBadgeRefresh);
    return () => {
      window.removeEventListener("focus", handleProductBadgeRefresh);
      window.removeEventListener("storage", handleProductBadgeRefresh);
      window.removeEventListener("merenta:products-updated", handleProductBadgeRefresh);
    };
  }, []);

  useEffect(() => {
    const handleVerificationBadgeRefresh = () => {
      refreshVerificationBadgeRef.current();
    };
    handleVerificationBadgeRefresh();
    window.addEventListener("focus", handleVerificationBadgeRefresh);
    window.addEventListener("storage", handleVerificationBadgeRefresh);
    window.addEventListener("merenta:verification-updated", handleVerificationBadgeRefresh);
    return () => {
      window.removeEventListener("focus", handleVerificationBadgeRefresh);
      window.removeEventListener("storage", handleVerificationBadgeRefresh);
      window.removeEventListener("merenta:verification-updated", handleVerificationBadgeRefresh);
    };
  }, []);

  return (
    <div
      className="flex min-h-screen bg-stone-50 text-neutral-900"
      style={{ fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif" }}
    >
        <Sidebar
          active={active}
          navItems={navItems}
          onSelect={setActive}
        />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top header */}
        <header className="flex h-16 items-center gap-4 border-b border-neutral-200 bg-white px-6">
          <div>
            <h1 className="text-lg leading-tight font-bold">{current.label}</h1>
            <p className="text-xs text-neutral-400">Panel de administración · MeRenta</p>
          </div>
        </header>

        {/* Section content */}
        <main className="flex-1 overflow-y-auto p-6">
          {active === "dashboard" ? (
            <Dashboard onViewAllIncidents={() => setActive("incidents")} />
          ) : (
            React.createElement(VIEWS[active])
          )}
        </main>
      </div>
    </div>
  );
}

export { AdminPanel };
