import { useLocation, useNavigate } from "react-router-dom";

/** State passed by the Checkout page on a failed payment. */
interface ErrorState {
  errorCode: string;
  errorMessage: string;
  /** Path to navigate to when the user clicks "Intentar de nuevo". */
  returnPath: string;
}

/**
 * Full-page error screen shown when a Stripe payment is declined or fails.
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

  const handleRetry = () => void navigate(returnPath);
  const handleCancel = () => void navigate("/home");

  return (
    <div className="bg-section-alt flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div
        className="w-full rounded-(--radius-panel) border border-(--color-border-main) bg-white p-10"
        style={{ maxWidth: 600 }}
      >
        <div className="mb-6 flex justify-center">
          <div className="error-pay-icon-ring">
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
        </div>

        <p className="error-pay-title mb-1 text-center">Pago rechazado</p>
        <p className="error-pay-desc mb-6 text-center">No se pudo procesar el pago. No se ha realizado ningún cargo.</p>

        <div className="error-pay-stripe-box mb-6 w-full">
          <p className="error-pay-code">
            Error Stripe: <span>{errorCode}</span>
          </p>
          <p className="mt-1 text-[13px] text-(--color-subtle)">{errorMessage}</p>
        </div>

        <button
          type="button"
          className="btn-danger btn--error-pay mb-3 w-full"
          onClick={handleRetry}
        >
          Intentar de nuevo
        </button>

        <div className="mb-4 flex justify-center">
          <button
            type="button"
            className="error-pay-cancel"
            onClick={handleCancel}
          >
            Cancelar y volver al alquiler
          </button>
        </div>

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
