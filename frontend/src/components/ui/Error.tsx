type ErrorCode = 404 | 403 | 500;

interface ErrorInfo {
  title: string;
  description: string;
  hint: string;
  buttonText: string;
  variant: "info" | "danger";
}

const errors: Record<ErrorCode, ErrorInfo> = {
  404: {
    title: "Pagina no encontrada",
    description:
      "La pagina que buscas no existe o ha sido movida. Puede que hayas escrito mal la URL o el enlace haya expirado.",
    hint: "Comprueba la URL o vuelve al inicio.",
    buttonText: "Volver al inicio",
    variant: "info",
  },
  403: {
    title: "Sin acceso a la página",
    description:
      "El acceso a la página solicitada está restringido, puede que hayas intentado acceder a una URL incorrecta o de otra sesión.",
    hint: "Comprueba la URL o vuelve al inicio.",
    buttonText: "Volver al inicio",
    variant: "info",
  },
  500: {
    title: "Error del servidor",
    description:
      "Algo ha fallado en nuestro lado. El equipo ha sido notificado y trabaja en solucionarlo cuanto antes.",
    hint: "No es culpa tuya. Intenta de nuevo en unos minutos.",
    buttonText: "Recargar la página",
    variant: "danger",
  },
};

interface ErrorProps {
  code: ErrorCode;
  onAction?: () => void;
}

function Error({ code, onAction }: ErrorProps) {
  const error = errors[code];
  const isDanger = error.variant === "danger";

  const runErrorAction = () => {
    if (onAction) {
      onAction();
    } else {
      if (isDanger) {
        window.location.reload();
      } else {
        window.location.href = "/";
      }
    }
  };

  return (
    <article className="error-card gap-4">
      <div className={`error-icon-wrapper error-icon-wrapper--${error.variant}`}>
        <div className={`error-icon-circle error-icon-circle--${error.variant}`}>
          <p className={`error-code error-code--${error.variant}`}>{code}</p>
        </div>
      </div>

      <h3 className="heading-error">{error.title}</h3>

      <p className="error-desc">{error.description}</p>

      <div className={`error-hint-box error-hint-box--${error.variant}`}>
        <p className={`error-hint error-hint--${error.variant}`}>{error.hint}</p>
      </div>

      <button
        type="button"
        className={`${isDanger ? "btn-danger" : "btn-primary"} btn--error mt-auto`}
        onClick={runErrorAction}
      >
        {error.buttonText}
      </button>
    </article>
  );
}

export { Error };
