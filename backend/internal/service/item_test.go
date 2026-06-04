package service

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/isw2-unileon/MeRenta/backend/internal/model"
	"github.com/isw2-unileon/MeRenta/backend/internal/sqlcdb"
)

type itemQuerierStub struct {
	createItemArg sqlcdb.CreateItemParams
	createItemErr error

	updateItemErr error
	deleteItemErr error
	existsItem    bool
	existsItemErr error

	listOwnerErr      error
	listOwnerFallback bool
	listOwnerRows     []sqlcdb.SearchItemCardsRow
	countOwner        int64

	searchRows     []sqlcdb.SearchItemCardsRow
	categoryCounts []sqlcdb.CountItemCardsByCategoryRow
	cityCounts     []sqlcdb.CountItemCardsByCityRow
	conditionRows  []sqlcdb.CountItemCardsByConditionRow
}

func (s *itemQuerierStub) CreateItem(_ context.Context, arg sqlcdb.CreateItemParams) (sqlcdb.CreateItemRow, error) {
	s.createItemArg = arg
	if s.createItemErr != nil {
		return sqlcdb.CreateItemRow{}, s.createItemErr
	}
	return createItemRow(arg), nil
}

func (s *itemQuerierStub) GetItemByID(context.Context, uuid.UUID) (sqlcdb.GetItemByIDRow, error) {
	return sqlcdb.GetItemByIDRow{}, pgx.ErrNoRows
}

func (s *itemQuerierStub) ExistsItemByID(context.Context, uuid.UUID) (bool, error) {
	return s.existsItem, s.existsItemErr
}

func (s *itemQuerierStub) UpdateItemForOwner(
	_ context.Context,
	arg sqlcdb.UpdateItemForOwnerParams,
) (sqlcdb.GetItemByIDRow, error) {
	if s.updateItemErr != nil {
		return sqlcdb.GetItemByIDRow{}, s.updateItemErr
	}
	return sqlcdb.GetItemByIDRow{
		ItemID:        arg.ItemID,
		OwnerID:       arg.OwnerID,
		AddressID:     arg.AddressID,
		Category:      arg.Category,
		Title:         arg.Title,
		Description:   arg.Description,
		UsageRules:    arg.UsageRules,
		ItemCondition: arg.ItemCondition,
		ItemStatus:    arg.ItemStatus,
		PricePerDay:   arg.PricePerDay,
		Deposit:       arg.Deposit,
		MinDays:       arg.MinDays,
		MaxDays:       arg.MaxDays,
		IsAvailable:   arg.IsAvailable,
		PublishedAt:   pgtype.Timestamptz{Time: time.Date(2026, 6, 1, 10, 0, 0, 0, time.UTC), Valid: true},
		City:          "Leon",
		Province:      "Leon",
		PostalCode:    "24001",
	}, nil
}

func (s *itemQuerierStub) DeleteItemForOwner(context.Context, uuid.UUID, uuid.UUID) error {
	return s.deleteItemErr
}

func (s *itemQuerierStub) ListOwnerItemCards(
	context.Context,
	sqlcdb.ListOwnerItemCardsParams,
) ([]sqlcdb.SearchItemCardsRow, error) {
	if s.listOwnerErr != nil {
		return nil, s.listOwnerErr
	}
	return s.listOwnerRows, nil
}

func (s *itemQuerierStub) ListOwnerItemCardsWithoutImages(
	context.Context,
	sqlcdb.ListOwnerItemCardsParams,
) ([]sqlcdb.SearchItemCardsRow, error) {
	s.listOwnerFallback = true
	return s.listOwnerRows, nil
}

func (s *itemQuerierStub) CountItemsByOwner(context.Context, uuid.UUID) (int64, error) {
	return s.countOwner, nil
}

func (s *itemQuerierStub) SearchItemCards(
	context.Context,
	sqlcdb.SearchItemCardsParams,
) ([]sqlcdb.SearchItemCardsRow, error) {
	return s.searchRows, nil
}

func (s *itemQuerierStub) CountItemCardsByCategory(
	context.Context,
	sqlcdb.CountItemCardsByCategoryParams,
) ([]sqlcdb.CountItemCardsByCategoryRow, error) {
	return s.categoryCounts, nil
}

func (s *itemQuerierStub) CountItemCardsByCity(
	context.Context,
	sqlcdb.CountItemCardsByCityParams,
) ([]sqlcdb.CountItemCardsByCityRow, error) {
	return s.cityCounts, nil
}

func (s *itemQuerierStub) CountItemCardsByCondition(
	context.Context,
	sqlcdb.CountItemCardsByConditionParams,
) ([]sqlcdb.CountItemCardsByConditionRow, error) {
	return s.conditionRows, nil
}

