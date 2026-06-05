import { describe, expect, it } from "vitest";

import { distributionPercent, getStatusLabel, initialReviewsState, reviewsReducer } from "./MyProfile.logic";

describe("MyProfile logic", () => {
  it("reduces received reviews loading, success and error states", () => {
    const loading = reviewsReducer(initialReviewsState, { type: "fetch_start" });
    const success = reviewsReducer(loading, {
      type: "fetch_success",
      payload: {
        items: [],
        total: 2,
        summary: { average_rating: 4.5, total: 2, distribution: { "5": 1, "4": 1 } },
      },
    });
    const failed = reviewsReducer(success, { type: "fetch_error", error: "No reviews" });

    expect(loading).toMatchObject({ loading: true, error: "" });
    expect(success).toMatchObject({ total: 2, loading: false, summary: { average_rating: 4.5 } });
    expect(failed).toMatchObject({ items: [], total: 0, loading: false, error: "No reviews" });
  });

  it("labels product availability status", () => {
    const base = {
      item_id: "item-1",
      owner_id: "owner-1",
      address_id: "address-1",
      category: "tools",
      title: "Taladro",
      price_per_day: 10,
      published_at: "2026-06-05T00:00:00Z",
      city: "Leon",
      postal_code: "24001",
      owner_first_name: "Ana",
      owner_last_name: "Lopez",
      owner_verification_status: "verified",
    };

    expect(getStatusLabel({ ...base, item_status: "rented", is_available: false })).toBe("Reservado");
    expect(getStatusLabel({ ...base, item_status: "retired", is_available: false })).toBe("Retirado");
    expect(getStatusLabel({ ...base, item_status: "available", is_available: true })).toBe("Disponible");
    expect(getStatusLabel({ ...base, item_status: "available", is_available: false })).toBe("No disponible");
  });

  it("calculates rating distribution percentages safely", () => {
    expect(distributionPercent(0, 0)).toBe(0);
    expect(distributionPercent(1, 3)).toBe(33);
    expect(distributionPercent(2, 3)).toBe(67);
  });
});
