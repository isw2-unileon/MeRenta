import { afterEach, describe, expect, it, vi } from "vitest";

import {
  fetchMyItems,
  fetchReceivedReviews,
  formatMemberSince,
  formatRelativeDate,
  getInitials,
  initialProductsState,
  productsReducer,
  reviewerDisplayName,
  reviewerInitials,
  uniqueProductCities,
  type ReceivedReview,
} from "@/components/profile/profileShared";
import type { SearchItemResponse } from "@/types/item";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function mockFetch(response: unknown, ok = true) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok,
    json: vi.fn().mockResolvedValue(response),
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("profileShared", () => {
  it("reduces product loading states", () => {
    const loading = productsReducer({ ...initialProductsState, error: "fallo" }, { type: "fetch_start" });
    expect(loading.loading).toBe(true);
    expect(loading.error).toBe("");

    const success = productsReducer(loading, {
      type: "fetch_success",
      payload: {
        items: [{ item_id: "1", city: "Leon" } as SearchItemResponse],
        total: 1,
        page: 1,
        limit: 48,
        category_counts: {},
        city_counts: {},
        condition_counts: {},
      },
    });
    expect(success).toMatchObject({ total: 1, loading: false, error: "" });

    const failed = productsReducer(success, { type: "fetch_error", error: "No se pudo cargar" });
    expect(failed).toEqual({ items: [], total: 0, loading: false, error: "No se pudo cargar" });
  });

  it("formats profile names and dates", () => {
    expect(getInitials("Diego", "Perez")).toBe("DP");
    expect(formatMemberSince("2026-06-04T10:00:00.000Z")).toBe("junio 2026");
    expect(formatMemberSince("not-a-date")).toBe("");

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-10T12:00:00.000Z"));
    expect(formatRelativeDate("2026-06-10T08:00:00.000Z")).toBe("Hoy");
    expect(formatRelativeDate("2026-06-09T08:00:00.000Z")).toBe("Hace 1 dia");
    expect(formatRelativeDate("2026-04-30T08:00:00.000Z")).toBe("Hace 1 mes");
    vi.useRealTimers();
  });

  it("deduplicates product cities and ignores empty values", () => {
    const products = [
      { item_id: "1", city: "Leon" },
      { item_id: "2", city: "" },
      { item_id: "3", city: "Leon" },
      { item_id: "4", city: "Astorga" },
    ] as SearchItemResponse[];

    expect(uniqueProductCities(products)).toEqual(["Leon", "Astorga"]);
  });

  it("builds reviewer display helpers", () => {
    const review = {
      reviewer_first_name: "Laura",
      reviewer_last_name: "Garcia",
    } as ReceivedReview;

    expect(reviewerInitials(review)).toBe("LG");
    expect(reviewerDisplayName(review)).toBe("Laura G.");
  });

  it("fetches profile products and reviews with credentials", async () => {
    const signal = new AbortController().signal;
    const fetchMock = mockFetch({
      success: true,
      data: { items: [], total: 0, page: 1, limit: 48, category_counts: {}, city_counts: {}, condition_counts: {} },
    });

    await expect(fetchMyItems(signal)).resolves.toMatchObject({ total: 0 });
    expect(fetchMock).toHaveBeenCalledWith("/api/items/mine?limit=48", { credentials: "include", signal });

    mockFetch({
      success: true,
      data: { items: [], total: 0, page: 1, limit: 4, summary: { average_rating: 0, total: 0, distribution: {} } },
    });
    await expect(fetchReceivedReviews(signal)).resolves.toMatchObject({ summary: { total: 0 } });
  });

  it("throws fallback messages from failed profile requests", async () => {
    const signal = new AbortController().signal;
    mockFetch({ success: false }, false);
    await expect(fetchMyItems(signal)).rejects.toThrow("Error al cargar tus productos");

    mockFetch({ success: false, error: "sin valoraciones" }, false);
    await expect(fetchReceivedReviews(signal)).rejects.toThrow("sin valoraciones");
  });
});
