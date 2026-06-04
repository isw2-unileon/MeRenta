// Package service contains business logic for the API.
package service

import (
	"context"
	"errors"
	"math"
	"math/big"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/isw2-unileon/MeRenta/backend/internal/model"
	"github.com/isw2-unileon/MeRenta/backend/internal/sqlcdb"
)

// Sentinel errors for the incident service.
var (
	// ErrIncidentNotFound is returned when the requested incident does not exist.
	ErrIncidentNotFound = errors.New("incident not found")
	// ErrIncidentForbidden is returned when the user is not part of the booking.
	ErrIncidentForbidden = errors.New("not authorised to report this booking")
	// ErrIncidentInvalidState is returned when the booking state does not allow incidents.
	ErrIncidentInvalidState = errors.New("incidents can only be filed for accepted or completed bookings")
	// ErrIncidentInvalidType is returned when an unknown incident type is supplied.
	ErrIncidentInvalidType = errors.New("invalid incident type")
	// ErrIncidentInvalidStatus is returned when an unknown incident status is supplied.
	ErrIncidentInvalidStatus = errors.New("invalid incident status")
	// ErrIncidentInvalidPriority is returned when an unknown incident priority is supplied.
	ErrIncidentInvalidPriority = errors.New("invalid incident priority")
	// ErrIncidentRentalUnavailable is returned when a rental record could not be resolved.
	ErrIncidentRentalUnavailable = errors.New("rental record not available for this booking")
	// ErrProductReportInvalidType is returned when an unknown product report type is supplied.
	ErrProductReportInvalidType = errors.New("invalid product report type")
	// ErrCannotReportOwnItem prevents owners from reporting their own listings.
	ErrCannotReportOwnItem = errors.New("cannot report your own item")
)

// incidentQuerier is the minimal DB interface needed by IncidentService.
type incidentQuerier interface {
	GetBookingByID(ctx context.Context, bookingID uuid.UUID) (sqlcdb.BookingDetailRow, error)
	GetOrCreateRentalForBooking(ctx context.Context, bookingID uuid.UUID) (uuid.UUID, error)
	CreateIncident(ctx context.Context, arg sqlcdb.CreateIncidentParams) (uuid.UUID, error)
	GetIncidentByID(ctx context.Context, incidentID uuid.UUID) (sqlcdb.IncidentRow, error)
	ListIncidentsByReporter(ctx context.Context, reporterID uuid.UUID, limit, offset int32) ([]sqlcdb.IncidentRow, error)
	ListIncidentsAdmin(ctx context.Context, arg sqlcdb.ListIncidentsAdminParams) ([]sqlcdb.IncidentRow, error)
	UpdateIncidentStatus(ctx context.Context, id uuid.UUID, status sqlcdb.IncidentStatus) (sqlcdb.IncidentStatus, error)
	UpdateIncidentPriority(ctx context.Context, id uuid.UUID, priority string) (string, error)
	GetItemByID(ctx context.Context, itemID uuid.UUID) (sqlcdb.GetItemByIDRow, error)
	GetCustomerByID(ctx context.Context, customerID uuid.UUID) (sqlcdb.GetCustomerByIDRow, error)
	CreateProductIncident(ctx context.Context, arg sqlcdb.CreateProductIncidentParams) (uuid.UUID, error)
	CreateUserIncident(ctx context.Context, arg sqlcdb.CreateUserIncidentParams) (uuid.UUID, error)
}

// IncidentService handles the incident use-cases.
type IncidentService struct {
	q incidentQuerier
}

// NewIncidentService builds a new IncidentService.
func NewIncidentService(q incidentQuerier) *IncidentService {
	return &IncidentService{q: q}
}

// Create validates ownership, resolves the rental and opens the incident.
func (s *IncidentService) Create(
	ctx context.Context,
	reporterID uuid.UUID,
	req model.CreateIncidentRequest,
) (*model.IncidentResponse, error) {
	bookingID, err := uuid.Parse(req.BookingID)
	if err != nil {
		return nil, ErrIncidentForbidden
	}

	itype, err := parseIncidentType(req.Type)
	if err != nil {
		return nil, err
	}

	booking, err := s.q.GetBookingByID(ctx, bookingID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrIncidentForbidden
		}
		return nil, err
	}

	if err := s.authoriseReporter(booking, reporterID); err != nil {
		return nil, err
	}

	rentalID, err := s.q.GetOrCreateRentalForBooking(ctx, bookingID)
	if err != nil {
		return nil, ErrIncidentRentalUnavailable
	}

	cost := costToNumeric(req.Cost)
	incidentID, err := s.q.CreateIncident(ctx, sqlcdb.CreateIncidentParams{
		RentalID:       rentalID,
		ReporterID:     reporterID,
		IncidentType:   itype,
		Description:    req.Description,
		AssociatedCost: cost,
	})
	if err != nil {
		return nil, err
	}

	row, err := s.q.GetIncidentByID(ctx, incidentID)
	if err != nil {
		return nil, err
	}
	resp := toIncidentResponse(row)
	return &resp, nil
}

