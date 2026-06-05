import { describe, expect, it } from "vitest";

import {
  getPageWindow,
  humanizeCategory,
  humanizeCondition,
  initialSearchState,
  searchReducer,
} from "./Search.logic";

describe("Search logic", () => {
  it("hydrates search results and facet counts", () => {
    const item = {
      item_id: "item-1",
      owner_id: "owner-1",
      address_id: "address-1",
      category: "tools",
      title: "Taladro",
      item_status: "available",
      price_per_day: 12,
      is_available: true,
      published_at: "2026-06-05T00:00:00Z",
      city: "Leon",
      postal_code: "24001",
      owner_first_name: "Ana",
      owner_last_name: "Lopez",
      owner_verification_status: "verified",
    };

    const next = searchReducer(initialSearchState, {
      type: "FETCH_SUCCESS",
      payload: {
        items: [item],
        total: 1,
        page: 1,
        limit: 12,
        category_counts: { tools: 1 },
        city_counts: { Leon: 1 },
        condition_counts: { good: 1 },
      },
    });

    expect(next).toMatchObject({
      items: [item],
      total: 1,
      categoryCounts: { tools: 1 },
      cityCounts: { Leon: 1 },
      conditionCounts: { good: 1 },
      loading: false,
      error: "",
    });
  });

  it("resets results on fetch errors", () => {
    const next = searchReducer(
      { ...initialSearchState, total: 10, loading: true },
      { type: "FETCH_ERROR", error: "No se pudo cargar" }
    );

    expect(next).toMatchObject({ items: [], total: 0, loading: false, error: "No se pudo cargar" });
  });

  it("humanizes known and unknown filters", () => {
    expect(humanizeCategory("tools")).toBe("Herramientas");
    expect(humanizeCategory("party_supplies")).toBe("party supplies");
    expect(humanizeCondition("like_new")).toBe("Excelente");
    expect(humanizeCondition("needs_repair")).toBe("needs repair");
  });

  it("builds a compact page window", () => {
    expect(getPageWindow(1, 1)).toEqual([1]);
    expect(getPageWindow(4, 10)).toEqual([1, 4, 5, 6, 10]);
    expect(getPageWindow(9, 10)).toEqual([1, 9, 10]);
  });
});
