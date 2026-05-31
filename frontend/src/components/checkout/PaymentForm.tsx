import { useReducer, type FormEvent } from "react";
import { useStripe, useElements, CardNumberElement, CardExpiryElement, CardCvcElement } from "@stripe/react-stripe-js";
import type { StripeCardNumberElementChangeEvent } from "@stripe/stripe-js";

import { CreditCardVisual } from "@/components/checkout/CreditCardVisual";

/** Stripe Elements base appearance options applied to all iframe fields. */
const STRIPE_ELEMENT_STYLE = {
  base: {
    fontFamily: '"Sora", sans-serif',
    fontSize: "15px",
    color: "#1a1a1a",
    letterSpacing: "2px",
    "::placeholder": { color: "#bbb" },
  },
  invalid: { color: "#e24b4a" },
} as const;

/** Style for the expiry and CVC fields (normal letter-spacing). */
const STRIPE_META_STYLE = {
  base: {
    ...STRIPE_ELEMENT_STYLE.base,
    letterSpacing: "normal",
  },
  invalid: { color: "#e24b4a" },
} as const;

interface PaymentFormProps {
  /** Grand total to show on the pay button (EUR). */
  totalEUR: number;
  /**
   * Stripe PaymentIntent client secret obtained from the server.
   * Passed to `stripe.confirmCardPayment` to authorise the charge.
   */
  clientSecret: string;
  /** Called when Stripe confirms the payment. Receives the PaymentIntent ID. */
  onSuccess: (paymentIntentId: string, amountEUR: number) => void;
  /** Called when Stripe returns an error. */
  onError: (code: string, message: string) => void;
}

interface PaymentFormState {
  holderName: string;
  termsAccepted: boolean;
  loading: boolean;
  fieldError: string;
  cardBrand: string;
}

type PaymentFormAction =
  | { type: "holderName:set"; value: string }
  | { type: "terms:set"; value: boolean }
  | { type: "loading:set"; value: boolean }
  | { type: "fieldError:set"; value: string }
  | { type: "cardNumber:change"; brand: string; errorMessage?: string };

const initialPaymentFormState: PaymentFormState = {
  holderName: "",
  termsAccepted: false,
  loading: false,
  fieldError: "",
  cardBrand: "unknown",
};

function paymentFormReducer(state: PaymentFormState, action: PaymentFormAction): PaymentFormState {
  switch (action.type) {
    case "holderName:set":
      return { ...state, holderName: action.value };
    case "terms:set":
      return { ...state, termsAccepted: action.value };
    case "loading:set":
      return { ...state, loading: action.value };
    case "fieldError:set":
      return { ...state, fieldError: action.value };
    case "cardNumber:change":
      return { ...state, cardBrand: action.brand, fieldError: action.errorMessage ?? "" };
    default:
      return state;
  }
}

/** Converts a Stripe error code to a Spanish description. */
function stripeCodeToMessage(code: string): string {
  const messages: Record<string, string> = {
    card_declined: "Tu tarjeta ha sido rechazada. Comprueba los datos o usa otra tarjeta.",
    insufficient_funds: "Fondos insuficientes en la cuenta.",
    expired_card: "Tu tarjeta ha caducado.",
    incorrect_cvc: "El código CVC es incorrecto.",
    incorrect_number: "El número de tarjeta es incorrecto.",
    processing_error: "Error al procesar el pago. Inténtalo de nuevo.",
  };
  return messages[code] ?? "Se ha producido un error al procesar el pago.";
}

/** Formats a price number with comma decimal, e.g. 65.9 → "65,90". */
function fmtTotal(value: number): string {
  return value.toFixed(2).replace(".", ",");
}

/**
 * Stripe Elements payment form with card number, expiry, CVC, holder name,
 * and a terms checkbox. Calls `onSuccess` or `onError` after confirmation.
 *
 * Must be mounted inside a Stripe `<Elements>` provider.
 *
 * @param totalEUR Total amount in EUR to display on the pay button.
 * @param onSuccess Callback for a successful payment.
 * @param onError Callback for a declined / failed payment.
 * @returns Payment form JSX.
 */
