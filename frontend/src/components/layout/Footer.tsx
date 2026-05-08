import { Link, useNavigate } from "react-router-dom";

function Footer() {
  const navigate = useNavigate();

  return (
    <footer className="h-footer bg-page border-border-main px-layout-margin border-t">
      <div className="max-w-alert-width mx-auto flex h-full items-center">
        <button
          className="text-logo-footer text-ink cursor-pointer border-none bg-transparent p-0 font-bold"
          onClick={() => navigate("/")}
        >
          Me<span className="text-primary">Renta</span>
        </button>

        <p className="text-card-loc text-footer-text ml-[80px]">
          2026 MeRenta · Trabajo Final de Ingeniería de Software II
        </p>

        <ul className="footer-links ml-auto">
          <li>
            <Link
              className="link-footer"
              to="/terms"
            >
              Términos
            </Link>
          </li>
          <li>
            <Link
              className="link-footer"
              to="/privacy"
            >
              Privacidad
            </Link>
          </li>
          <li>
            <Link
              className="link-footer"
              to="mailto:contact@merenta.com"
            >
              Contacto
            </Link>
          </li>
        </ul>
      </div>
    </footer>
  );
}

export { Footer };
