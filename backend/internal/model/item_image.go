// Package model contains request and response DTOs.
package model

// ItemImageResponse is the API representation of a stored item image.
type ItemImageResponse struct {
	ImageID      string `json:"image_id"`
	ItemID       string `json:"item_id"`
	ImageURL     string `json:"image_url"`
	DisplayOrder int32  `json:"display_order"`
}
