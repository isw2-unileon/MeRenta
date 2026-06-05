import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import { RentalSummary } from "@/components/checkout/RentalSummary";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let root: ReturnType<typeof createRoot> | null = null;

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  root = null;
  document.body.innerHTML = "";
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

describe("RentalSummary", () => {
  it("renders date range, day count and price breakdown", () => {
    const container = render(
      <RentalSummary
        itemTitle="Taladro"
        ownerName="Lucia Perez"
        ownerRating={4.75}
        startDate={new Date(2026, 5, 4)}
        endDate={new Date(2026, 5, 7)}
        pricePerDay={12.5}
        serviceFee={2.25}
        insurance={1.2}
        total={40.95}
      />
    );

    expect(container.textContent).toContain("Taladro");
    expect(container.textContent).toContain("Propietario: Lucia Perez");
    expect(container.textContent).toContain("4.8");
    expect(container.textContent).toContain("3 días de alquiler");
    expect(container.textContent).toContain("37,50 EUR");
    expect(container.textContent).toContain("40,95 EUR");
  });

  it("uses the item image when one is provided", () => {
    const container = render(
      <RentalSummary
        itemTitle="Camara"
        imageUrl="https://cdn.example.com/camara.jpg"
        ownerName="Diego"
        ownerRating={4}
        startDate={new Date(2026, 5, 4)}
        endDate={new Date(2026, 5, 5)}
        pricePerDay={10}
        serviceFee={1}
        insurance={1}
        total={12}
      />
    );

    const image = container.querySelector<HTMLImageElement>("img");
    expect(image?.src).toBe("https://cdn.example.com/camara.jpg");
    expect(image?.alt).toBe("Camara");
    expect(container.textContent).toContain("1 dia de alquiler");
  });
});
