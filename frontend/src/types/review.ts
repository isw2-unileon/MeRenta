/**
 * Aggregate rating data for a customer: average, total and per-star counts.
 */
interface ReviewSummary {
  average_rating: number;
  total: number;
  distribution: Record<string, number>;
}

export type { ReviewSummary };
