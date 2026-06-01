import { useLocation, useNavigate } from "react-router-dom";

/** State passed by the Checkout page on a failed payment. */
interface ErrorState {
  errorCode: string;
  errorMessage: string;
  /** Path to navigate to when the user clicks "Intentar de nuevo". */
  returnPath: string;
}

/**
 * Full-page error card shown when a Stripe payment is declined or fails.
 * Reads error details from the router location state set by Checkout.
 *
 * @returns Payment error page JSX.
 */
function PaymentError() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = (location.state ?? {}) as Partial<ErrorState>;

  const {
    errorCode = "card_declined",
    errorMessage = "Tu tarjeta ha sido rechazada. Comprueba los datos o usa otra tarjeta.",
    returnPath = "/home",
  } = state;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--color-section-alt)] px-4 py-12">
      <div
        className="w-full rounded-[var(--radius-panel)] border border-[var(--color-border-main)] bg-white p-10"
        style={{ maxWidth: 480 }}
      >
        {/* ── Icon ── */}
        <div className="mb-6 flex justify-center">
          <div
            className="flex items-center justify-center rounded-full"
            style={{
              width: "var(--spacing-error-ring)",
              height: "var(--spacing-error-ring)",
              border: "8px solid #fde8e8",
            }}
          >
            <div
              className="flex items-center justify-center rounded-full"
              style={{
                width: "var(--spacing-error-icon)",
                height: "var(--spacing-error-icon)",
                backgroundColor: "#e53935",
              }}
            >
              <svg
                width="26"
                height="26"
                viewBox="0 0 40 40"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M12 12l16 16M28 12L12 28"
                  stroke="white"
                  strokeWidth="4.5"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </div>
        </div>

        {/* ── Title ── */}
        <p className="error-pay-title mb-1 text-center">Pago rechazado</p>
        <p className="error-pay-desc mb-5 text-center">No se pudo procesar el pago. No se ha realizado ningun cargo.</p>

        {/* ── Stripe error box ── */}
        <div className="mb-5 rounded-[var(--radius-md)] bg-[var(--color-error-info)] px-4 py-3">
          <p className="text-[13px] font-medium text-[#b71c1c]">
            Error Stripe: <span>{errorCode}</span>
          </p>
          <p className="mt-1 text-[13px] text-[var(--color-subtle)]">{errorMessage}</p>
        </div>

        {/* ── Retry button ── */}
        <button
          type="button"
          className="btn-danger btn--error-pay mb-3 w-full"
          onClick={() => void navigate(returnPath)}
        >
          Intentar de nuevo
        </button>

        {/* ── Cancel link ── */}
        <button
          type="button"
          className="error-pay-cancel mb-5 w-full"
          onClick={() => void navigate("/home")}
        >
          Cancelar y volver al alquiler
        </button>

        {/* ── Support ── */}
        <p className="error-pay-support text-center">
          ¿Sigues teniendo problemas? Contacta en{" "}
          <a
            href="mailto:contact@merenta.es"
            className="text-primary underline"
          >
            contact@merenta.es
          </a>{" "}
          o desde el chat.
        </p>
      </div>
    </div>
  );
}

export { PaymentError };