// CreateProductReport stores a product report that is not tied to a booking.
func (s *IncidentService) CreateProductReport(
	ctx context.Context,
	reporterID uuid.UUID,
	itemID uuid.UUID,
	req model.CreateProductReportRequest,
) (*model.IncidentResponse, error) {
	incidentType, priority, err := parseProductReportType(req.Type)
	if err != nil {
		return nil, err
	}

	item, err := s.q.GetItemByID(ctx, itemID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrIncidentForbidden
		}
		return nil, err
	}
	if item.OwnerID == reporterID {
		return nil, ErrCannotReportOwnItem
	}

	incidentID, err := s.q.CreateProductIncident(ctx, sqlcdb.CreateProductIncidentParams{
		ItemID:       itemID,
		ReporterID:   reporterID,
		IncidentType: incidentType,
		Description:  req.Description,
		Priority:     priority,
	})
	if err != nil {
		return nil, err
	}

	row, err := s.q.GetIncidentByID(ctx, incidentID)
	if err != nil {
		return nil, err
	}
	resp := toIncidentResponse(row)
	return &resp, nil
}

// CreateUserReport stores a report against another customer.
func (s *IncidentService) CreateUserReport(
	ctx context.Context,
	reporterID uuid.UUID,
	reportedCustomerID uuid.UUID,
	req model.CreateUserReportRequest,
) (*model.IncidentResponse, error) {
	if reporterID == reportedCustomerID {
		return nil, ErrIncidentForbidden
	}
	incidentType, priority, err := parseUserReportType(req.Type)
	if err != nil {
		return nil, err
	}
	if _, err := s.q.GetCustomerByID(ctx, reportedCustomerID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrIncidentForbidden
		}
		return nil, err
	}

	incidentID, err := s.q.CreateUserIncident(ctx, sqlcdb.CreateUserIncidentParams{
		ReportedCustomerID: reportedCustomerID,
		ReporterID:         reporterID,
		IncidentType:       incidentType,
		Description:        req.Description,
		Priority:           priority,
	})
	if err != nil {
		return nil, err
	}

	row, err := s.q.GetIncidentByID(ctx, incidentID)
	if err != nil {
		return nil, err
	}
	resp := toIncidentResponse(row)
	return &resp, nil
}

// ListMine returns incidents filed by the requesting user, newest first.
func (s *IncidentService) ListMine(
	ctx context.Context,
	reporterID uuid.UUID,
	page, limit int,
) (*model.IncidentListResponse, error) {
	offset := toInt32((page - 1) * limit)
	rows, err := s.q.ListIncidentsByReporter(ctx, reporterID, toInt32(limit), offset)
	if err != nil {
		return nil, err
	}
	return toList(rows, page, limit), nil
}

// ListAdmin returns all incidents with optional status and type filters.
func (s *IncidentService) ListAdmin(
	ctx context.Context,
	statusFilter, typeFilter string,
	page, limit int,
) (*model.IncidentListResponse, error) {
	offset := toInt32((page - 1) * limit)
	rows, err := s.q.ListIncidentsAdmin(ctx, sqlcdb.ListIncidentsAdminParams{
		Status: nullText(statusFilter),
		Type:   nullText(typeFilter),
		Limit:  toInt32(limit),
		Offset: offset,
	})
	if err != nil {
		return nil, err
	}
	return toList(rows, page, limit), nil
}

// GetByID returns the full incident detail for an admin.
func (s *IncidentService) GetByID(ctx context.Context, incidentID uuid.UUID) (*model.IncidentResponse, error) {
	row, err := s.q.GetIncidentByID(ctx, incidentID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrIncidentNotFound
		}
		return nil, err
	}
	resp := toIncidentResponse(row)
	return &resp, nil
}

// UpdateStatus changes the lifecycle status of an incident (admin only).
func (s *IncidentService) UpdateStatus(
	ctx context.Context,
	incidentID uuid.UUID,
	rawStatus string,
) (*model.IncidentResponse, error) {
	status, err := parseIncidentStatus(rawStatus)
	if err != nil {
		return nil, err
	}

	if _, err := s.q.UpdateIncidentStatus(ctx, incidentID, status); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrIncidentNotFound
		}
		return nil, err
	}

	return s.GetByID(ctx, incidentID)
}

// UpdatePriority changes the triage priority of an incident.
func (s *IncidentService) UpdatePriority(
	ctx context.Context,
	incidentID uuid.UUID,
	rawPriority string,
) (*model.IncidentResponse, error) {
	if err := parseIncidentPriority(rawPriority); err != nil {
		return nil, err
	}

	if _, err := s.q.UpdateIncidentPriority(ctx, incidentID, rawPriority); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrIncidentNotFound
		}
		return nil, err
	}

	return s.GetByID(ctx, incidentID)
}

// ── Private helpers ───────────────────────────────────────────────────────────

