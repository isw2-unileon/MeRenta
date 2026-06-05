import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PaymentForm } from "@/components/checkout/PaymentForm";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const stripeMocks = vi.hoisted(() => ({
  confirmCardPayment: vi.fn(),
  getElement: vi.fn(),
}));

vi.mock("@stripe/react-stripe-js", () => ({
  useStripe: () => ({ confirmCardPayment: stripeMocks.confirmCardPayment }),
  useElements: () => ({ getElement: stripeMocks.getElement }),
  CardNumberElement: ({ onChange }: { onChange?: (event: { brand: string; error?: { message: string } }) => void }) => (
    <button
      type="button"
      data-testid="card-number"
      onClick={() => onChange?.({ brand: "visa" })}
    >
      card number
    </button>
  ),
  CardExpiryElement: () => <div data-testid="card-expiry" />,
  CardCvcElement: () => <div data-testid="card-cvc" />,
}));

let root: ReturnType<typeof createRoot> | null = null;

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  root = null;
  document.body.innerHTML = "";
  vi.clearAllMocks();
});

function render(ui: ReactNode) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root?.render(ui);
  });
  return container;
}

function requiredElement<T extends Element>(container: Element, selector: string): T {
  const element = container.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Expected element ${selector} to exist`);
  }
  return element;
}

function change(input: HTMLInputElement, value: string) {
  act(() => {
    setInputValue(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

function toggle(input: HTMLInputElement) {
  act(() => {
    setInputChecked(input, !input.checked);
    input.dispatchEvent(new Event("click", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

function setInputValue(input: HTMLInputElement, value: string) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value);
}

function setInputChecked(input: HTMLInputElement, checked: boolean) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "checked")?.set?.call(input, checked);
}

async function submit(form: HTMLFormElement) {
  await act(async () => {
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await Promise.resolve();
  });
}

describe("PaymentForm", () => {
  it("requires a holder name before confirming with Stripe", async () => {
    const container = render(
      <PaymentForm
        totalEUR={65.9}
        clientSecret="pi_secret"
        onSuccess={vi.fn()}
        onError={vi.fn()}
      />
    );
    const terms = requiredElement<HTMLInputElement>(container, "#terms-checkout");
    const form = requiredElement<HTMLFormElement>(container, "form");

    toggle(terms);
    await submit(form);

    expect(container.textContent).toContain("Introduce el nombre del titular de la tarjeta.");
    expect(stripeMocks.confirmCardPayment).not.toHaveBeenCalled();
  });

  it("confirms card payments and reports successful payment intents", async () => {
    const cardElement = { id: "card-number-element" };
    stripeMocks.getElement.mockReturnValue(cardElement);
    stripeMocks.confirmCardPayment.mockResolvedValue({
      paymentIntent: { id: "pi_123", status: "succeeded" },
    });
    const onSuccess = vi.fn();
    const onError = vi.fn();
    const container = render(
      <PaymentForm
        totalEUR={65.9}
        clientSecret="pi_secret"
        onSuccess={onSuccess}
        onError={onError}
      />
    );

    change(requiredElement<HTMLInputElement>(container, "#card-holder-name"), "Lucia Perez");
    toggle(requiredElement<HTMLInputElement>(container, "#terms-checkout"));
    await submit(requiredElement<HTMLFormElement>(container, "form"));

    expect(stripeMocks.confirmCardPayment).toHaveBeenCalledWith("pi_secret", {
      payment_method: {
        card: cardElement,
        billing_details: { name: "Lucia Perez" },
      },
    });
    expect(onSuccess).toHaveBeenCalledWith("pi_123", 65.9);
    expect(onError).not.toHaveBeenCalled();
  });

  it("maps Stripe error codes to readable checkout errors", async () => {
    stripeMocks.getElement.mockReturnValue({ id: "card-number-element" });
    stripeMocks.confirmCardPayment.mockResolvedValue({
      error: { code: "incorrect_cvc" },
    });
    const onError = vi.fn();
    const container = render(
      <PaymentForm
        totalEUR={10}
        clientSecret="pi_secret"
        onSuccess={vi.fn()}
        onError={onError}
      />
    );

    change(requiredElement<HTMLInputElement>(container, "#card-holder-name"), "Lucia Perez");
    toggle(requiredElement<HTMLInputElement>(container, "#terms-checkout"));
    await submit(requiredElement<HTMLFormElement>(container, "form"));

    expect(onError).toHaveBeenCalledWith("incorrect_cvc", "El código CVC es incorrecto.");
  });
});
