package service

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/isw2-unileon/MeRenta/backend/internal/sqlcdb"
)

type favoriteQuerierStub struct {
	item         sqlcdb.GetItemByIDRow
	getItemErr   error
	addArg       sqlcdb.AddFavoriteParams
	removeArg    sqlcdb.RemoveFavoriteParams
	isFavorite   bool
	favoriteRows []sqlcdb.ListFavoriteItemsRow
}

func (s *favoriteQuerierStub) AddFavorite(_ context.Context, arg sqlcdb.AddFavoriteParams) error {
	s.addArg = arg
	return nil
}

func (s *favoriteQuerierStub) RemoveFavorite(_ context.Context, arg sqlcdb.RemoveFavoriteParams) error {
	s.removeArg = arg
	return nil
}

func (s *favoriteQuerierStub) IsFavorite(context.Context, sqlcdb.IsFavoriteParams) (bool, error) {
	return s.isFavorite, nil
}

func (s *favoriteQuerierStub) ListFavoriteItems(context.Context, uuid.UUID) ([]sqlcdb.ListFavoriteItemsRow, error) {
	return s.favoriteRows, nil
}

func (s *favoriteQuerierStub) GetItemByID(context.Context, uuid.UUID) (sqlcdb.GetItemByIDRow, error) {
	if s.getItemErr != nil {
		return sqlcdb.GetItemByIDRow{}, s.getItemErr
	}
	return s.item, nil
}

func TestFavoriteServiceAddRemoveCheckAndList(t *testing.T) {
	t.Parallel()

	customerID := uuid.MustParse("11111111-1111-1111-1111-111111111111")
	ownerID := uuid.MustParse("22222222-2222-2222-2222-222222222222")
	itemID := uuid.MustParse("33333333-3333-3333-3333-333333333333")
	price, _ := float64ToNumeric(8.5)
	stub := &favoriteQuerierStub{
		item:       sqlcdb.GetItemByIDRow{ItemID: itemID, OwnerID: ownerID},
		isFavorite: true,
		favoriteRows: []sqlcdb.ListFavoriteItemsRow{{
			ItemID:          itemID,
			Category:        sqlcdb.CategoryEnumTools,
			Title:           "Taladro",
			ItemStatus:      sqlcdb.ItemStatusAvailable,
			PricePerDay:     price,
			IsAvailable:     true,
			City:            "Leon",
			PrimaryImageUrl: "https://cdn.example.com/taladro.jpg",
			SavedAt:         pgtype.Timestamptz{Time: time.Date(2026, 6, 1, 10, 0, 0, 0, time.UTC), Valid: true},
		}},
	}
	svc := NewFavoriteService(stub)

	if err := svc.AddFavorite(context.Background(), customerID, itemID); err != nil {
		t.Fatalf("AddFavorite returned error: %v", err)
	}
	if stub.addArg.CustomerID != customerID || stub.addArg.ItemID != itemID {
		t.Fatalf("addArg = %+v", stub.addArg)
	}

	if err := svc.RemoveFavorite(context.Background(), customerID, itemID); err != nil {
		t.Fatalf("RemoveFavorite returned error: %v", err)
	}
	if stub.removeArg.CustomerID != customerID || stub.removeArg.ItemID != itemID {
		t.Fatalf("removeArg = %+v", stub.removeArg)
	}

	isFavorite, err := svc.IsFavorite(context.Background(), customerID, itemID)
	if err != nil {
		t.Fatalf("IsFavorite returned error: %v", err)
	}
	if !isFavorite {
		t.Fatal("expected favorite to be true")
	}

	list, err := svc.ListFavorites(context.Background(), customerID)
	if err != nil {
		t.Fatalf("ListFavorites returned error: %v", err)
	}
	if list.Total != 1 || list.Items[0].PricePerDay != 8.5 {
		t.Fatalf("unexpected list response: %+v", list)
	}
}

func TestFavoriteServiceAddRejectsMissingAndOwnItems(t *testing.T) {
	t.Parallel()

	customerID := uuid.MustParse("11111111-1111-1111-1111-111111111111")
	itemID := uuid.MustParse("33333333-3333-3333-3333-333333333333")

	svc := NewFavoriteService(&favoriteQuerierStub{getItemErr: pgx.ErrNoRows})
	if err := svc.AddFavorite(context.Background(), customerID, itemID); !errors.Is(err, ErrItemNotFound) {
		t.Fatalf("expected item not found, got %v", err)
	}

	svc = NewFavoriteService(&favoriteQuerierStub{item: sqlcdb.GetItemByIDRow{ItemID: itemID, OwnerID: customerID}})
	if err := svc.AddFavorite(context.Background(), customerID, itemID); !errors.Is(err, ErrOwnFavorite) {
		t.Fatalf("expected own favorite error, got %v", err)
	}
}
