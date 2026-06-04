import { Link, Navigate, useLocation } from "react-router-dom";
import { useState } from "react";

import { Login } from "@/components/auth/Login";
import { Register } from "@/components/auth/Register";
import { ForgotPassword } from "@/components/auth/ForgotPassword";
import { useAuth } from "@/hooks/useAuth";

type AuthView = "login" | "register" | "forgot";

/**
 * Hosts login, registration, and recovery flows in a single page.
 * @returns The authentication layout with tabs and selected view.
 */
function Auth() {
  const location = useLocation();
  const { isAuthenticated, isLoading } = useAuth();

  const initialView = (location.state as { view?: AuthView } | null)?.view;
  const normalizedInitialView: AuthView =
    initialView === "login" || initialView === "register" || initialView === "forgot" ? initialView : "login";

  const [view, setView] = useState<AuthView>(normalizedInitialView);

  if (isLoading) {
    return null;
  }

  if (isAuthenticated) {
    return (
      <Navigate
        to="/home"
        replace
      />
    );
  }

  const showTabs = view !== "forgot";

  return (
    <main className="min-h-dvh w-full">
      <section className="grid min-h-dvh grid-cols-2">
        <div className="from-primary to-primary-dark relative flex flex-col justify-center overflow-hidden bg-linear-to-br px-16 py-20 text-white">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,white,transparent)] opacity-10" />

          <h1 className="mt-5 self-center text-center text-6xl leading-tight font-semibold text-white/90">
            Únete a MeRenta
          </h1>

          <p className="text-body-lg mt-6 max-w-md self-center text-center text-white/70">
            Forma parte de la comunidad que comparte.
          </p>

          <p className="text-body-lg mt-8 max-w-md self-center text-center text-white/60">o</p>

          <Link
            to="/"
            className="text-body-lg mt-6 max-w-md self-center text-center text-white/75 transition-all hover:scale-110"
          >
            Vuelve al inicio
          </Link>
        </div>

        <div className="bg-section-alt flex items-center justify-center px-8 py-16">
          <div className={view === "forgot" ? "auth-card--recovery w-full max-w-xl" : "auth-card w-full max-w-xl"}>
            {showTabs && (
              <nav className="auth-tabs mt-2 gap-16 py-1">
                <button
                  type="button"
                  onClick={() => setView("login")}
                  className="relative px-3 py-2"
                >
                  <p className={`text-base ${view === "login" ? "auth-tab" : "auth-tab--inactive"}`}>Iniciar sesión</p>

                  {view === "login" && (
                    <span className="bg-primary w-credit-card-h absolute -bottom-1 left-1/2 h-0.5 -translate-x-1/2 rounded-full" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setView("register")}
                  className="relative px-3 py-2"
                >
                  <p className={`text-base ${view === "register" ? "auth-tab" : "auth-tab--inactive"}`}>Crear cuenta</p>

                  {view === "register" && (
                    <span className="bg-primary w-credit-card-h absolute -bottom-1 left-1/2 h-0.5 -translate-x-1/2 rounded-full" />
                  )}
                </button>
              </nav>
            )}

            <div className={view === "forgot" ? "" : "flex min-h-9/10 flex-col justify-center px-8 py-6"}>
              {view === "login" && <Login onSwitch={setView} />}
              {view === "register" && <Register onSwitch={setView} />}
              {view === "forgot" && <ForgotPassword onSwitch={setView} />}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

export { Auth };
