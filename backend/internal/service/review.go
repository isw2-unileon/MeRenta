package service

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgconn"

	"github.com/isw2-unileon/MeRenta/backend/internal/model"
	"github.com/isw2-unileon/MeRenta/backend/internal/sqlcdb"
)

type reviewQuerier interface {
	ListReceivedReviews(ctx context.Context, arg sqlcdb.ListReceivedReviewsParams) ([]sqlcdb.ReceivedReviewRow, error)
	GetReceivedReviewSummary(ctx context.Context, reviewedID uuid.UUID) (sqlcdb.ReceivedReviewSummaryRow, error)
}

// ReviewService handles review read use cases.
type ReviewService struct {
	q reviewQuerier
}

// NewReviewService creates a ReviewService with its dependencies.
func NewReviewService(q reviewQuerier) *ReviewService {
	return &ReviewService{q: q}
}

// ListReceivedReviews returns reviews received by a customer with summary stats.
func (s *ReviewService) ListReceivedReviews(ctx context.Context, reviewedID uuid.UUID, page int, limit int) (*model.ReceivedReviewsResponse, error) {
	offset := (page - 1) * limit

	rows, err := s.q.ListReceivedReviews(ctx, sqlcdb.ListReceivedReviewsParams{
		ReviewedID: reviewedID,
		Limit:      limit,
		Offset:     offset,
	})
	if err != nil {
		if isUndefinedTable(err) {
			return emptyReceivedReviewsResponse(page, limit), nil
		}
		return nil, err
	}

	summaryRow, err := s.q.GetReceivedReviewSummary(ctx, reviewedID)
	if err != nil {
		if isUndefinedTable(err) {
			return emptyReceivedReviewsResponse(page, limit), nil
		}
		return nil, err
	}

	items := make([]model.ReceivedReviewResponse, 0, len(rows))
	for _, row := range rows {
		items = append(items, model.ReceivedReviewResponse{
			ReviewID:          row.ReviewID.String(),
			ReviewerID:        row.ReviewerID.String(),
			ReviewerFirstName: row.FirstName,
			ReviewerLastName:  row.LastName,
			ReviewerAvatarURL: row.AvatarURL.String,
			Rating:            row.Rating,
			Comment:           row.Comment,
			ReviewedAt:        row.ReviewedAt.Time,
		})
	}

	total := summaryRow.TotalCount
	if total == 0 && len(rows) > 0 {
		total = rows[0].TotalCount
	}

	return &model.ReceivedReviewsResponse{
		Items: items,
		Total: total,
		Page:  page,
		Limit: limit,
		Summary: model.ReviewSummaryResponse{
			AverageRating: summaryRow.AverageRating,
			Total:         summaryRow.TotalCount,
			Distribution: map[string]int64{
				"5": summaryRow.FiveStarCount,
				"4": summaryRow.FourStarCount,
				"3": summaryRow.ThreeStarCount,
				"2": summaryRow.TwoStarCount,
				"1": summaryRow.OneStarCount,
			},
		},
	}, nil
}

func emptyReceivedReviewsResponse(page int, limit int) *model.ReceivedReviewsResponse {
	return &model.ReceivedReviewsResponse{
		Items: []model.ReceivedReviewResponse{},
		Total: 0,
		Page:  page,
		Limit: limit,
		Summary: model.ReviewSummaryResponse{
			AverageRating: 0,
			Total:         0,
			Distribution: map[string]int64{
				"5": 0,
				"4": 0,
				"3": 0,
				"2": 0,
				"1": 0,
			},
		},
	}
}

func isUndefinedTable(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "42P01"
}
