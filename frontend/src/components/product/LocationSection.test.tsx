import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LocationSection } from "@/components/product/LocationSection";
import type { AddressResponse } from "@/types/address";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let root: ReturnType<typeof createRoot> | null = null;

const addresses: AddressResponse[] = [
  {
    address_id: "addr-1",
    customer_id: "customer-1",
    street: "Calle Luna",
    number: "12",
    floor: "2A",
    city: "Leon",
    province: "Leon",
    postal_code: "24001",
    country: "Spain",
  },
];

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

function changeInput(input: HTMLInputElement, value: string) {
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

function changeSelect(select: HTMLSelectElement, value: string) {
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set?.call(select, value);
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

function click(element: HTMLElement) {
  act(() => {
    element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

function renderLocationSection(overrides: Partial<Parameters<typeof LocationSection>[0]> = {}) {
  const props = {
    data: {
      address: "",
      deliveryRadius: "5",
      availableNow: true,
      blockDates: false,
    },
    errors: {},
    addresses,
    onChange: vi.fn(),
    onAddressCreated: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };

  return { container: render(<LocationSection {...props} />), props };
}

describe("LocationSection", () => {
  it("lists saved addresses and forwards select and toggle changes", () => {
    const { container, props } = renderLocationSection();

    changeSelect(requiredElement<HTMLSelectElement>(container, "#address"), "addr-1");
    changeSelect(requiredElement<HTMLSelectElement>(container, "#deliveryRadius"), "10");
    click(requiredElement<HTMLInputElement>(container, 'input[name="availableNow"]'));
    click(requiredElement<HTMLInputElement>(container, 'input[name="blockDates"]'));

    expect(container.textContent).toContain("Calle Luna 12, 2A - Leon");
    expect(props.onChange).toHaveBeenCalledWith("address", "addr-1");
    expect(props.onChange).toHaveBeenCalledWith("deliveryRadius", "10");
    expect(props.onChange).toHaveBeenCalledWith("availableNow", false);
    expect(props.onChange).toHaveBeenCalledWith("blockDates", true);
  });

  it("validates the inline address form before creating an address", () => {
    const { container, props } = renderLocationSection();

    click(requiredElement<HTMLButtonElement>(container, "button"));
    click(requiredElement<HTMLButtonElement>(container, ".btn-primary"));

    expect(container.textContent).toContain("Obligatorio");
    expect(props.onAddressCreated).not.toHaveBeenCalled();
  });

  it("creates a valid inline address and closes the editor", async () => {
    const onAddressCreated = vi.fn().mockResolvedValue(undefined);
    const { container } = renderLocationSection({ onAddressCreated });

    click(requiredElement<HTMLButtonElement>(container, "button"));
    changeInput(requiredElement<HTMLInputElement>(container, "#new-street"), "Calle Sol");
    changeInput(requiredElement<HTMLInputElement>(container, "#new-number"), "7");
    changeInput(requiredElement<HTMLInputElement>(container, "#new-floor"), "1B");
    changeInput(requiredElement<HTMLInputElement>(container, "#new-postal"), "24002");
    changeInput(requiredElement<HTMLInputElement>(container, "#new-city"), "Leon");
    changeInput(requiredElement<HTMLInputElement>(container, "#new-province"), "Leon");

    await act(async () => {
      requiredElement<HTMLButtonElement>(container, ".btn-primary").dispatchEvent(
        new MouseEvent("click", { bubbles: true })
      );
      await Promise.resolve();
    });

    expect(onAddressCreated).toHaveBeenCalledWith({
      street: "Calle Sol",
      number: "7",
      floor: "1B",
      postal_code: "24002",
      city: "Leon",
      province: "Leon",
      country: "Spain",
    });
    expect(container.querySelector("#new-street")).toBeNull();
  });
});