func (s *IncidentService) authoriseReporter(b sqlcdb.BookingDetailRow, reporterID uuid.UUID) error {
	isRenter := b.RenterID == reporterID
	isOwner := b.OwnerID == reporterID
	if !isRenter && !isOwner {
		return ErrIncidentForbidden
	}
	switch b.BookingStatus {
	case sqlcdb.BookingStatusAccepted, sqlcdb.BookingStatusCompleted:
		return nil
	}
	return ErrIncidentInvalidState
}

func parseIncidentType(s string) (sqlcdb.IncidentType, error) {
	switch sqlcdb.IncidentType(s) {
	case sqlcdb.IncidentTypeDamage, sqlcdb.IncidentTypeLateReturn,
		sqlcdb.IncidentTypeItemMismatch, sqlcdb.IncidentTypeNotDelivered,
		sqlcdb.IncidentTypeOther, sqlcdb.IncidentTypeNotAvailable,
		sqlcdb.IncidentTypeForbiddenItem:
		return sqlcdb.IncidentType(s), nil
	}
	return "", ErrIncidentInvalidType
}

func parseProductReportType(s string) (sqlcdb.IncidentType, string, error) {
	incidentType, err := parseIncidentType(s)
	if err != nil {
		return "", "", ErrProductReportInvalidType
	}
	switch incidentType {
	case sqlcdb.IncidentTypeItemMismatch:
		return incidentType, "low", nil
	case sqlcdb.IncidentTypeNotAvailable, sqlcdb.IncidentTypeOther:
		return incidentType, "medium", nil
	case sqlcdb.IncidentTypeDamage, sqlcdb.IncidentTypeForbiddenItem:
		return incidentType, "high", nil
	default:
		return "", "", ErrProductReportInvalidType
	}
}

func parseUserReportType(s string) (sqlcdb.IncidentType, string, error) {
	incidentType, err := parseIncidentType(s)
	if err != nil {
		return "", "", ErrProductReportInvalidType
	}
	switch incidentType {
	case sqlcdb.IncidentTypeOther, sqlcdb.IncidentTypeNotDelivered:
		return incidentType, "medium", nil
	case sqlcdb.IncidentTypeLateReturn:
		return incidentType, "low", nil
	default:
		return "", "", ErrProductReportInvalidType
	}
}

func parseIncidentStatus(s string) (sqlcdb.IncidentStatus, error) {
	switch sqlcdb.IncidentStatus(s) {
	case sqlcdb.IncidentStatusOpen, sqlcdb.IncidentStatusUnderReview,
		sqlcdb.IncidentStatusResolved, sqlcdb.IncidentStatusClosed:
		return sqlcdb.IncidentStatus(s), nil
	}
	return "", ErrIncidentInvalidStatus
}

func parseIncidentPriority(s string) error {
	switch s {
	case "low", "medium", "high":
		return nil
	}
	return ErrIncidentInvalidPriority
}

func toIncidentResponse(r sqlcdb.IncidentRow) model.IncidentResponse {
	resp := model.IncidentResponse{
		IncidentID:     r.IncidentID.String(),
		RentalID:       r.RentalID.String(),
		ReporterID:     r.ReporterID.String(),
		ReporterName:   r.ReporterName,
		ReportedID:     r.ReportedID.String(),
		ReportedName:   r.ReportedName,
		BookingID:      r.BookingID.String(),
		ItemID:         r.ItemID.String(),
		ItemTitle:      r.ItemTitle,
		StartDate:      r.StartDate,
		EndDate:        r.EndDate,
		Type:           string(r.IncidentType),
		Description:    r.Description,
		Status:         string(r.IncidentStatus),
		Priority:       r.Priority,
		AssociatedCost: numericToFloat(r.AssociatedCost),
	}
	if r.ReportedAt.Valid {
		t := r.ReportedAt.Time
		resp.ReportedAt = &t
	}
	return resp
}

func toList(rows []sqlcdb.IncidentRow, page, limit int) *model.IncidentListResponse {
	var total int64
	items := make([]model.IncidentResponse, len(rows))
	for i, r := range rows {
		items[i] = toIncidentResponse(r)
		total = r.TotalCount
	}
	return &model.IncidentListResponse{Items: items, Total: total, Page: page, Limit: limit}
}

func nullText(s string) pgtype.Text {
	if s == "" {
		return pgtype.Text{}
	}
	return pgtype.Text{String: s, Valid: true}
}

func costToNumeric(cost float64) pgtype.Numeric {
	if cost == 0 {
		return pgtype.Numeric{Valid: false}
	}
	cents := int64(math.Round(cost * 100))
	return pgtype.Numeric{
		Int:   new(big.Int).SetInt64(cents),
		Exp:   -2,
		Valid: true,
	}
}

func numericToFloat(n pgtype.Numeric) float64 {
	if !n.Valid || n.NaN || n.Int == nil {
		return 0
	}
	f, _ := new(big.Float).SetInt(n.Int).Float64()
	if n.Exp < 0 {
		f /= math.Pow10(-int(n.Exp))
	} else if n.Exp > 0 {
		f *= math.Pow10(int(n.Exp))
	}
	return f
}
