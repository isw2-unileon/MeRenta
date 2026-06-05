import type { LandingCategory, LandingStats } from "@/types/landing";

/**
 * Human-readable Spanish labels for the item category enum values.
 */
const CATEGORY_LABELS: Record<string, string> = {
  sports: "Deporte",
  electronics: "Electrónica",
  tools: "Herramientas",
  music: "Música",
  photography: "Fotografía",
  gardening: "Jardinería",
  camping: "Camping",
  home: "Hogar",
  clothing: "Ropa",
  vehicles: "Vehículos",
  leisure: "Ocio",
  other: "Otros",
};

/**
 * Returns the display label for a category, falling back to a humanized
 * version of the raw enum value for unknown categories.
 */
function categoryLabel(category: string): string {
  if (CATEGORY_LABELS[category]) return CATEGORY_LABELS[category];

  return category
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (letter) => letter.toUpperCase());
}

/** Reused across calls — Intl constructors allocate heavily, so build it once. */
const countFormatter = new Intl.NumberFormat("es-ES");

/** Formats an integer count using Spanish thousands separators. */
function formatCount(value: number): string {
  return countFormatter.format(Math.max(0, Math.trunc(value)));
}

/** Formats an average rating with a single decimal (e.g. "4.8"). */
function formatRating(value: number): string {
  return value.toFixed(1);
}

/** One metric tile rendered in the landing stats strip. */
interface StatTile {
  value: string;
  label: string;
}

/**
 * Builds the four landing metric tiles from raw backend stats.
 * The average rating is hidden behind a dash until at least one review exists.
 */
function buildStatTiles(stats: LandingStats): StatTile[] {
  return [
    { value: formatCount(stats.available_products), label: "Productos disponibles" },
    { value: formatCount(stats.users), label: "Usuarios registrados" },
    {
      value: stats.total_reviews > 0 ? `${formatRating(stats.average_rating)} ★` : "—",
      label: "Valoración media",
    },
    { value: formatCount(stats.total_reviews), label: "Valoraciones" },
  ];
}

/** One category chip with its display label and available-item count. */
interface CategoryChip {
  value: string;
  label: string;
  count: number;
}

/** Maps raw landing categories to display chips with localized labels. */
function buildCategoryChips(categories: LandingCategory[]): CategoryChip[] {
  return categories.map((entry) => ({
    value: entry.category,
    label: categoryLabel(entry.category),
    count: entry.count,
  }));
}

export type { CategoryChip, StatTile };
export { buildCategoryChips, buildStatTiles, categoryLabel, formatCount, formatRating };
