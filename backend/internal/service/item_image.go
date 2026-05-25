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

// GetImages returns all images for an item ordered by display_order.
// Returns an empty slice when the item has no images yet.
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
// It is intentionally not exposed in the API response; callers should proxy
// the image through the backend rather than giving the URL directly to clients.
//
// Older records may have been stored with a missing /storage/v1 path segment
// (a bug in the original SignURL implementation). normalizeStorageURL fixes
// those on the fly so no DB migration is required.
//
// It loads all images for the item (max 10) and scans for the matching ID.
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

// normalizeStorageURL ensures the URL contains the /storage/v1 path segment
// that Supabase requires. Older URLs stored in the DB were generated before the
// bug in SignURL was fixed and are missing this prefix, e.g.:
//
//	https://<project>.supabase.co/object/sign/<bucket>/<path>?token=…
//	→ https://<project>.supabase.co/storage/v1/object/sign/<bucket>/<path>?token=…
//
// Already-correct URLs are returned unchanged.
func normalizeStorageURL(rawURL string) string {
	u, err := url.Parse(rawURL)
	if err != nil || !strings.HasPrefix(u.Path, "/object/") {
		return rawURL
	}

	u.Path = "/storage/v1" + u.Path

	return u.String()
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
