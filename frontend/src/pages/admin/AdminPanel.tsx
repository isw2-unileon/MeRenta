import { useState } from "react";
import {
  AlertTriangle,
  Bell,
  CreditCard,
  LayoutDashboard,
  Package,
  Repeat,
  Search,
  Settings as SettingsIcon,
  ShieldCheck,
  Users,
} from "lucide-react";

import { useAuth } from "@/hooks/useAuth";
import { GREEN, MINT } from "@/pages/admin/components/adminTokens";
import { Avatar } from "@/pages/admin/components/adminUi";
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
  badge?: number;
}

const DEFAULT_NAV_ITEM: NavItem = { id: "dashboard", label: "Resumen", Icon: LayoutDashboard };

const NAV: NavItem[] = [
  DEFAULT_NAV_ITEM,
  { id: "incidents", label: "Incidencias", Icon: AlertTriangle, badge: 37 },
  { id: "operations", label: "Operaciones", Icon: Repeat },
  { id: "users", label: "Usuarios", Icon: Users },
  { id: "products", label: "Productos", Icon: Package, badge: 184 },
  { id: "payments", label: "Pagos y disputas", Icon: CreditCard },
  { id: "verification", label: "Verificación", Icon: ShieldCheck, badge: 23 },
  { id: "settings", label: "Auditoría y ajustes", Icon: SettingsIcon },
];

const VIEWS: Record<SectionId, React.ComponentType> = {
  dashboard: Dashboard,
  incidents: Incidents,
  operations: Operations,
  users: UsersView,
  products: Products,
  payments: Payments,
  verification: Verification,
  settings: SettingsView,
};

// ── Sidebar ────────────────────────────────────────────────────────────────────

interface SidebarProps {
  active: SectionId;
  onSelect: (id: SectionId) => void;
  userEmail: string;
  userName: string;
}

function Sidebar({ active, onSelect, userEmail, userName }: SidebarProps) {
  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-neutral-200 bg-white">
      {/* Logo */}
      <div className="flex h-16 items-center border-b border-neutral-100 px-5">
        <span
          className="text-xl font-light text-neutral-900"
          style={{ fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif" }}
        >
          Me
          <span
            className="font-bold"
            style={{ color: GREEN }}
          >
            Renta
          </span>
        </span>
        <span
          className="ml-2 rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase"
          style={{ backgroundColor: MINT, color: GREEN }}
        >
          Admin
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
        {NAV.map(({ id, label, Icon, badge }) => {
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

      {/* User footer */}
      <div className="flex items-center gap-3 border-t border-neutral-100 p-3">
        <Avatar
          initials={userName.slice(0, 2).toUpperCase()}
          size={34}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{userName}</p>
          <p className="truncate text-xs text-neutral-400">{userEmail}</p>
        </div>
      </div>
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
  const { user } = useAuth();

  const View = VIEWS[active];
  const current = NAV.find((n) => n.id === active) ?? DEFAULT_NAV_ITEM;

  const userName = user ? `${user.first_name} ${user.last_name}` : "Admin";
  const userEmail = user?.email ?? "";

  return (
    <div
      className="flex min-h-screen bg-stone-50 text-neutral-900"
      style={{ fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif" }}
    >
      <Sidebar
        active={active}
        onSelect={setActive}
        userEmail={userEmail}
        userName={userName}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top header */}
        <header className="flex h-16 items-center gap-4 border-b border-neutral-200 bg-white px-6">
          <div>
            <h1 className="text-lg leading-tight font-bold">{current.label}</h1>
            <p className="text-xs text-neutral-400">Panel de administración · MeRenta</p>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <div className="relative hidden sm:block">
              <Search
                size={15}
                className="absolute top-2.5 left-3 text-neutral-400"
              />
              <input
                aria-label="Buscar en el panel de administración"
                placeholder="Buscar..."
                className="w-48 rounded-lg border border-neutral-200 py-2 pr-3 pl-9 text-sm outline-none focus:border-emerald-500"
              />
            </div>
            <button
              type="button"
              aria-label="Ver notificaciones"
              className="relative flex size-9 items-center justify-center rounded-full bg-neutral-100 text-neutral-600"
            >
              <Bell size={17} />
              <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-red-500" />
            </button>
          </div>
        </header>

        {/* Section content */}
        <main className="flex-1 overflow-y-auto p-6">
          <View />
        </main>
      </div>
    </div>
  );
}

export { AdminPanel };
