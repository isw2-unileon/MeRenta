package sqlcdb

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

const listReceivedReviews = `
SELECT
    r.review_id,
    r.reviewer_id,
    r.reviewed_id,
    r.rating,
    r.comment,
    r.reviewed_at,
    c.first_name,
    c.last_name,
    c.avatar_url,
    COUNT(*) OVER() AS total_count
FROM review r
JOIN customer c ON c.customer_id = r.reviewer_id
WHERE r.reviewed_id = $1
ORDER BY r.reviewed_at DESC
LIMIT $2 OFFSET $3
`

const getReceivedReviewSummary = `
SELECT
    COALESCE(AVG(rating)::float8, 0) AS average_rating,
    COUNT(*) AS total_count,
    COUNT(*) FILTER (WHERE rating = 5) AS five_star_count,
    COUNT(*) FILTER (WHERE rating = 4) AS four_star_count,
    COUNT(*) FILTER (WHERE rating = 3) AS three_star_count,
    COUNT(*) FILTER (WHERE rating = 2) AS two_star_count,
    COUNT(*) FILTER (WHERE rating = 1) AS one_star_count
FROM review
WHERE reviewed_id = $1
`

const createReview = `
INSERT INTO review (
    reviewer_id,
    reviewed_id,
    rating,
    comment
) VALUES (
    $1, $2, $3, $4
)
ON CONFLICT (reviewer_id, reviewed_id) DO UPDATE SET
    rating = EXCLUDED.rating,
    comment = EXCLUDED.comment,
    reviewed_at = now()
RETURNING
    review_id,
    reviewer_id,
    reviewed_id,
    rating,
    comment,
    reviewed_at,
    (SELECT first_name FROM customer WHERE customer_id = reviewer_id) AS first_name,
    (SELECT last_name FROM customer WHERE customer_id = reviewer_id) AS last_name,
    (SELECT avatar_url FROM customer WHERE customer_id = reviewer_id) AS avatar_url
`

// ListReceivedReviewsParams defines pagination for reviews received by a customer.
type ListReceivedReviewsParams struct {
	ReviewedID uuid.UUID `json:"reviewed_id"`
	Limit      int       `json:"limit"`
	Offset     int       `json:"offset"`
}

// CreateReviewParams defines the fields required to create a review.
type CreateReviewParams struct {
	ReviewerID uuid.UUID `json:"reviewer_id"`
	ReviewedID uuid.UUID `json:"reviewed_id"`
	Rating     int32     `json:"rating"`
	Comment    string    `json:"comment"`
}

// ReceivedReviewRow is a review plus reviewer display data.
type ReceivedReviewRow struct {
	ReviewID   uuid.UUID          `json:"review_id"`
	ReviewerID uuid.UUID          `json:"reviewer_id"`
	ReviewedID uuid.UUID          `json:"reviewed_id"`
	Rating     int32              `json:"rating"`
	Comment    string             `json:"comment"`
	ReviewedAt pgtype.Timestamptz `json:"reviewed_at"`
	FirstName  string             `json:"first_name"`
	LastName   string             `json:"last_name"`
	AvatarURL  pgtype.Text        `json:"avatar_url"`
	TotalCount int64              `json:"total_count"`
}

// ReviewRow is a stored review without denormalized customer display fields.
type ReviewRow struct {
	ReviewID   uuid.UUID          `json:"review_id"`
	ReviewerID uuid.UUID          `json:"reviewer_id"`
	ReviewedID uuid.UUID          `json:"reviewed_id"`
	Rating     int32              `json:"rating"`
	Comment    string             `json:"comment"`
	ReviewedAt pgtype.Timestamptz `json:"reviewed_at"`
	FirstName  string             `json:"first_name"`
	LastName   string             `json:"last_name"`
	AvatarURL  pgtype.Text        `json:"avatar_url"`
}

// ReceivedReviewSummaryRow aggregates reviews received by a customer.
type ReceivedReviewSummaryRow struct {
	AverageRating  float64 `json:"average_rating"`
	TotalCount     int64   `json:"total_count"`
	FiveStarCount  int64   `json:"five_star_count"`
	FourStarCount  int64   `json:"four_star_count"`
	ThreeStarCount int64   `json:"three_star_count"`
	TwoStarCount   int64   `json:"two_star_count"`
	OneStarCount   int64   `json:"one_star_count"`
}

// ListReceivedReviews returns reviews received by a customer, newest first.
func (q *Queries) ListReceivedReviews(ctx context.Context, arg ListReceivedReviewsParams) ([]ReceivedReviewRow, error) {
	rows, err := q.db.Query(ctx, listReceivedReviews, arg.ReviewedID, arg.Limit, arg.Offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	reviews, err := pgx.CollectRows(rows, func(row pgx.CollectableRow) (ReceivedReviewRow, error) {
		var r ReceivedReviewRow
		err := row.Scan(
			&r.ReviewID,
			&r.ReviewerID,
			&r.ReviewedID,
			&r.Rating,
			&r.Comment,
			&r.ReviewedAt,
			&r.FirstName,
			&r.LastName,
			&r.AvatarURL,
			&r.TotalCount,
		)
		return r, err
	})
	if err != nil {
		return nil, err
	}

	return reviews, nil
}

// CreateReview inserts a review written by one customer for another customer.
func (q *Queries) CreateReview(ctx context.Context, arg CreateReviewParams) (ReviewRow, error) {
	row := q.db.QueryRow(ctx, createReview, arg.ReviewerID, arg.ReviewedID, arg.Rating, arg.Comment)
	var r ReviewRow
	err := row.Scan(
		&r.ReviewID,
		&r.ReviewerID,
		&r.ReviewedID,
		&r.Rating,
		&r.Comment,
		&r.ReviewedAt,
		&r.FirstName,
		&r.LastName,
		&r.AvatarURL,
	)
	return r, err
}

// GetReceivedReviewSummary returns rating distribution for reviews received by a customer.
func (q *Queries) GetReceivedReviewSummary(ctx context.Context, reviewedID uuid.UUID) (ReceivedReviewSummaryRow, error) {
	row := q.db.QueryRow(ctx, getReceivedReviewSummary, reviewedID)
	var summary ReceivedReviewSummaryRow
	err := row.Scan(
		&summary.AverageRating,
		&summary.TotalCount,
		&summary.FiveStarCount,
		&summary.FourStarCount,
		&summary.ThreeStarCount,
		&summary.TwoStarCount,
		&summary.OneStarCount,
	)
	return summary, err
}
