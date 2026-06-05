import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Landing } from "@/pages/Landing";
import type { LandingResponse } from "@/types/landing";
import type { SearchItemResponse } from "@/types/item";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const authState = vi.hoisted(() => ({
  current: { isAuthenticated: false, isLoading: false },
}));

const landingState = vi.hoisted(() => ({
  result: Promise.resolve<LandingResponse>({
    stats: { available_products: 42, users: 17, average_rating: 4.5, total_reviews: 8 },
    categories: [],
    featured: [],
  }),
}));

vi.mock("@/hooks/useAuth.ts", () => ({
  useAuth: () => authState.current,
}));

vi.mock("@/components/landing/landingApi", () => ({
  fetchLanding: () => landingState.result,
}));

let root: ReturnType<typeof createRoot> | null = null;

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  root = null;
  document.body.innerHTML = "";
  authState.current = { isAuthenticated: false, isLoading: false };
});

const featuredItem: SearchItemResponse = {
  item_id: "item-1",
  owner_id: "owner-1",
  address_id: "addr-1",
  category: "sports",
  title: "Bicicleta de montaña",
  item_status: "available",
  price_per_day: 12,
  is_available: true,
  published_at: "2026-06-01T00:00:00Z",
  city: "León",
  postal_code: "24001",
  owner_first_name: "Ana",
  owner_last_name: "García",
  owner_verification_status: "verified",
};

async function renderLanding(data?: LandingResponse) {
  if (data) landingState.result = Promise.resolve(data);

  const container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);

  act(() => {
    root?.render(
      <MemoryRouter initialEntries={["/"]}>
        <Landing />
      </MemoryRouter>
    );
  });
  // Flush the fetchLanding promise and the resulting state update.
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });

  return container;
}

describe("Landing", () => {
  it("renders live stats, categories and featured listings", async () => {
    const container = await renderLanding({
      stats: { available_products: 42, users: 17, average_rating: 4.8, total_reviews: 9 },
      categories: [
        { category: "sports", count: 9 },
        { category: "tools", count: 3 },
      ],
      featured: [featuredItem],
    });

    const text = container.textContent ?? "";
    expect(text).toContain("42"); // available products stat
    expect(text).toContain("4.8 ★"); // average rating stat
    expect(text).toContain("Deporte"); // localized category label
    expect(text).toContain("Bicicleta de montaña"); // featured listing title
  });

  it("still renders the static marketing copy without live data", async () => {
    const container = await renderLanding({
      stats: { available_products: 0, users: 0, average_rating: 0, total_reviews: 0 },
      categories: [],
      featured: [],
    });

    const text = container.textContent ?? "";
    expect(text).toContain("Cómo funciona"); // HowItWorks section
    // Empty categories render nothing (no category section heading).
    expect(text).not.toContain("Encuentra lo que necesitas");
  });
});