func TestItemServiceCreateItemDefaultsAndMapsResponse(t *testing.T) {
	t.Parallel()

	ownerID := uuid.MustParse("11111111-1111-1111-1111-111111111111")
	addressID := "22222222-2222-2222-2222-222222222222"
	deposit := 15.5
	stub := &itemQuerierStub{}
	svc := NewItemService(stub)

	res, err := svc.CreateItem(context.Background(), ownerID, model.CreateItemRequest{
		AddressID:   addressID,
		Category:    string(sqlcdb.CategoryEnumTools),
		Title:       "Taladro",
		Description: "Con brocas",
		UsageRules:  "Devolver limpio",
		Condition:   string(sqlcdb.ItemConditionGood),
		PricePerDay: 7.25,
		Deposit:     &deposit,
	})
	if err != nil {
		t.Fatalf("CreateItem returned error: %v", err)
	}

	if stub.createItemArg.MinDays != 1 {
		t.Fatalf("MinDays = %d, want default 1", stub.createItemArg.MinDays)
	}
	if !stub.createItemArg.Description.Valid || !stub.createItemArg.UsageRules.Valid {
		t.Fatalf("text fields were not marked valid: %+v", stub.createItemArg)
	}
	if res.OwnerID != ownerID.String() || res.AddressID != addressID || res.PricePerDay != 7.25 {
		t.Fatalf("response = %+v", res)
	}
	if res.Deposit == nil || *res.Deposit != 15.5 {
		t.Fatalf("deposit = %v", res.Deposit)
	}
}

func TestItemServiceCreateItemValidationAndDBErrors(t *testing.T) {
	t.Parallel()

	ownerID := uuid.MustParse("11111111-1111-1111-1111-111111111111")
	base := model.CreateItemRequest{
		AddressID:   "22222222-2222-2222-2222-222222222222",
		Category:    string(sqlcdb.CategoryEnumTools),
		Title:       "Taladro",
		Condition:   string(sqlcdb.ItemConditionGood),
		PricePerDay: 7.25,
	}

	tests := []struct {
		name string
		req  model.CreateItemRequest
		err  error
		want error
	}{
		{name: "invalid category", req: withCategory(base, "bad"), want: ErrInvalidCategory},
		{name: "invalid condition", req: withCondition(base, "mint"), want: ErrInvalidCondition},
		{name: "invalid rental period", req: withMaxDays(base, 0), want: ErrInvalidRentalPeriod},
		{name: "address foreign key", req: base, err: &pgconn.PgError{Code: "23503"}, want: ErrAddressNotFound},
		{name: "enum cast", req: base, err: &pgconn.PgError{Code: "22P02"}, want: ErrInvalidCategory},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			svc := NewItemService(&itemQuerierStub{createItemErr: tt.err})
			if _, err := svc.CreateItem(context.Background(), ownerID, tt.req); !errors.Is(err, tt.want) {
				t.Fatalf("CreateItem error = %v, want %v", err, tt.want)
			}
		})
	}
}

func TestItemServiceUpdateAndDeleteOwnershipErrors(t *testing.T) {
	t.Parallel()

	ownerID := uuid.MustParse("11111111-1111-1111-1111-111111111111")
	itemID := uuid.MustParse("33333333-3333-3333-3333-333333333333")
	req := model.UpdateItemRequest{
		AddressID:   "22222222-2222-2222-2222-222222222222",
		Category:    string(sqlcdb.CategoryEnumTools),
		Title:       "Taladro actualizado",
		Condition:   string(sqlcdb.ItemConditionGood),
		PricePerDay: 8,
		ItemStatus:  string(sqlcdb.ItemStatusAvailable),
	}

	for _, tt := range []struct {
		name   string
		exists bool
		want   error
	}{
		{name: "forbidden when item exists", exists: true, want: ErrForbidden},
		{name: "not found when item is missing", exists: false, want: ErrItemNotFound},
	} {
		tt := tt
		t.Run("update "+tt.name, func(t *testing.T) {
			t.Parallel()

			svc := NewItemService(&itemQuerierStub{updateItemErr: pgx.ErrNoRows, existsItem: tt.exists})
			if _, err := svc.UpdateItem(context.Background(), ownerID, itemID, req); !errors.Is(err, tt.want) {
				t.Fatalf("UpdateItem error = %v, want %v", err, tt.want)
			}
		})

		t.Run("delete "+tt.name, func(t *testing.T) {
			t.Parallel()

			svc := NewItemService(&itemQuerierStub{deleteItemErr: pgx.ErrNoRows, existsItem: tt.exists})
			if err := svc.DeleteItem(context.Background(), ownerID, itemID); !errors.Is(err, tt.want) {
				t.Fatalf("DeleteItem error = %v, want %v", err, tt.want)
			}
		})
	}
}

