// Package model contains request and response types for the incident API.
package model

import "time"

// CreateIncidentRequest is the body sent by users to open an incident.
type CreateIncidentRequest struct {
	BookingID   string  `json:"booking_id"   binding:"required,uuid"`
	Type        string  `json:"type"         binding:"required"`
	Description string  `json:"description"  binding:"required,min=10,max=2000"`
	Cost        float64 `json:"cost"         binding:"omitempty,gte=0"`
}

// CreateProductReportRequest is the body sent by users to report a product listing.
type CreateProductReportRequest struct {
	Type        string `json:"type"        binding:"required"`
	Description string `json:"description" binding:"required,min=10,max=2000"`
}

// CreateUserReportRequest is the body sent by users to report another customer.
type CreateUserReportRequest struct {
	Type        string `json:"type"        binding:"required"`
	Description string `json:"description" binding:"required,min=10,max=2000"`
}

// IncidentResponse is the enriched view of a single incident.
type IncidentResponse struct {
	IncidentID     string     `json:"incident_id"`
	RentalID       string     `json:"rental_id"`
	ReporterID     string     `json:"reporter_id"`
	ReporterName   string     `json:"reporter_name"`
	ReportedID     string     `json:"reported_id"`
	ReportedName   string     `json:"reported_name"`
	BookingID      string     `json:"booking_id"`
	ItemID         string     `json:"item_id"`
	ItemTitle      string     `json:"item_title"`
	StartDate      time.Time  `json:"start_date"`
	EndDate        time.Time  `json:"end_date"`
	Type           string     `json:"type"`
	Description    string     `json:"description"`
	Status         string     `json:"status"`
	Priority       string     `json:"priority"`
	AssociatedCost float64    `json:"associated_cost"`
	ReportedAt     *time.Time `json:"reported_at,omitempty"`
}

// IncidentListResponse wraps a paginated list of incidents.
type IncidentListResponse struct {
	Items []IncidentResponse `json:"items"`
	Total int64              `json:"total"`
	Page  int                `json:"page"`
	Limit int                `json:"limit"`
}

// UpdateIncidentStatusRequest is the body for admin status changes.
type UpdateIncidentStatusRequest struct {
	Status string `json:"status" binding:"required"`
}

// UpdateIncidentPriorityRequest is the body for admin priority changes.
type UpdateIncidentPriorityRequest struct {
	Priority string `json:"priority" binding:"required"`
}
