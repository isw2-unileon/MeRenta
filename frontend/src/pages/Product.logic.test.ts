import { describe, expect, it } from "vitest";

import { CATEGORY_LABELS, INITIAL_STATE, expandUnavailableRanges, formatRating, productReducer } from "./Product.logic";

describe("Product logic", () => {
  it("maps known category labels and formats ratings", () => {
    expect(CATEGORY_LABELS.tools).toBe("Herramientas");
    expect(formatRating(4.5)).toBe("4.50");
  });

  it("reduces loaded product state without mutating the initial state", () => {
    const item = {
      item_id: "item-1",
      owner_id: "owner-1",
      address_id: "address-1",
      category: "tools",
      title: "Taladro",
      condition: "good",
      item_status: "available",
      price_per_day: 12,
      min_days: 1,
      max_days: 7,
      is_available: true,
      published_at: "2026-06-05T00:00:00Z",
      city: "Leon",
      province: "Leon",
      postal_code: "24001",
    };

    const next = productReducer(INITIAL_STATE, { type: "set-item", value: item });

    expect(next.item?.title).toBe("Taladro");
    expect(INITIAL_STATE.item).toBeNull();
  });

  it("expands unavailable ranges into individual ISO dates", () => {
    const dates = expandUnavailableRanges([
      { start_date: "2026-06-05", end_date: "2026-06-07" },
      { start_date: "2026-06-10", end_date: "2026-06-10" },
    ]);

    expect(Array.from(dates).sort()).toEqual(["2026-06-05", "2026-06-06", "2026-06-07", "2026-06-10"]);
  });
});
