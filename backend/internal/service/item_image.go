// Package service contains business logic for the API.
package service

import (
	"context"
	"errors"
	"fmt"
	"mime/multipart"
	"net/url"
	"path/filepath"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/isw2-unileon/MeRenta/backend/internal/model"
	"github.com/isw2-unileon/MeRenta/backend/internal/sqlcdb"
	"github.com/isw2-unileon/MeRenta/backend/pkg/storage"
)

var (
	// ErrItemNotFound indicates the requested item does not exist.
	ErrItemNotFound = errors.New("item not found")
	// ErrForbidden indicates the caller does not own the resource.
	ErrForbidden = errors.New("forbidden")
	// ErrImageNotFound is returned when no image with the given ID exists for the item.
	ErrImageNotFound = errors.New("image not found")
)

// signedURLTTL is how long (in seconds) a signed URL remains valid.
const signedURLTTL = 315_360_000

// maxItemImageCount is the maximum number of images allowed per item listing.
const maxItemImageCount = 10

// itemImageQuerier is the minimal DB interface required by ItemImageService.
type itemImageQuerier interface {
	GetItemByID(ctx context.Context, itemID uuid.UUID) (sqlcdb.GetItemByIDRow, error)
	CreateItemImage(ctx context.Context, arg sqlcdb.CreateItemImageParams) (sqlcdb.ItemImage, error)
	GetItemImages(ctx context.Context, itemID uuid.UUID) ([]sqlcdb.ItemImage, error)
	DeleteItemImages(ctx context.Context, itemID uuid.UUID) error
	CountItemImages(ctx context.Context, itemID uuid.UUID) (int64, error)
	DeleteItemImageForOwner(ctx context.Context, imageID, itemID, ownerID uuid.UUID) error
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

// AddItemImages appends uploaded files to an item after verifying ownership.
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

	existingCount, err := s.q.CountItemImages(ctx, itemID)
	if err != nil {
		return nil, err
	}
	if existingCount+int64(len(files)) > maxItemImageCount {
		return nil, fmt.Errorf("a maximum of %d images is allowed", maxItemImageCount)
	}

	results := make([]model.ItemImageResponse, 0, len(files))
	for i, fh := range files {
		displayOrder := int(existingCount) + i + 1
		signedURL, err := s.uploadAndSign(ctx, itemID, displayOrder, fh)
		if err != nil {
			return nil, err
		}
		displayOrderInt32, err := displayOrderToInt32(displayOrder)
		if err != nil {
			return nil, err
		}

		img, err := s.q.CreateItemImage(ctx, sqlcdb.CreateItemImageParams{
			ItemID:       itemID,
			ImageUrl:     signedURL,
			DisplayOrder: displayOrderInt32,
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

// DeleteImage removes one image from an item after verifying ownership.
func (s *ItemImageService) DeleteImage(ctx context.Context, ownerID, itemID, imageID uuid.UUID) error {
	if err := s.q.DeleteItemImageForOwner(ctx, imageID, itemID, ownerID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrImageNotFound
		}
		return err
	}

	return nil
}

// displayOrderToInt32 validates that displayOrder is within the allowed image
// range and narrows it to int32.
func displayOrderToInt32(displayOrder int) (int32, error) {
	if displayOrder < 1 || displayOrder > maxItemImageCount {
		return 0, fmt.Errorf("invalid image display order %d", displayOrder)
	}

	return int32(displayOrder), nil
}

// GetImages returns all images for an item ordered by display_order.
func (s *ItemImageService) GetImages(ctx context.Context, itemID uuid.UUID) ([]model.ItemImageResponse, error) {
	rows, err := s.q.GetItemImages(ctx, itemID)
	if err != nil {
		return nil, err
	}

	result := make([]model.ItemImageResponse, 0, len(rows))
	for _, img := range rows {
		result = append(result, model.ItemImageResponse{
			ImageID:      img.ImageID.String(),
			ItemID:       img.ItemID.String(),
			ImageURL:     img.ImageUrl,
			DisplayOrder: img.DisplayOrder,
		})
	}

	return result, nil
}

// GetImageURL returns the Supabase signed URL for the given image.
func (s *ItemImageService) GetImageURL(ctx context.Context, itemID, imageID uuid.UUID) (string, error) {
	rows, err := s.q.GetItemImages(ctx, itemID)
	if err != nil {
		return "", err
	}

	for _, img := range rows {
		if img.ImageID == imageID {
			return normalizeStorageURL(img.ImageUrl), nil
		}
	}

	return "", ErrImageNotFound
}

// normalizeStorageURL ensures the URL contains the /storage/v1 path segment.
func normalizeStorageURL(rawURL string) string {
	u, err := url.Parse(rawURL)
	if err != nil || !strings.HasPrefix(u.Path, "/object/") {
		return rawURL
	}

	u.Path = "/storage/v1" + u.Path

	return u.String()
}

// uploadAndSign uploads a single file to storage and returns its signed URL.
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
