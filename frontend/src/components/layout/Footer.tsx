import { Link, useNavigate } from "react-router-dom";

/**
 * Renders the site footer with legal links and branding.
 * @returns The footer UI used across public layouts.
 */
function Footer() {
  const navigate = useNavigate();

  return (
    <footer className="h-footer bg-page border-border-main px-layout-margin border-t">
      <div className="max-w-alert-width mx-auto flex h-full items-center">
        <button
          type="button"
          className="text-logo-footer text-ink inline-flex cursor-pointer items-baseline gap-0 border-none bg-transparent p-0 font-bold tracking-normal whitespace-nowrap"
          onClick={() => navigate("/")}
        >
          <span>Me</span>
          <span className="text-primary">Renta</span>
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