function PaymentForm({ totalEUR, clientSecret, onSuccess, onError }: PaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();

  const [state, dispatch] = useReducer(paymentFormReducer, initialPaymentFormState);
  const { holderName, termsAccepted, loading, fieldError, cardBrand } = state;

  const handleCardNumberChange = (e: StripeCardNumberElementChangeEvent) => {
    dispatch({ type: "cardNumber:change", brand: e.brand, errorMessage: e.error?.message });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    if (!holderName.trim()) {
      dispatch({ type: "fieldError:set", value: "Introduce el nombre del titular de la tarjeta." });
      return;
    }
    if (!termsAccepted) {
      dispatch({ type: "fieldError:set", value: "Debes aceptar los términos para continuar." });
      return;
    }

    dispatch({ type: "fieldError:set", value: "" });
    dispatch({ type: "loading:set", value: true });

    const cardNumber = elements.getElement(CardNumberElement);
    if (!cardNumber) {
      dispatch({ type: "loading:set", value: false });
      return;
    }

    try {
      const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: cardNumber,
          billing_details: { name: holderName.trim() },
        },
      });

      if (error) {
        const code = error.code ?? "processing_error";
        onError(code, stripeCodeToMessage(code));
      } else if (paymentIntent.status === "succeeded") {
        onSuccess(paymentIntent.id, totalEUR);
      }
    } catch {
      onError("processing_error", stripeCodeToMessage("processing_error"));
    } finally {
      dispatch({ type: "loading:set", value: false });
    }
  };

  const brandLabel = cardBrand !== "unknown" ? cardBrand.toUpperCase() : "VISA";

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
    >
      {/* ── Panel header ── */}
      <div className="mb-5 flex items-center justify-between">
        <h2 className="heading-panel">Datos de pago</h2>
        <span className="badge-stripe">Powered by Stripe</span>
      </div>

      <p className="checkout-ssl mb-5">🔒 Conexion segura SSL. MeRenta nunca almacena los datos de tu tarjeta.</p>

      {/* ── Card visual + brand badges ── */}
      <div className="mb-5 flex items-center gap-4">
        <CreditCardVisual holderName={holderName} />

        <div className="flex flex-col gap-2">
          <p className="payment-methods-label">Tarjetas aceptadas:</p>
          <ul className="payment-badges">
            {(["VISA", "MC", "AMEX", "Maestro"] as const).map((b) => (
              <li key={b}>
                <span
                  className={`badge-payment badge-payment--${b === "MC" ? "mastercard" : b === "AMEX" ? "amex" : b === "Maestro" ? "maestro" : "visa"}`}
                >
                  {b}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* ── Card number ── */}
      <div className="mb-4">
        <label
          htmlFor="stripe-card-number"
          className="checkout-label mb-1.5 block text-[13px] font-medium text-[var(--color-form)]"
        >
          Numero de tarjeta
        </label>
        <div
          className="relative flex items-center rounded-[var(--radius-md)] border border-[var(--color-border-input)] bg-[var(--color-section-alt)] px-4 focus-within:border-[1.5px] focus-within:border-[var(--color-checkout-focus)]"
          style={{ height: "var(--spacing-input-checkout)" }}
        >
          <CardNumberElement
            id="stripe-card-number"
            className="flex-1"
            options={{ style: STRIPE_ELEMENT_STYLE, showIcon: false }}
            onChange={handleCardNumberChange}
          />
          {/* Brand badge */}
          <span className="card-brand-badge ml-2 flex-shrink-0">{brandLabel}</span>
        </div>
        <p className="checkout-hint mt-1">
          Este campo es gestionado por Stripe Elements y se inyecta en tiempo de ejecucion
        </p>
      </div>

      {/* ── Expiry + CVC ── */}
      <div className="mb-4 flex gap-4">
        <div className="flex-1">
          <label
            htmlFor="stripe-card-expiry"
            className="checkout-label mb-1.5 block text-[13px] font-medium text-[var(--color-form)]"
          >
            Fecha de caducidad
          </label>
          <div
            className="flex items-center rounded-[var(--radius-md)] border border-[var(--color-border-input)] bg-[var(--color-section-alt)] px-4 focus-within:border-[1.5px] focus-within:border-[var(--color-checkout-focus)]"
            style={{ height: "var(--spacing-input-checkout)" }}
          >
            <CardExpiryElement
              id="stripe-card-expiry"
              className="w-full"
              options={{ style: STRIPE_META_STYLE }}
            />
          </div>
        </div>

        <div className="flex-1">
          <label
            htmlFor="stripe-card-cvc"
            className="checkout-label mb-1.5 block text-[13px] font-medium text-[var(--color-form)]"
          >
            CVC / CVV
          </label>
          <div
            className="flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border-input)] bg-[var(--color-section-alt)] px-4 focus-within:border-[1.5px] focus-within:border-[var(--color-checkout-focus)]"
            style={{ height: "var(--spacing-input-checkout)" }}
          >
            <CardCvcElement
              id="stripe-card-cvc"
              className="flex-1"
              options={{ style: STRIPE_META_STYLE }}
            />
            <span
              className="cvc-hint flex-shrink-0"
              title="Los 3 dígitos en el reverso de tu tarjeta (4 para Amex)"
              aria-label="Ayuda CVC"
            >
              ?
            </span>
          </div>
        </div>
      </div>
      <p className="checkout-hint -mt-3 mb-4">
        Campos gestionados por Stripe Elements, inyectados en tiempo de ejecucion
      </p>

      {/* ── Holder name ── */}
      <div className="mb-5">
        <label
          htmlFor="card-holder-name"
          className="checkout-label mb-1.5 block text-[13px] font-medium text-[var(--color-form)]"
        >
          Nombre en la tarjeta
        </label>
        <input
          id="card-holder-name"
          type="text"
          className="input-checkout--editable"
          value={holderName}
          onChange={(e) => dispatch({ type: "holderName:set", value: e.target.value })}
          placeholder="Como aparece en la tarjeta"
          autoComplete="cc-name"
          spellCheck={false}
        />
      </div>

      {/* ── Terms checkbox ── */}
      <div className="mb-5 flex items-start gap-3">
        <input
          id="terms-checkout"
          type="checkbox"
          className="checkbox-checkout mt-0.5"
          checked={termsAccepted}
          onChange={(e) => dispatch({ type: "terms:set", value: e.target.checked })}
        />
        <label
          htmlFor="terms-checkout"
          className="checkout-terms cursor-pointer"
        >
          Acepto los terminos del alquiler, la politica de cancelacion y el seguro obligatorio
        </label>
      </div>

      {/* ── Inline validation error ── */}
      {fieldError && <p className="field-error mb-4">{fieldError}</p>}

      {/* ── Pay button ── */}
      <button
        type="submit"
        className={`btn-pay${loading ? "loading" : ""}`}
        disabled={!stripe || loading || !termsAccepted}
        aria-busy={loading}
      >
        {loading ? "Procesando…" : `🔒 Pagar ${fmtTotal(totalEUR)} EUR con Stripe`}
      </button>

      <p className="checkout-hint mt-3 text-center">
        El pago es procesado de forma segura por Stripe. MeRenta nunca tiene acceso a los datos de tu tarjeta.
      </p>
    </form>
  );
}

export { PaymentForm };
