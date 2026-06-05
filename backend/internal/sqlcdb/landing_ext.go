// Hand-written sqlc extension: queries that power the public landing page.
// Kept in the sqlcdb package so they share the generated *Queries receiver,
// mirroring the other *_ext.go files (item_search_ext.go, review_ext.go).

package sqlcdb

import "context"

const getPlatformReviewStats = `
SELECT
    COALESCE(AVG(rating)::float8, 0) AS average_rating,
    COUNT(*) AS total_reviews
FROM review
`

// PlatformReviewStatsRow aggregates rating data across every review on the platform.
type PlatformReviewStatsRow struct {
	AverageRating float64 `json:"average_rating"`
	TotalReviews  int64   `json:"total_reviews"`
}

// GetPlatformReviewStats returns the marketplace-wide average rating and review count.
func (q *Queries) GetPlatformReviewStats(ctx context.Context) (PlatformReviewStatsRow, error) {
	row := q.db.QueryRow(ctx, getPlatformReviewStats)
	var stats PlatformReviewStatsRow
	err := row.Scan(&stats.AverageRating, &stats.TotalReviews)
	return stats, err
}
