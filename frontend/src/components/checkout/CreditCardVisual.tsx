interface CreditCardVisualProps {
  /** Cardholder name typed into the form field. Empty shows a placeholder. */
  holderName: string;
}

/**
 * Decorative credit card preview that mirrors the cardholder name live.
 * The card number and expiry are always shown as placeholder characters
 * because those fields are rendered inside Stripe iframes and cannot be read.
 *
 * @param holderName Name to display on the card face.
 * @returns Card visual JSX.
 */
function CreditCardVisual({ holderName }: CreditCardVisualProps) {
  const displayName = holderName.trim().toUpperCase() || "NOMBRE APELLIDO";

  return (
    <div
      className="credit-card-visual"
      aria-hidden="true"
    >
      <div className="credit-card-chip mb-3" />

      <p className="credit-card-number mb-3">•••• •••• •••• ••••</p>

      <div className="flex items-end justify-between">
        <p className="credit-card-holder">{displayName}</p>
        <p className="credit-card-expiry">__/__</p>
      </div>
    </div>
  );
}

export { CreditCardVisual };
