// Package handler provides HTTP handlers for the API.
package handler

import (
	"errors"
	"log/slog"
	"mime/multipart"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

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

// ItemImageHandler wires the image endpoint to the image service.
type ItemImageHandler struct {
	svc *service.ItemImageService
}

// NewItemImageHandler builds a new ItemImageHandler.
func NewItemImageHandler(svc *service.ItemImageService) *ItemImageHandler {
	return &ItemImageHandler{svc: svc}
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
	rawID := c.Param("id")
	itemID, err := uuid.Parse(rawID)
	if err != nil {
		response.Error(c, http.StatusBadRequest, "invalid item id")
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
		ct = strings.SplitN(ct, ";", 2)[0] //nolint:gomnd
		ct = strings.TrimSpace(ct)

		if !allowedMIMETypes[ct] {
			return nil, errors.New("only JPEG, PNG and WebP images are accepted")
		}
	}

	return headers, nil
}
