// Package handler provides HTTP handlers for the API.
package handler

import (
	"context"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"mime/multipart"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/isw2-unileon/MeRenta/backend/internal/model"
	"github.com/isw2-unileon/MeRenta/backend/internal/service"
	"github.com/isw2-unileon/MeRenta/backend/pkg/response"
)

const (
	maxUploadBytes = 50 << 20 // 50 MB total multipart memory
	maxImageBytes  = 5 << 20  // 5 MB per individual file
	maxImageCount  = 10
	minImageCount  = 1
)

// allowedMIMETypes is the set of image content types accepted for upload.
var allowedMIMETypes = map[string]bool{
	"image/jpeg": true,
	"image/png":  true,
	"image/webp": true,
}

// proxyHTTPTimeout is the per-request timeout used when fetching images from storage.
const proxyHTTPTimeout = 30 * time.Second

// ItemImageHandler wires the image endpoints to the image service.
type ItemImageHandler struct {
	svc        itemImageService
	httpClient *http.Client
}

// itemImageService is the subset of the image service used by the handler.
type itemImageService interface {
	GetImages(ctx context.Context, itemID uuid.UUID) ([]model.ItemImageResponse, error)
	AddItemImages(ctx context.Context, ownerID uuid.UUID, itemID uuid.UUID, files []*multipart.FileHeader) ([]model.ItemImageResponse, error)
	DeleteImage(ctx context.Context, ownerID, itemID, imageID uuid.UUID) error
	GetImageURL(ctx context.Context, itemID, imageID uuid.UUID) (string, error)
}

// NewItemImageHandler builds a new ItemImageHandler.
func NewItemImageHandler(svc itemImageService) *ItemImageHandler {
	return &ItemImageHandler{
		svc:        svc,
		httpClient: &http.Client{Timeout: proxyHTTPTimeout},
	}
}

// ListImages handles GET /api/items/:id/images — returns all images for an item
// ordered by display_order ascending.
//
// The image_url field is rewritten to a backend proxy path so the browser
// never makes cross-origin requests directly to Supabase Storage.
//
// Response 200: []model.ItemImageResponse  (empty array when no images exist)
// Response 400: invalid UUID in path
func (h *ItemImageHandler) ListImages(c *gin.Context) {
	itemID, ok := parseUUIDParam(c)
	if !ok {
		return
	}

	imgs, err := h.svc.GetImages(c.Request.Context(), itemID)
	if err != nil {
		slog.Error("failed to list item images", "item_id", itemID, "error", err)
		response.Error(c, http.StatusInternalServerError, "internal server error")

		return
	}

	// Replace raw Supabase signed URLs with backend proxy paths.
	// This prevents the browser from making cross-origin requests that are
	// blocked by Cloudflare bot protection on the Supabase storage domain.
	for i := range imgs {
		imgs[i].ImageURL = "/api/items/" + imgs[i].ItemID + "/images/" + imgs[i].ImageID + "/content"
	}

	response.OK(c, http.StatusOK, imgs)
}

// AddImages handles POST /api/items/:id/images.
//
// Accepts a multipart/form-data body with one or more files under the key
// "images" (1–10 files, each ≤ 5 MB, MIME type jpeg/png/webp).
//
// The backend uploads each file to private Supabase Storage, generates a
// signed URL, and persists the metadata in the item_image table.
//
// Response 201: []model.ItemImageResponse
// Response 400: validation error
// Response 403: caller does not own the item
// Response 404: item not found
func (h *ItemImageHandler) AddImages(c *gin.Context) {
	itemID, ok := parseUUIDParam(c)
	if !ok {
		return
	}

	ownerRaw, ok := c.Get("customer_id")
	if !ok {
		response.Error(c, http.StatusUnauthorized, "missing auth context")
		return
	}

	ownerID, ok := ownerRaw.(uuid.UUID)
	if !ok {
		response.Error(c, http.StatusUnauthorized, "invalid auth context")
		return
	}

	files, err := parseImageFiles(c)
	if err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}

	imgs, err := h.svc.AddItemImages(c.Request.Context(), ownerID, itemID, files)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrItemNotFound):
			response.Error(c, http.StatusNotFound, err.Error())
		case errors.Is(err, service.ErrForbidden):
			response.Error(c, http.StatusForbidden, err.Error())
		default:
			slog.Error("failed to add item images", "item_id", itemID, "owner_id", ownerID, "error", err)
			response.Error(c, http.StatusInternalServerError, "internal server error")
		}

		return
	}

	response.OK(c, http.StatusCreated, imgs)
}

