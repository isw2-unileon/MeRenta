// Package model contains request and response DTOs.
package model

// CreateAddressRequest is the payload for POST /api/addresses.
type CreateAddressRequest struct {
	Street     string   `json:"street"      binding:"required,max=255"`
	Number     string   `json:"number"      binding:"required,max=10"`
	Floor      string   `json:"floor"       binding:"omitempty,max=20"`
	City       string   `json:"city"        binding:"required,max=100"`
	Province   string   `json:"province"    binding:"required,max=100"`
	PostalCode string   `json:"postal_code" binding:"required,max=10"`
	Country    string   `json:"country"     binding:"omitempty,max=100"`
	Latitude   *float64 `json:"latitude"    binding:"omitempty"`
	Longitude  *float64 `json:"longitude"   binding:"omitempty"`
}

// AddressResponse is the API representation of a stored address.
type AddressResponse struct {
	AddressID  string   `json:"address_id"`
	CustomerID string   `json:"customer_id"`
	Street     string   `json:"street"`
	Number     string   `json:"number"`
	Floor      string   `json:"floor,omitempty"`
	City       string   `json:"city"`
	Province   string   `json:"province"`
	PostalCode string   `json:"postal_code"`
	Country    string   `json:"country"`
	Latitude   *float64 `json:"latitude,omitempty"`
	Longitude  *float64 `json:"longitude,omitempty"`
}
