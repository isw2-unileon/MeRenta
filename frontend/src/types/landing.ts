import type { SearchItemResponse } from "@/types/item";

/**
 * Marketplace-wide metrics shown on the public landing page.
 * Matches model.LandingStats in the backend.
 */
interface LandingStats {
  available_products: number;
  users: number;
  average_rating: number;
  total_reviews: number;
}

/**
 * A category with its available-item count.
 * Matches model.LandingCategory in the backend.
 */
interface LandingCategory {
  category: string;
  count: number;
}

/**
 * Public payload returned by GET /api/landing.
 * Matches model.LandingResponse in the backend.
 */
interface LandingResponse {
  stats: LandingStats;
  categories: LandingCategory[];
  featured: SearchItemResponse[];
}

export type { LandingStats, LandingCategory, LandingResponse };
