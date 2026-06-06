package service

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/isw2-unileon/MeRenta/backend/internal/model"
	"github.com/isw2-unileon/MeRenta/backend/internal/sqlcdb"
)

type reviewQuerierStub struct {
	createRow  sqlcdb.ReviewRow
	createArg  sqlcdb.CreateReviewParams
	listRows   []sqlcdb.ReceivedReviewRow
	summaryRow sqlcdb.ReceivedReviewSummaryRow
	listErr    error
	summaryErr error
}

func (s *reviewQuerierStub) CreateReview(_ context.Context, arg sqlcdb.CreateReviewParams) (sqlcdb.ReviewRow, error) {
	s.createArg = arg
	return s.createRow, nil
}

func (s *reviewQuerierStub) ListReceivedReviews(context.Context, sqlcdb.ListReceivedReviewsParams) ([]sqlcdb.ReceivedReviewRow, error) {
	if s.listErr != nil {
		return nil, s.listErr
	}
	return s.listRows, nil
}

func (s *reviewQuerierStub) GetReceivedReviewSummary(context.Context, uuid.UUID) (sqlcdb.ReceivedReviewSummaryRow, error) {
	if s.summaryErr != nil {
		return sqlcdb.ReceivedReviewSummaryRow{}, s.summaryErr
	}
	return s.summaryRow, nil
}

func TestReviewServiceCreateAndList(t *testing.T) {
	t.Parallel()

	reviewerID := uuid.MustParse("11111111-1111-1111-1111-111111111111")
	reviewedID := uuid.MustParse("22222222-2222-2222-2222-222222222222")
	reviewID := uuid.MustParse("33333333-3333-3333-3333-333333333333")
	reviewedAt := time.Date(2026, 6, 1, 12, 0, 0, 0, time.UTC)
	stub := &reviewQuerierStub{
		createRow: sqlcdb.ReviewRow{
			ReviewID:   reviewID,
			ReviewerID: reviewerID,
			FirstName:  "Laura",
			LastName:   "Garcia",
			AvatarURL:  pgtype.Text{String: "https://cdn.example.com/avatar.jpg", Valid: true},
			Rating:     5,
			Comment:    "Perfecto",
			ReviewedAt: pgtype.Timestamptz{Time: reviewedAt, Valid: true},
		},
		listRows: []sqlcdb.ReceivedReviewRow{{
			ReviewID:   reviewID,
			ReviewerID: reviewerID,
			FirstName:  "Laura",
			LastName:   "Garcia",
			Rating:     5,
			Comment:    "Perfecto",
			ReviewedAt: pgtype.Timestamptz{Time: reviewedAt, Valid: true},
			TotalCount: 1,
		}},
		summaryRow: sqlcdb.ReceivedReviewSummaryRow{
			AverageRating: 5,
			TotalCount:    1,
			FiveStarCount: 1,
		},
	}
	svc := NewReviewService(stub)

	created, err := svc.CreateReview(context.Background(), reviewerID, model.CreateReviewRequest{
		ReviewedID: reviewedID.String(),
		Rating:     5,
		Comment:    "Perfecto",
	})
	if err != nil {
		t.Fatalf("CreateReview returned error: %v", err)
	}
	if created.ReviewID != reviewID.String() || stub.createArg.ReviewedID != reviewedID {
		t.Fatalf("unexpected create response: %+v arg=%+v", created, stub.createArg)
	}

	list, err := svc.ListReceivedReviews(context.Background(), reviewedID, 2, 10)
	if err != nil {
		t.Fatalf("ListReceivedReviews returned error: %v", err)
	}
	if list.Total != 1 || list.Summary.Distribution["5"] != 1 || list.Page != 2 {
		t.Fatalf("unexpected list response: %+v", list)
	}
}

func TestReviewServiceValidationAndEmptyFallbacks(t *testing.T) {
	t.Parallel()

	reviewerID := uuid.MustParse("11111111-1111-1111-1111-111111111111")
	svc := NewReviewService(&reviewQuerierStub{listErr: errors.New("db"), summaryErr: errors.New("db")})

	if _, err := svc.CreateReview(context.Background(), reviewerID, model.CreateReviewRequest{Rating: 6}); !errors.Is(err, ErrInvalidReviewRating) {
		t.Fatalf("expected invalid rating, got %v", err)
	}
	if _, err := svc.CreateReview(context.Background(), reviewerID, model.CreateReviewRequest{ReviewedID: reviewerID.String(), Rating: 5}); !errors.Is(err, ErrCannotReviewSelf) {
		t.Fatalf("expected self review error, got %v", err)
	}

	list, err := svc.ListReceivedReviews(context.Background(), reviewerID, 1, 4)
	if err != nil {
		t.Fatalf("ListReceivedReviews fallback returned error: %v", err)
	}
	if list.Total != 0 || len(list.Items) != 0 || list.Summary.Distribution["1"] != 0 {
		t.Fatalf("unexpected empty list: %+v", list)
	}

	summary, err := svc.GetReceivedReviewSummary(context.Background(), reviewerID)
	if err != nil {
		t.Fatalf("GetReceivedReviewSummary fallback returned error: %v", err)
	}
	if summary.Total != 0 || summary.Distribution["5"] != 0 {
		t.Fatalf("unexpected empty summary: %+v", summary)
	}
}
