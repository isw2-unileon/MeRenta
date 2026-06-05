import { describe, expect, it } from "vitest";

import { buildCategoryChips, buildStatTiles, categoryLabel, formatCount, formatRating } from "./landingFormat";

describe("categoryLabel", () => {
  it("maps known categories to Spanish labels", () => {
    expect(categoryLabel("sports")).toBe("Deporte");
    expect(categoryLabel("photography")).toBe("Fotografía");
  });

  it("humanizes unknown categories", () => {
    expect(categoryLabel("water_sports")).toBe("Water sports");
  });
});

describe("formatCount", () => {
  it("formats integers with Spanish thousands separators", () => {
    expect(formatCount(12400)).toBe("12.400");
  });

  it("clamps negatives to zero", () => {
    expect(formatCount(-5)).toBe("0");
  });
});

describe("formatRating", () => {
  it("formats with a single decimal", () => {
    expect(formatRating(4.86)).toBe("4.9");
    expect(formatRating(4.8)).toBe("4.8");
    expect(formatRating(5)).toBe("5.0");
  });
});

describe("buildStatTiles", () => {
  it("builds four tiles and shows a dash rating without reviews", () => {
    const tiles = buildStatTiles({
      available_products: 42,
      users: 17,
      average_rating: 0,
      total_reviews: 0,
    });

    expect(tiles).toHaveLength(4);
    expect(tiles[0]).toEqual({ value: "42", label: "Productos disponibles" });
    expect(tiles[2].value).toBe("—");
  });

  it("shows the rating once reviews exist", () => {
    const tiles = buildStatTiles({
      available_products: 1,
      users: 1,
      average_rating: 4.8,
      total_reviews: 9,
    });

    expect(tiles[2].value).toBe("4.8 ★");
    expect(tiles[3]).toEqual({ value: "9", label: "Valoraciones" });
  });
});

describe("buildCategoryChips", () => {
  it("maps categories to labelled chips preserving counts", () => {
    const chips = buildCategoryChips([
      { category: "sports", count: 9 },
      { category: "tools", count: 3 },
    ]);

    expect(chips).toEqual([
      { value: "sports", label: "Deporte", count: 9 },
      { value: "tools", label: "Herramientas", count: 3 },
    ]);
  });
});
