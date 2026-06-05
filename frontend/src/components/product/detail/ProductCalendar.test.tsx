import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ProductCalendar } from "@/components/product/detail/ProductCalendar";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let root: ReturnType<typeof createRoot> | null = null;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 5, 4, 9, 0, 0));
});

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  root = null;
  document.body.innerHTML = "";
  vi.useRealTimers();
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

function click(element: Element) {
  act(() => {
    element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

describe("ProductCalendar", () => {
  it("disables past and occupied days and only emits valid selections", () => {
    const onDateSelect = vi.fn();
    const container = render(
      <ProductCalendar
        occupiedDates={new Set(["2026-06-06"])}
        selectedStart={null}
        selectedEnd={null}
        onDateSelect={onDateSelect}
      />
    );

    const pastDay = container.querySelector<HTMLButtonElement>('button[aria-label="3 de Junio"]');
    const occupiedDay = container.querySelector<HTMLButtonElement>('button[aria-label="6 de Junio"]');
    const availableDay = container.querySelector<HTMLButtonElement>('button[aria-label="7 de Junio"]');

    expect(pastDay?.disabled).toBe(true);
    expect(occupiedDay?.disabled).toBe(true);
    expect(availableDay?.disabled).toBe(false);

    click(requiredElement<HTMLButtonElement>(container, 'button[aria-label="7 de Junio"]'));

    expect(onDateSelect).toHaveBeenCalledTimes(1);
    expect(onDateSelect.mock.calls[0][0]).toEqual(new Date(2026, 5, 7));
  });

  it("highlights selected range and prevents navigating before current month", () => {
    const container = render(
      <ProductCalendar
        occupiedDates={new Set()}
        selectedStart={new Date(2026, 5, 10)}
        selectedEnd={new Date(2026, 5, 12)}
        onDateSelect={vi.fn()}
      />
    );

    const previous = container.querySelector<HTMLButtonElement>('button[aria-label="Mes anterior"]');
    const start = container.querySelector<HTMLButtonElement>('button[aria-label="10 de Junio"]');
    const middle = container.querySelector<HTMLButtonElement>('button[aria-label="11 de Junio"]');
    const end = container.querySelector<HTMLButtonElement>('button[aria-label="12 de Junio"]');

    expect(previous?.disabled).toBe(true);
    expect(start?.className).toContain("calendar-day-cell--selected");
    expect(middle?.className).toContain("calendar-day-cell--selected");
    expect(middle?.className).toContain("opacity-40");
    expect(end?.className).toContain("calendar-day-cell--selected");
  });

  it("navigates to next and previous months from the current view", () => {
    const container = render(
      <ProductCalendar
        occupiedDates={new Set()}
        selectedStart={null}
        selectedEnd={null}
        onDateSelect={vi.fn()}
      />
    );

    click(requiredElement<HTMLButtonElement>(container, 'button[aria-label="Mes siguiente"]'));

    expect(container.textContent).toContain("Julio 2026");
    const previous = container.querySelector<HTMLButtonElement>('button[aria-label="Mes anterior"]');
    expect(previous?.disabled).toBe(false);

    click(requiredElement<HTMLButtonElement>(container, 'button[aria-label="Mes anterior"]'));

    expect(container.textContent).toContain("Junio 2026");
    expect(previous?.disabled).toBe(true);
  });
});