func TestItemServiceListOwnerItemsFallsBackWhenImagesTableMissing(t *testing.T) {
	t.Parallel()

	ownerID := uuid.MustParse("11111111-1111-1111-1111-111111111111")
	stub := &itemQuerierStub{
		listOwnerErr: &pgconn.PgError{Code: "42P01", Message: `relation "item_image" does not exist`},
		listOwnerRows: []sqlcdb.SearchItemCardsRow{
			searchCardRow(ownerID, "Taladro", 2),
		},
		countOwner: 3,
	}
	svc := NewItemService(stub)

	res, err := svc.ListOwnerItems(context.Background(), ownerID, 2, 10)
	if err != nil {
		t.Fatalf("ListOwnerItems returned error: %v", err)
	}
	if !stub.listOwnerFallback {
		t.Fatal("expected fallback query without images to be used")
	}
	if res.Total != 3 || res.Page != 2 || len(res.Items) != 1 {
		t.Fatalf("response = %+v", res)
	}
}

func TestItemServiceSearchItemsBuildsFacetCounts(t *testing.T) {
	t.Parallel()

	ownerID := uuid.MustParse("11111111-1111-1111-1111-111111111111")
	stub := &itemQuerierStub{
		searchRows: []sqlcdb.SearchItemCardsRow{
			searchCardRow(ownerID, "Taladro", 5),
			searchCardRow(ownerID, "Sierra", 5),
		},
		categoryCounts: []sqlcdb.CountItemCardsByCategoryRow{
			{Category: sqlcdb.CategoryEnumTools, TotalCount: 2},
		},
		cityCounts: []sqlcdb.CountItemCardsByCityRow{
			{City: "Leon", TotalCount: 2},
		},
		conditionRows: []sqlcdb.CountItemCardsByConditionRow{
			{Condition: sqlcdb.ItemConditionGood, TotalCount: 2},
		},
	}
	svc := NewItemService(stub)

	res, err := svc.SearchItems(context.Background(), sqlcdb.SearchItemCardsParams{Query: "ta"}, 1, 12)
	if err != nil {
		t.Fatalf("SearchItems returned error: %v", err)
	}
	if res.Total != 5 || len(res.Items) != 2 {
		t.Fatalf("response totals = %+v", res)
	}
	if res.CategoryCounts[string(sqlcdb.CategoryEnumTools)] != 2 ||
		res.CityCounts["Leon"] != 2 ||
		res.ConditionCounts[string(sqlcdb.ItemConditionGood)] != 2 {
		t.Fatalf("facet counts = %+v / %+v / %+v", res.CategoryCounts, res.CityCounts, res.ConditionCounts)
	}
}

func createItemRow(arg sqlcdb.CreateItemParams) sqlcdb.CreateItemRow {
	return sqlcdb.CreateItemRow{
		ItemID:        uuid.MustParse("33333333-3333-3333-3333-333333333333"),
		OwnerID:       arg.OwnerID,
		AddressID:     arg.AddressID,
		Category:      arg.Category,
		Title:         arg.Title,
		Description:   arg.Description,
		UsageRules:    arg.UsageRules,
		ItemCondition: arg.ItemCondition,
		ItemStatus:    sqlcdb.ItemStatusAvailable,
		PricePerDay:   arg.PricePerDay,
		Deposit:       arg.Deposit,
		MinDays:       arg.MinDays,
		MaxDays:       arg.MaxDays,
		IsAvailable:   true,
		PublishedAt:   pgtype.Timestamptz{Time: time.Date(2026, 6, 1, 10, 0, 0, 0, time.UTC), Valid: true},
	}
}

func searchCardRow(ownerID uuid.UUID, title string, total int64) sqlcdb.SearchItemCardsRow {
	price, _ := float64ToNumeric(4.5)
	return sqlcdb.SearchItemCardsRow{
		TotalCount:      total,
		ItemID:          uuid.MustParse("33333333-3333-3333-3333-333333333333"),
		OwnerID:         ownerID,
		AddressID:       uuid.MustParse("22222222-2222-2222-2222-222222222222"),
		Category:        sqlcdb.CategoryEnumTools,
		Title:           title,
		ItemStatus:      sqlcdb.ItemStatusAvailable,
		PricePerDay:     price,
		IsAvailable:     true,
		PublishedAt:     pgtype.Timestamptz{Time: time.Date(2026, 6, 1, 10, 0, 0, 0, time.UTC), Valid: true},
		City:            "Leon",
		PostalCode:      "24001",
		PrimaryImageURL: "https://cdn.example.com/item.jpg",
	}
}

func withCategory(req model.CreateItemRequest, category string) model.CreateItemRequest {
	req.Category = category
	return req
}

func withCondition(req model.CreateItemRequest, condition string) model.CreateItemRequest {
	req.Condition = condition
	return req
}

func withMaxDays(req model.CreateItemRequest, maxDays int) model.CreateItemRequest {
	req.MaxDays = &maxDays
	return req
}
