import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Heart, MessageSquare } from "lucide-react";

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

  return (
    <nav className="h-navbar bg-page border-border-main fixed top-0 right-0 left-0 z-50 border-b">
      <div className="max-w-alert-width px-nav-margin mx-auto flex h-full items-center justify-between">
        <button
          className="text-logo text-ink cursor-pointer border-none bg-transparent p-0 font-bold"
          onClick={() => navigate("/home")}
        >
          Me<span className="text-primary">Renta</span>
        </button>

        <ul className="nav-list">
          <li>
            <a
              className="link-nav"
              href="/search"
            >
              Explorar
            </a>
          </li>
          <li>
            <a
              className="link-nav"
              href="#categorias"
            >
              Categorías
            </a>
          </li>
          <li>
            <a
              className="link-nav"
              href="#como-funciona"
            >
              Cómo funciona
            </a>
          </li>
        </ul>

        <div className="flex items-center gap-4">
          <button
            className="btn-icon"
            onClick={() => navigate("/favs")}
            aria-label="Favoritos"
          >
            <Heart size={16} />
          </button>

          <button
            className="btn-icon"
            onClick={() => navigate("/chat")}
            aria-label="Mensajes"
          >
            <MessageSquare size={16} />
          </button>

          <button
            className="flex cursor-pointer items-center gap-2 border-none bg-transparent p-0"
            onClick={() => navigate("/profile")}
          >
            {user.avatar_url ? (
              <img
                src={user.avatar_url}
                alt={fullName}
                className="h-8 w-8 rounded-full object-cover"
              />
            ) : (
              <div className="avatar-initials">{initials}</div>
            )}

            <span className="text-body text-ink font-medium">{displayName}</span>
          </button>

          <button
            className="btn-primary btn--md"
            onClick={() => navigate("/product/new")}
          >
            + Publicar producto
          </button>
        </div>
      </div>
    </nav>
  );
}

export { NavbarAuth };