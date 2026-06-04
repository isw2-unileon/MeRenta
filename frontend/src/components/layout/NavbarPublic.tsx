import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

/**
 * Renders the public navigation bar for unauthenticated visitors.
 * @returns The public navigation UI with anchor links and auth actions.
 */
function NavbarPublic() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <nav className="h-navbar bg-page border-border-main fixed top-0 right-0 left-0 z-50 border-b">
      <div className="max-w-alert-width px-nav-margin mx-auto flex h-full items-center justify-between">
        <button
          type="button"
          className="text-logo text-ink inline-flex cursor-pointer items-baseline gap-0 border-none bg-transparent p-0 font-bold tracking-normal whitespace-nowrap"
          onClick={() => navigate("/")}
        >
          <span>Me</span>
          <span className="text-primary">Renta</span>
        </button>

        {!isLoading && !isAuthenticated ? (
          <>
            <div className="flex items-center gap-8">
              <ul className="nav-list">
                <li>
                  <a
                    className="link-nav"
                    href="#categorias"
                  >
                    Categorias
                  </a>
                </li>
                <li>
                  <a
                    className="link-nav"
                    href="#como-funciona"
                  >
                    Como funciona
                  </a>
                </li>
              </ul>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                className="btn-secondary btn--md"
                onClick={() => navigate("/auth", { state: { view: "login" } })}
              >
                Iniciar sesion
              </button>
              <button
                type="button"
                className="btn-primary btn--md"
                onClick={() => navigate("/auth", { state: { view: "register" } })}
              >
                Registrarse
              </button>
            </div>
          </>
        ) : null}
      </div>
    </nav>
  );
}

export { NavbarPublic };
