type AuthView = "login" | "register" | "forgot";

export function ForgotPassword({ onSwitch }: { onSwitch: (v: AuthView) => void }) {
  return (
    <div className="flex min-h-9/10 flex-col">
      <span className="eyebrow">RECUPERACIÓN DE ACCESO</span>

      <h2 className="heading-auth-recovery mt-3">¿Olvidaste tu contraseña?</h2>

      <p className="auth-recovery-desc mt-3">Te enviamos un enlace a tu email para restablecer tu contraseña.</p>

      <div className="auth-info-box mt-5">
        <p className="auth-info-box-text">
          Introduce el email con el que te registraste y recibirás las instrucciones en tu bandeja.
        </p>
      </div>

      <form className="mt-6 flex flex-col gap-5">
        <div>
          <label
            className="label-auth"
            htmlFor="forgot-email"
          >
            Email de tu cuenta
          </label>

          <input
            id="forgot-email"
            className="input-auth"
            placeholder="tu@email.com"
            type="email"
            autoComplete="email"
          />
        </div>

        <button
          className="btn-auth-submit"
          type="submit"
        >
          Enviar instrucciones
        </button>
      </form>

      <button
        type="button"
        onClick={() => onSwitch("login")}
        className="mt-5 self-start p-0"
      >
        <p className="auth-link">Volver al inicio de sesión</p>
      </button>
    </div>
  );
}
