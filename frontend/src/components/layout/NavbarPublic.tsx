import { useNavigate } from "react-router-dom";

function NavbarPublic() {
  const navigate = useNavigate();

  return (
    <nav className="h-navbar bg-page border-border-main fixed top-0 right-0 left-0 z-50 border-b">
      <div className="max-w-alert-width px-nav-margin mx-auto flex h-full items-center justify-between">
        <button
          className="text-logo text-ink cursor-pointer border-none bg-transparent p-0 font-bold"
          onClick={() => navigate("/")}
        >
          Me<span className="text-primary">Renta</span>
        </button>

        <ul className="nav-list">
          <li>
            <a
              className="link-nav"
              href="#como-funciona"
            >
              Como funciona
            </a>
          </li>
          <li>
            <a
              className="link-nav"
              href="#categorias"
            >
              Categorias
            </a>
          </li>
        </ul>

        <div className="flex items-center gap-2.5">
          <button
            className="btn-secondary btn--md"
            onClick={() => navigate("/auth")}
          >
            Iniciar sesion
          </button>
          <button
            className="btn-primary btn--md"
            onClick={() => navigate("/auth")}
          >
            Registrarse
          </button>
        </div>
      </div>
    </nav>
  );
}

export { NavbarPublic };
