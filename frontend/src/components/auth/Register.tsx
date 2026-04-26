import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

type AuthView = "login" | "register" | "forgot";

export function Register({ onSwitch }: { onSwitch: (v: AuthView) => void }) {
  const [showPassword, setShowPassword] = useState(false);
  const [showRepeat, setShowRepeat] = useState(false);

  return (
    <div className="flex min-h-9/10 flex-col justify-between">
      <form className="flex flex-col gap-4">
        <div>
          <label
            className="label-auth required"
            htmlFor="register-name"
          >
            Nombre completo
          </label>
          <input
            id="register-name"
            className="input-auth"
            type="text"
            placeholder="Tu nombre"
            autoComplete="name"
          />
        </div>

        <div>
          <label
            className="label-auth required"
            htmlFor="register-email"
          >
            Email
          </label>
          <input
            id="register-email"
            className="input-auth"
            type="email"
            placeholder="tu@email.com"
            autoComplete="email"
          />
        </div>

        <div>
          <label
            className="label-auth required"
            htmlFor="register-password"
          >
            Contraseña
          </label>

          <div className="relative">
            <input
              id="register-password"
              className="input-auth pr-12"
              type={showPassword ? "text" : "password"}
              placeholder="Crea una contraseña"
              autoComplete="new-password"
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

        <div>
          <label
            className="label-auth required"
            htmlFor="register-repeat-password"
          >
            Repetir contraseña
          </label>

          <div className="relative">
            <input
              id="register-repeat-password"
              className="input-auth pr-12"
              type={showRepeat ? "text" : "password"}
              placeholder="Repite la contraseña"
              autoComplete="new-password"
            />

            <button
              type="button"
              onClick={() => setShowRepeat((value) => !value)}
              className="text-subtle hover:text-primary absolute top-1/2 right-4 size-6 -translate-y-1/2 p-0"
              aria-label={showRepeat ? "Ocultar contraseña repetida" : "Mostrar contraseña repetida"}
            >
              {showRepeat ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
            </button>
          </div>
        </div>

        <button
          className="btn-auth-submit"
          type="submit"
        >
          Crear cuenta
        </button>
      </form>

      <div className="mt-5 flex justify-center gap-3">
        <p className="auth-secondary-text">¿Ya tienes cuenta?</p>

        <button
          type="button"
          onClick={() => onSwitch("login")}
          className="p-0"
        >
          <p className="auth-link">Inicia sesión</p>
        </button>
      </div>
    </div>
  );
}
