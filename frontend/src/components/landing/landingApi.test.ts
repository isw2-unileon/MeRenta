import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchLanding } from "@/components/landing/landingApi";
import type { LandingResponse } from "@/types/landing";

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

const payload: LandingResponse = {
  stats: { available_products: 42, users: 17, average_rating: 4.5, total_reviews: 8 },
  categories: [{ category: "sports", count: 9 }],
  featured: [],
};

describe("fetchLanding", () => {
  it("requests the public endpoint and unwraps the payload", async () => {
    const fetchMock = mockFetch({ success: true, data: payload });

    await expect(fetchLanding()).resolves.toEqual(payload);
    expect(fetchMock).toHaveBeenCalledWith("/api/landing", { signal: undefined });
  });

  it("forwards the abort signal when provided", async () => {
    const fetchMock = mockFetch({ success: true, data: payload });
    const controller = new AbortController();

    await fetchLanding(controller.signal);
    expect(fetchMock).toHaveBeenCalledWith("/api/landing", { signal: controller.signal });
  });

  it("throws the API error message on failure", async () => {
    mockFetch({ success: false, error: "boom" }, false);
    await expect(fetchLanding()).rejects.toThrow("boom");
  });

  it("throws a default message when data is missing", async () => {
    mockFetch({ success: true });
    await expect(fetchLanding()).rejects.toThrow("Error al cargar la página");
  });
});
