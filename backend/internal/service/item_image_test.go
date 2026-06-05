package service

import (
	"context"
	"errors"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/isw2-unileon/MeRenta/backend/internal/sqlcdb"
)

type itemImageQuerierStub struct {
	item       sqlcdb.GetItemByIDRow
	images     []sqlcdb.ItemImage
	deleteErr  error
	deletedFor struct {
		imageID uuid.UUID
		itemID  uuid.UUID
		ownerID uuid.UUID
	}
}

func (s *itemImageQuerierStub) GetItemByID(context.Context, uuid.UUID) (sqlcdb.GetItemByIDRow, error) {
	return s.item, nil
}

func (s *itemImageQuerierStub) CreateItemImage(_ context.Context, _ sqlcdb.CreateItemImageParams) (sqlcdb.ItemImage, error) {
	return sqlcdb.ItemImage{}, nil
}

func (s *itemImageQuerierStub) GetItemImages(_ context.Context, _ uuid.UUID) ([]sqlcdb.ItemImage, error) {
	return s.images, nil
}

func (s *itemImageQuerierStub) DeleteItemImages(context.Context, uuid.UUID) error {
	return nil
}

func (s *itemImageQuerierStub) CountItemImages(context.Context, uuid.UUID) (int64, error) {
	return int64(len(s.images)), nil
}

func (s *itemImageQuerierStub) DeleteItemImageForOwner(_ context.Context, imageID, itemID, ownerID uuid.UUID) error {
	s.deletedFor.imageID = imageID
	s.deletedFor.itemID = itemID
	s.deletedFor.ownerID = ownerID
	return s.deleteErr
}

func TestItemImageServiceGetImagesAndURL(t *testing.T) {
	t.Parallel()

	itemID := uuid.MustParse("11111111-1111-1111-1111-111111111111")
	imageID := uuid.MustParse("22222222-2222-2222-2222-222222222222")
	svc := NewItemImageService(&itemImageQuerierStub{images: []sqlcdb.ItemImage{{
		ImageID:      imageID,
		ItemID:       itemID,
		ImageUrl:     "https://project.supabase.co/object/sign/items/a.jpg?token=abc",
		DisplayOrder: 1,
	}}}, nil, "items")

	images, err := svc.GetImages(context.Background(), itemID)
	if err != nil {
		t.Fatalf("GetImages returned error: %v", err)
	}
	if len(images) != 1 || images[0].ImageID != imageID.String() {
		t.Fatalf("unexpected images: %+v", images)
	}

	url, err := svc.GetImageURL(context.Background(), itemID, imageID)
	if err != nil {
		t.Fatalf("GetImageURL returned error: %v", err)
	}
	if url != "https://project.supabase.co/storage/v1/object/sign/items/a.jpg?token=abc" {
		t.Fatalf("url = %q", url)
	}

	if _, err := svc.GetImageURL(context.Background(), itemID, uuid.New()); !errors.Is(err, ErrImageNotFound) {
		t.Fatalf("expected image not found, got %v", err)
	}
}

func TestItemImageServiceDeleteAndDisplayOrderValidation(t *testing.T) {
	t.Parallel()

	ownerID := uuid.MustParse("33333333-3333-3333-3333-333333333333")
	itemID := uuid.MustParse("11111111-1111-1111-1111-111111111111")
	imageID := uuid.MustParse("22222222-2222-2222-2222-222222222222")
	stub := &itemImageQuerierStub{}
	svc := NewItemImageService(stub, nil, "items")

	if err := svc.DeleteImage(context.Background(), ownerID, itemID, imageID); err != nil {
		t.Fatalf("DeleteImage returned error: %v", err)
	}
	if stub.deletedFor.ownerID != ownerID || stub.deletedFor.itemID != itemID || stub.deletedFor.imageID != imageID {
		t.Fatalf("deletedFor = %+v", stub.deletedFor)
	}

	stub.deleteErr = pgx.ErrNoRows
	if err := svc.DeleteImage(context.Background(), ownerID, itemID, imageID); !errors.Is(err, ErrImageNotFound) {
		t.Fatalf("expected image not found, got %v", err)
	}

	if got, err := displayOrderToInt32(10); err != nil || got != 10 {
		t.Fatalf("displayOrderToInt32(10) = %d, %v", got, err)
	}
	if _, err := displayOrderToInt32(0); err == nil {
		t.Fatal("expected display order 0 to fail")
	}
	if got := normalizeStorageURL("not a url"); got != "not a url" {
		t.Fatalf("normalizeStorageURL invalid = %q", got)
	}
}
