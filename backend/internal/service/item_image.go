// Package service contains business logic for the API.
package service

import (
	"context"
	"errors"
	"fmt"
	"mime/multipart"
	"path/filepath"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/isw2-unileon/MeRenta/backend/internal/model"
	"github.com/isw2-unileon/MeRenta/backend/internal/sqlcdb"
	"github.com/isw2-unileon/MeRenta/backend/pkg/storage"
)

var (
	// ErrItemNotFound indicates the requested item does not exist.
	ErrItemNotFound = errors.New("item not found")
	// ErrForbidden indicates the caller does not own the resource.
	ErrForbidden = errors.New("forbidden")
)

// signedURLTTL is how long (in seconds) a signed URL remains valid.
// ~10 years — effectively permanent for item images.
const signedURLTTL = 315_360_000

// itemImageQuerier is the minimal DB interface required by ItemImageService.
type itemImageQuerier interface {
	GetItemByID(ctx context.Context, itemID uuid.UUID) (sqlcdb.Item, error)
	CreateItemImage(ctx context.Context, arg sqlcdb.CreateItemImageParams) (sqlcdb.ItemImage, error)
	GetItemImages(ctx context.Context, itemID uuid.UUID) ([]sqlcdb.ItemImage, error)
	DeleteItemImages(ctx context.Context, itemID uuid.UUID) error
}

// ItemImageService handles item-image use cases.
type ItemImageService struct {
	q       itemImageQuerier
	storage storage.Client
	bucket  string
}

// NewItemImageService creates an ItemImageService with its dependencies.
func NewItemImageService(q itemImageQuerier, storageClient storage.Client, bucket string) *ItemImageService {
	return &ItemImageService{q: q, storage: storageClient, bucket: bucket}
}

// AddItemImages replaces all images for an item with the uploaded files,
// after verifying that ownerID is the item's owner.
//
// Each file is uploaded to private Supabase Storage; a long-lived signed URL
// is generated and stored in the item_image table.
func (s *ItemImageService) AddItemImages(
	ctx context.Context,
	ownerID uuid.UUID,
	itemID uuid.UUID,
	files []*multipart.FileHeader,
) ([]model.ItemImageResponse, error) {
	item, err := s.q.GetItemByID(ctx, itemID)
	if err != nil {
		return nil, ErrItemNotFound
	}

	if item.OwnerID != ownerID {
		return nil, ErrForbidden
	}

	// Replace existing images (idempotent — safe to call multiple times).
	if err := s.q.DeleteItemImages(ctx, itemID); err != nil {
		return nil, err
	}

	results := make([]model.ItemImageResponse, 0, len(files))

	for i, fh := range files {
		signedURL, err := s.uploadAndSign(ctx, itemID, i+1, fh)
		if err != nil {
			return nil, err
		}

		img, err := s.q.CreateItemImage(ctx, sqlcdb.CreateItemImageParams{
			ItemID:       itemID,
			ImageUrl:     signedURL,
			DisplayOrder: int32(i + 1),
		})
		if err != nil {
			return nil, err
		}

		results = append(results, model.ItemImageResponse{
			ImageID:      img.ImageID.String(),
			ItemID:       img.ItemID.String(),
			ImageURL:     img.ImageUrl,
			DisplayOrder: img.DisplayOrder,
		})
	}

	return results, nil
}

// uploadAndSign uploads a single file to storage and returns its signed URL.
// It is extracted to keep AddItemImages within the funlen limit.
func (s *ItemImageService) uploadAndSign(
	ctx context.Context,
	itemID uuid.UUID,
	position int,
	fh *multipart.FileHeader,
) (string, error) {
	f, err := fh.Open()
	if err != nil {
		return "", fmt.Errorf("open upload file: %w", err)
	}
	defer func() {
		_ = f.Close()
	}()

	ext := strings.ToLower(filepath.Ext(fh.Filename))
	if ext == "" {
		ext = ".jpg"
	}

	path := fmt.Sprintf("%s/%d-%d%s", itemID.String(), position, time.Now().UnixMilli(), ext)

	ct := fh.Header.Get("Content-Type")
	if ct == "" {
		ct = "image/jpeg"
	}

	if err := s.storage.Upload(ctx, s.bucket, path, ct, f); err != nil {
		return "", err
	}

	signedURL, err := s.storage.SignURL(ctx, s.bucket, path, signedURLTTL)
	if err != nil {
		return "", err
	}

	return signedURL, nil
}
