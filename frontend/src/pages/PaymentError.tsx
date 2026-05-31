import { useLocation, useNavigate } from "react-router-dom";

/** State passed by the Checkout page on a failed payment. */
interface ErrorState {
  errorCode: string;
  errorMessage: string;
  /** Path to navigate to when the user clicks "Intentar de nuevo". */
  returnPath: string;
}

/**
 * Full-page error modal shown when a Stripe payment is declined or fails.
 * Reads error details from the router location state set by Checkout.
 *
 * @returns Payment error modal JSX.
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

  const handleRetry = () => {
    void navigate(returnPath);
  };
  const handleCancel = () => {
    void navigate("/home");
  };

  return (
    /* Full-screen overlay */
    <div className="modal-overlay">
      <div
        className="modal-error-pay"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="error-pay-title"
      >
        {/* ── Icon ── */}
        <div className="error-pay-icon-ring mb-3">
          <div className="error-pay-icon-circle">
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

        {/* ── Title ── */}
        <p
          id="error-pay-title"
          className="error-pay-title mb-1 text-center"
        >
          Pago rechazado
        </p>
        <p className="error-pay-desc mb-4 text-center">No se pudo procesar el pago. No se ha realizado ningun cargo.</p>

        {/* ── Stripe error box ── */}
        <div className="error-pay-stripe-box mb-5 w-full">
          <p className="error-pay-code">
            Error Stripe: <span>{errorCode}</span>
          </p>
          <p className="error-pay-subdesc mt-1">{errorMessage}</p>
        </div>

        {/* ── Action button ── */}
        <div className="mb-3 w-full">
          <button
            type="button"
            className="btn-danger btn--error-pay w-full"
            onClick={handleRetry}
          >
            Intentar de nuevo
          </button>
        </div>

        {/* ── Cancel link ── */}
        <p
          className="error-pay-cancel mb-4"
          onClick={handleCancel}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && handleCancel()}
        >
          Cancelar y volver al alquiler
        </p>

        {/* ── Support ── */}
        <p className="error-pay-support text-center">
          ¿Sigues teniendo problemas? Contacta en{" "}
          <a
            href="mailto:soporte@merenta.es"
            className="text-[var(--color-primary)] underline"
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
