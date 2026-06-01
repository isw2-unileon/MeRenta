interface ReviewSummary {
  average_rating: number;
  total: number;
  distribution: Record<string, number>;
}

export type { ReviewSummary };
