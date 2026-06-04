import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { BadgeCheck, CalendarDays, Heart, LayoutDashboard, LogOut, MessageSquare } from "lucide-react";

/**
 * Renders the authenticated navigation bar with profile shortcuts.
 * @returns The private navigation UI or null while unauthenticated.
 */
function NavbarAuth() {
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoading, logout } = useAuth();

  if (isLoading) {
    return null;
  }

  if (!isAuthenticated || !user) {
    return null;
  }

  const fullName = `${user.first_name} ${user.last_name}`;

  const initials = fullName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const displayName = user.last_name ? `${user.first_name} ${user.last_name[0]}.` : user.first_name;

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      void navigate("/", { replace: true });
    }
  };

  return (
    <nav className="h-navbar bg-page border-border-main fixed top-0 right-0 left-0 z-50 border-b">
      <div className="max-w-alert-width px-nav-margin mx-auto flex h-full items-center justify-between">
        <div className="flex items-center gap-8">
          <button
            type="button"
            className="text-logo text-ink inline-flex cursor-pointer items-baseline gap-0 border-none bg-transparent p-0 font-bold tracking-normal whitespace-nowrap"
            onClick={() => navigate("/home")}
          >
            <span>Me</span>
            <span className="text-primary">Renta</span>
          </button>

          <ul className="nav-list">
            <li>
              <button
                type="button"
                className="link-nav"
                onClick={() => navigate("/search")}
              >
                Explorar
              </button>
            </li>
            <li>
              <button
                type="button"
                className="border-primary text-primary hover:bg-primary rounded-full border-2 p-2.5 hover:text-white"
                onClick={() => navigate("/product/new")}
              >
                Publicar +
              </button>
            </li>
          </ul>
        </div>

        <div className="flex items-center gap-4">
          {user.user_role === "admin" && (
            <button
              type="button"
              className="btn-icon"
              onClick={() => navigate("/admin")}
              aria-label="Panel de administración"
              title="Panel de administración"
            >
              <LayoutDashboard size={16} />
            </button>
          )}

          <button
            type="button"
            className="btn-icon"
            onClick={() => navigate("/bookings")}
            aria-label="Mis reservas"
            title="Mis reservas"
          >
            <CalendarDays size={16} />
          </button>

          <button
            type="button"
            className="btn-icon"
            onClick={() => navigate("/favs")}
            aria-label="Favoritos"
            title="Favoritos"
          >
            <Heart size={16} />
          </button>

          <button
            type="button"
            className="btn-icon"
            onClick={() => navigate("/chat")}
            aria-label="Mensajes"
            title="Mensajes"
          >
            <MessageSquare size={16} />
          </button>

          <button
            type="button"
            className="flex cursor-pointer items-center gap-2 border-none bg-transparent p-0"
            onClick={() => navigate("/profile")}
            aria-label="Ver perfil"
            title="Ver perfil"
          >
            {user.avatar_url ? (
              <img
                src={user.avatar_url}
                alt={fullName}
                className="size-8 rounded-full object-cover"
              />
            ) : (
              <div className="avatar-initials">{initials}</div>
            )}

            <span className="flex items-center gap-1">
              <span className="text-body text-ink font-medium">{displayName}</span>
              {user.verification_status === "verified" && (
                <BadgeCheck
                  size={16}
                  className="text-primary shrink-0"
                  aria-label="Perfil verificado"
                />
              )}
            </span>
          </button>

          <button
            type="button"
            aria-label="Cerrar sesión"
            title="Cerrar sesión"
            onClick={handleLogout}
          >
            <LogOut className="stroke-nav transition-all hover:scale-110 hover:stroke-red-700" />
          </button>
        </div>
      </div>
    </nav>
  );
}

export { NavbarAuth };