// DeleteImage handles DELETE /api/items/:id/images/:imageId.
func (h *ItemImageHandler) DeleteImage(c *gin.Context) {
	itemID, ok := parseUUIDParam(c)
	if !ok {
		return
	}

	imageID, err := uuid.Parse(c.Param("imageId"))
	if err != nil {
		response.Error(c, http.StatusBadRequest, "invalid image id")
		return
	}

	ownerRaw, ok := c.Get("customer_id")
	if !ok {
		response.Error(c, http.StatusUnauthorized, "missing auth context")
		return
	}

	ownerID, ok := ownerRaw.(uuid.UUID)
	if !ok {
		response.Error(c, http.StatusUnauthorized, "invalid auth context")
		return
	}

	if err := h.svc.DeleteImage(c.Request.Context(), ownerID, itemID, imageID); err != nil {
		if errors.Is(err, service.ErrImageNotFound) {
			response.Error(c, http.StatusNotFound, err.Error())
			return
		}

		slog.Error("failed to delete item image", "item_id", itemID, "image_id", imageID, "owner_id", ownerID, "error", err)
		response.Error(c, http.StatusInternalServerError, "internal server error")
		return
	}

	response.OK(c, http.StatusOK, gin.H{"message": "image deleted"})
}

// ProxyImage handles GET /api/items/:id/images/:imageId/content.
//
// It fetches the image server-side from Supabase Storage and streams it to the
// caller, so the browser only ever talks to the backend (same origin via the
// Vite proxy) and never hits the Supabase domain directly.
//
// Response 200:     image bytes with the upstream Content-Type
// Response 400:     invalid UUID params
// Response 404:     image not found for this item
// Response 502:     upstream storage error
func (h *ItemImageHandler) ProxyImage(c *gin.Context) {
	itemID, ok := parseUUIDParam(c)
	if !ok {
		return
	}

	imageID, err := uuid.Parse(c.Param("imageId"))
	if err != nil {
		response.Error(c, http.StatusBadRequest, "invalid image id")

		return
	}

	signedURL, err := h.svc.GetImageURL(c.Request.Context(), itemID, imageID)
	if err != nil {
		h.handleProxyLookupErr(c, itemID, imageID, err)

		return
	}

	ct, body, err := h.fetchImageContent(c.Request.Context(), signedURL)
	if err != nil {
		slog.Error("proxy image: fetch failed", "item_id", itemID, "image_id", imageID, "error", err)
		response.Error(c, http.StatusBadGateway, "could not fetch image from storage")

		return
	}

	defer func() { _ = body.Close() }()

	c.Header("Content-Type", ct)
	c.Header("Cache-Control", "public, max-age=86400")
	c.Status(http.StatusOK)

	if _, err := io.Copy(c.Writer, body); err != nil {
		slog.Error("proxy image: stream failed", "item_id", itemID, "image_id", imageID, "error", err)
	}
}

// handleProxyLookupErr writes the appropriate error response when the image
// URL cannot be retrieved from the service.
func (h *ItemImageHandler) handleProxyLookupErr(c *gin.Context, itemID, imageID uuid.UUID, err error) {
	if errors.Is(err, service.ErrImageNotFound) {
		response.Error(c, http.StatusNotFound, "image not found")

		return
	}

	slog.Error("proxy image: get url", "item_id", itemID, "image_id", imageID, "error", err)
	response.Error(c, http.StatusInternalServerError, "internal server error")
}

// fetchImageContent performs a server-side GET to signedURL and returns the
// content-type and a ready-to-read response body. The caller must close the body.
func (h *ItemImageHandler) fetchImageContent(ctx context.Context, signedURL string) (string, io.ReadCloser, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, signedURL, nil)
	if err != nil {
		return "", nil, fmt.Errorf("build upstream request: %w", err)
	}

	resp, err := h.httpClient.Do(req)
	if err != nil {
		return "", nil, fmt.Errorf("upstream request: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		_ = resp.Body.Close()

		return "", nil, fmt.Errorf("upstream status %d", resp.StatusCode)
	}

	ct := resp.Header.Get("Content-Type")
	if ct == "" {
		ct = "image/jpeg"
	}

	return ct, resp.Body, nil
}

// parseImageFiles extracts and validates the "images" files from the request.
// Returns a descriptive error when validation fails.
func parseImageFiles(c *gin.Context) ([]*multipart.FileHeader, error) {
	if err := c.Request.ParseMultipartForm(maxUploadBytes); err != nil {
		return nil, errors.New("cannot parse multipart form")
	}

	headers := c.Request.MultipartForm.File["images"]

	if len(headers) < minImageCount {
		return nil, errors.New("at least one image is required")
	}

	if len(headers) > maxImageCount {
		return nil, errors.New("a maximum of 10 images is allowed")
	}

	for _, fh := range headers {
		if fh.Size > maxImageBytes {
			return nil, errors.New("each image must be at most 5 MB")
		}

		ct := fh.Header.Get("Content-Type")
		// Strip parameters such as charset (e.g. "image/jpeg; boundary=…").
		ct = strings.SplitN(ct, ";", 2)[0]
		ct = strings.TrimSpace(ct)

		if !allowedMIMETypes[ct] {
			return nil, errors.New("only JPEG, PNG and WebP images are accepted")
		}
	}

	return headers, nil
}
