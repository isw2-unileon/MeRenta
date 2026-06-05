import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import { StarRating } from "@/components/product/detail/StarRating";

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

describe("StarRating", () => {
  it("renders accessible filled and empty stars", () => {
    const container = render(<StarRating rating={3.6} />);

    expect(container.querySelector("[aria-label='3.6 de 5 estrellas']")).not.toBeNull();
    expect(container.querySelectorAll(".star-filled")).toHaveLength(4);
    expect(container.querySelectorAll(".star-empty")).toHaveLength(1);
  });

  it("honors a custom max and className", () => {
    const container = render(
      <StarRating
        rating={1}
        max={3}
        className="compact"
      />
    );

    expect(container.querySelectorAll("[aria-hidden='true']")).toHaveLength(3);
    expect(container.firstElementChild?.className).toContain("compact");
  });
});
