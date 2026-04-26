import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

type AuthView = "login" | "register" | "forgot";

export function Login({ onSwitch }: { onSwitch: (v: AuthView) => void }) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="flex min-h-9/10 flex-col justify-between">
      <form className="flex flex-col gap-6">
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
        >
          Iniciar sesión
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
