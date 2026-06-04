import { type ChangeEvent, type FormEventHandler, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { BlockedAccountError } from "@/types/auth";

type AuthView = "login" | "register" | "forgot";

/**
 * Renders the login form and coordinates auth flow transitions.
 * @param onSwitch Callback to swap between auth views.
 * @returns The login form UI with validation and feedback.
 */
function Login({ onSwitch }: { onSwitch: (v: AuthView) => void }) {
  const { login, isLoading } = useAuth();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string>("");
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  /**
   * Syncs form state with the email/password inputs.
   * @param e Input change event from the login form.
   */
  const updateLoginField = (e: ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    if (id === "login-email") {
      setFormData((prev) => ({ ...prev, email: value }));
    }
    if (id === "login-password") {
      setFormData((prev) => ({ ...prev, password: value }));
    }
  };

  /**
   * Validates credentials and triggers the login request.
   * @param e Form submit event for the login action.
   */
  const handleSubmit: FormEventHandler<HTMLFormElement> = (e) => {
    e.preventDefault();
    setError("");

    if (!formData.email.trim()) {
      setError("El email es requerido");
      return;
    }

    if (!formData.password) {
      setError("La contraseña es requerida");
      return;
    }

    const runLogin = async () => {
      try {
        await login({
          email: formData.email.trim(),
          password: formData.password,
        });
        setFormData({ email: "", password: "" });
        await navigate("/home", { replace: true });
      } catch (err) {
        if (err instanceof BlockedAccountError) {
          if (err.reason === "banned") {
            await navigate("/banned", { replace: true });
          } else {
            const query = err.suspendedUntil ? `?until=${encodeURIComponent(err.suspendedUntil)}` : "";
            await navigate(`/suspended${query}`, { replace: true });
          }
          return;
        }
        setError(err instanceof Error ? err.message : "Error al iniciar sesión");
      }
    };

    void runLogin();
  };

  return (
    <div className="flex min-h-9/10 flex-col justify-between">
      <form
        className="flex flex-col gap-6"
        onSubmit={handleSubmit}
      >
        {error && <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-600">{error}</div>}

        <div>
          <label
            className="label-auth"
            htmlFor="login-email"
          >
            Email
          </label>
          <input
            id="login-email"
            className="input-auth"
            type="email"
            placeholder="tu@email.com"
            autoComplete="email"
            aria-label="Email"
            value={formData.email}
            onChange={updateLoginField}
            required
          />
        </div>

        <div>
          <label
            className="label-auth"
            htmlFor="login-password"
          >
            Contraseña
          </label>

          <div className="relative">
            <input
              id="login-password"
              className="input-auth pr-12"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              autoComplete="current-password"
              aria-label="Contraseña"
              value={formData.password}
              onChange={updateLoginField}
              required
            />

            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="text-subtle hover:text-primary absolute top-1/2 right-4 size-6 -translate-y-1/2 p-0"
              aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
            >
              {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onSwitch("forgot")}
          className="self-end p-0"
        >
          <p className="auth-forgot">¿Olvidaste tu contraseña?</p>
        </button>

        <button
          className="btn-auth-submit"
          type="submit"
          disabled={isLoading}
        >
          {isLoading ? "Iniciando sesión..." : "Iniciar sesión"}
        </button>
      </form>

      <div className="mt-5 flex justify-center gap-3">
        <p className="auth-secondary-text">¿No tienes cuenta?</p>

        <button
          type="button"
          onClick={() => onSwitch("register")}
          className="p-0"
        >
          <p className="auth-link">Regístrate gratis</p>
        </button>
      </div>
    </div>
  );
}

export { Login };
