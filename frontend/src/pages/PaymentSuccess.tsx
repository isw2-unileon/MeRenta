import { useLocation, useNavigate } from "react-router-dom";

/** State passed by the Checkout page on successful payment. */
interface SuccessState {
  paymentIntentId: string;
  amountEUR: number;
  itemTitle: string;
  itemImageUrl: string;
  startDate: string;
  endDate: string;
  days: number;
}

/** Formats a "YYYY-MM-DD" string as a Spanish short date, e.g. "15 may". */
function fmtDateShort(value: string): string {
  const [y, mo, d] = value.split("-").map(Number);
  const date = new Date(y ?? 0, (mo ?? 1) - 1, d ?? 1);
  return date.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

/** Formats a number as a price with comma decimal, e.g. 65.9 → "65,90". */
function fmtPrice(value: number): string {
  return value.toFixed(2).replace(".", ",");
}

/** Generates a deterministic mock policy number based on the PaymentIntent ID. */
function mockPolicyNumber(paymentIntentId: string): string {
  const year = new Date().getFullYear();
  const suffix = paymentIntentId.slice(-4).toUpperCase();
  return `MR-${year}-${suffix}`;
}

/**
 * Confirmation page shown after a successful Stripe payment.
 * Reads rental details from the router location state set by Checkout.
 *
 * @returns Payment success card JSX.
 */
function PaymentSuccess() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = (location.state ?? {}) as Partial<SuccessState>;

  const {
    paymentIntentId = "pi_test_xxxxxxxxxxxxxxxx",
    amountEUR = 0,
    itemTitle = "Artículo",
    itemImageUrl = "",
    startDate = "",
    endDate = "",
    days = 0,
  } = state;

  const policyNumber = mockPolicyNumber(paymentIntentId);
  const startShort = startDate ? fmtDateShort(startDate) : "—";
  const endShort = endDate ? fmtDateShort(endDate) : "—";
  const year = startDate ? startDate.slice(0, 4) : new Date().getFullYear().toString();

  return (
    <div className="bg-section-alt flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div
        className="border-border-main w-full rounded-(--radius-panel) border bg-white p-10"
        style={{ maxWidth: 600 }}
      >
        {/* ── Icon ── */}
        <div className="mb-6 flex justify-center">
          <div
            className="flex items-center justify-center rounded-full"
            style={{
              width: "var(--spacing-error-ring)",
              height: "var(--spacing-error-ring)",
              border: "8px solid var(--color-primary-light)",
            }}
          >
            <div
              className="flex items-center justify-center rounded-full"
              style={{
                width: "var(--spacing-error-icon)",
                height: "var(--spacing-error-icon)",
                backgroundColor: "var(--color-primary)",
              }}
            >
              <svg
                width="36"
                height="30"
                viewBox="0 0 36 30"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M3 15l10 10L33 3"
                  stroke="white"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </div>
        </div>

        {/* ── Title ── */}
        <p className="error-pay-title mb-2 text-center">Pago completado</p>
        <p className="error-pay-desc mb-6 text-center">Tu alquiler ha sido confirmado y el seguro activado.</p>

        {/* ── Stripe info bar ── */}
        <div className="bg-error-info mb-5 rounded-md px-4 py-3">
          <p className="text-http-info text-[13px]">
            Stripe ID: <span className="font-medium">{paymentIntentId}</span>
            {"  ·  "}
            <span className="font-medium">{fmtPrice(amountEUR)} EUR cobrados</span>
          </p>
        </div>

        {/* ── Rental item card ── */}
        <div className="border-border-main mb-6 rounded-lg border p-4">
          <div className="flex items-start gap-4">
            {/* Item image */}
            {itemImageUrl ? (
              <img
                src={itemImageUrl}
                alt={itemTitle}
                className="size-20 shrink-0 rounded-md object-cover"
              />
            ) : (
              <div className="bg-primary-light size-20 shrink-0 rounded-md" />
            )}

            <div className="flex flex-col gap-1">
              <p className="summary-product-name">{itemTitle}</p>
              <p className="summary-owner">
                {startShort} → {endShort} {year} · {days} {days === 1 ? "día" : "días"}
              </p>
              <p
                className="text-[15px] font-bold"
                style={{ color: "var(--color-primary)" }}
              >
                Total pagado: {fmtPrice(amountEUR)} EUR
              </p>
            </div>
          </div>

          {/* Insurance badge */}
          <div className="bg-insurance mt-3 flex items-center gap-2 rounded-md px-3 py-2">
            <span
              className="text-xs font-bold"
              style={{ color: "var(--color-primary)" }}
            >
              ✓ Seguro activado
            </span>
            <span className="text-subtle text-xs">·</span>
            <span className="text-subtle text-xs">Póliza: {policyNumber}</span>
            <span className="text-subtle text-xs">·</span>
            <span className="text-subtle text-xs">
              Cubre: {startShort}–{endShort}
            </span>
          </div>
        </div>

        {/* ── Actions ── */}
        <div className="flex gap-3">
          <button
            type="button"
            className="btn-booking btn--md flex-1"
            style={{ width: "auto" }}
            onClick={() => void navigate("/bookings")}
          >
            Ver mis reservas
          </button>

          <button
            type="button"
            className="btn-secondary btn--md flex-1"
            onClick={() => void navigate("/chat")}
          >
            Enviar mensaje
          </button>

          <button
            type="button"
            className="btn-secondary btn--md flex-1"
            onClick={() => void navigate("/home")}
          >
            Inicio
          </button>
        </div>
      </div>
    </div>
  );
}

export { PaymentSuccess };
