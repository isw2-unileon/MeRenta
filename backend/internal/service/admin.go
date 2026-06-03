// Package service contains business logic for the API.
package service

import (
	"context"
	"errors"
	"log/slog"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/isw2-unileon/MeRenta/backend/internal/model"
	"github.com/isw2-unileon/MeRenta/backend/internal/sqlcdb"
)

// ErrAdminUserNotFound is returned when the target customer does not exist.
var ErrAdminUserNotFound = errors.New("user not found")

// adminQuerier is the minimal DB interface needed by AdminService.
type adminQuerier interface {
	CountCustomers(ctx context.Context) (int64, error)
	ListCustomers(ctx context.Context, arg sqlcdb.ListCustomersParams) ([]sqlcdb.ListCustomersRow, error)
	ListCustomersByStatus(ctx context.Context, arg sqlcdb.ListCustomersByStatusParams) ([]sqlcdb.ListCustomersByStatusRow, error)
	SearchCustomers(ctx context.Context, arg sqlcdb.SearchCustomersParams) ([]sqlcdb.SearchCustomersRow, error)
	SearchItemCards(ctx context.Context, arg sqlcdb.SearchItemCardsParams) ([]sqlcdb.SearchItemCardsRow, error)
	UpdateCustomerStatus(ctx context.Context, arg sqlcdb.UpdateCustomerStatusParams) (sqlcdb.UpdateCustomerStatusRow, error)
	SetCustomerSuspendedUntil(ctx context.Context, customerID uuid.UUID, until pgtype.Timestamptz) error
}

// AdminService provides admin-only business logic.
type AdminService struct {
	q adminQuerier
}

// NewAdminService builds a new AdminService.
func NewAdminService(q adminQuerier) *AdminService {
	return &AdminService{q: q}
}

// AdminUserRow is a normalised customer row for the admin panel.
type AdminUserRow struct {
	CustomerID       uuid.UUID            `json:"customer_id"`
	FirstName        string               `json:"first_name"`
	LastName         string               `json:"last_name"`
	Email            string               `json:"email"`
	Phone            string               `json:"phone,omitempty"`
	RegistrationDate string               `json:"registration_date"`
	AccountStatus    sqlcdb.AccountStatus `json:"account_status"`
	UserRole         sqlcdb.UserRole      `json:"user_role"`
}

// AdminUserListResponse is the paginated list returned by ListUsers.
type AdminUserListResponse struct {
	Users []AdminUserRow `json:"users"`
	Total int64          `json:"total"`
	Page  int            `json:"page"`
	Limit int            `json:"limit"`
}

// ListUsers returns a paginated customer list with optional search and status filter.
// Priority: query > status > plain list.
func (s *AdminService) ListUsers(
	ctx context.Context,
	query, status string,
	page, limit int,
) (AdminUserListResponse, error) {
	offset := int32((page - 1) * limit) //nolint:gosec
	lim := int32(limit)                 //nolint:gosec

	switch {
	case query != "":
		return s.listByQuery(ctx, query, page, limit, offset, lim)
	case status != "":
		return s.listByStatus(ctx, sqlcdb.AccountStatus(status), page, limit, offset, lim)
	default:
		return s.listAll(ctx, page, limit, offset, lim)
	}
}

// ListProducts returns all item rows visible to admins, including unavailable and retired listings.
func (s *AdminService) ListProducts(ctx context.Context, query string, page, limit int) (*model.SearchItemsResponse, error) {
	offset := (page - 1) * limit
	rows, err := s.q.SearchItemCards(ctx, sqlcdb.SearchItemCardsParams{
		RequireAvailable: false,
		Query:            query,
		Sort:             "recent",
		Limit:            limit,
		Offset:           offset,
	})
	if err != nil {
		return nil, err
	}

	items, total, err := searchItemCardRowsToResponses(rows)
	if err != nil {
		return nil, err
	}

	return &model.SearchItemsResponse{
		Items:           items,
		Total:           total,
		Page:            page,
		Limit:           limit,
		CategoryCounts:  map[string]int64{},
		CityCounts:      map[string]int64{},
		ConditionCounts: map[string]int64{},
	}, nil
}

func (s *AdminService) listByQuery(
	ctx context.Context,
	query string,
	page, limit int,
	offset, lim int32,
) (AdminUserListResponse, error) {
	list, err := s.q.SearchCustomers(ctx, sqlcdb.SearchCustomersParams{
		FirstName: "%" + query + "%",
		Limit:     lim,
		Offset:    offset,
	})
	if err != nil {
		return AdminUserListResponse{}, err
	}
	rows := make([]AdminUserRow, len(list))
	for i, c := range list {
		rows[i] = toAdminRow(c.CustomerID, c.FirstName, c.LastName, c.Email,
			c.Phone, c.RegistrationDate, c.AccountStatus, c.UserRole)
	}
	return AdminUserListResponse{Users: rows, Total: int64(len(list)), Page: page, Limit: limit}, nil
}

func (s *AdminService) listByStatus(
	ctx context.Context,
	status sqlcdb.AccountStatus,
	page, limit int,
	offset, lim int32,
) (AdminUserListResponse, error) {
	list, err := s.q.ListCustomersByStatus(ctx, sqlcdb.ListCustomersByStatusParams{
		AccountStatus: status,
		Limit:         lim,
		Offset:        offset,
	})
	if err != nil {
		return AdminUserListResponse{}, err
	}
	rows := make([]AdminUserRow, len(list))
	for i, c := range list {
		rows[i] = toAdminRow(c.CustomerID, c.FirstName, c.LastName, c.Email,
			c.Phone, c.RegistrationDate, c.AccountStatus, c.UserRole)
	}
	return AdminUserListResponse{Users: rows, Total: int64(len(list)), Page: page, Limit: limit}, nil
}

func (s *AdminService) listAll(
	ctx context.Context,
	page, limit int,
	offset, lim int32,
) (AdminUserListResponse, error) {
	total, err := s.q.CountCustomers(ctx)
	if err != nil {
		return AdminUserListResponse{}, err
	}
	list, err := s.q.ListCustomers(ctx, sqlcdb.ListCustomersParams{Limit: lim, Offset: offset})
	if err != nil {
		return AdminUserListResponse{}, err
	}
	rows := make([]AdminUserRow, len(list))
	for i, c := range list {
		rows[i] = toAdminRow(c.CustomerID, c.FirstName, c.LastName, c.Email,
			c.Phone, c.RegistrationDate, c.AccountStatus, c.UserRole)
	}
	return AdminUserListResponse{Users: rows, Total: total, Page: page, Limit: limit}, nil
}

// UpdateUserStatus changes the account_status and, for suspensions, sets the end date.
// When newStatus is not suspended, suspended_until is cleared.
func (s *AdminService) UpdateUserStatus(
	ctx context.Context,
	customerID uuid.UUID,
	newStatus sqlcdb.AccountStatus,
	suspendedUntil *time.Time,
) (sqlcdb.UpdateCustomerStatusRow, error) {
	row, err := s.q.UpdateCustomerStatus(ctx, sqlcdb.UpdateCustomerStatusParams{
		CustomerID:    customerID,
		AccountStatus: newStatus,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return sqlcdb.UpdateCustomerStatusRow{}, ErrAdminUserNotFound
		}
		return sqlcdb.UpdateCustomerStatusRow{}, err
	}

	s.syncSuspendedUntil(ctx, customerID, newStatus, suspendedUntil)
	return row, nil
}

// syncSuspendedUntil writes or clears the suspended_until timestamp.
// Errors are logged as warnings and do not fail the status change.
func (s *AdminService) syncSuspendedUntil(
	ctx context.Context,
	customerID uuid.UUID,
	newStatus sqlcdb.AccountStatus,
	suspendedUntil *time.Time,
) {
	var until pgtype.Timestamptz
	if newStatus == sqlcdb.AccountStatusSuspended && suspendedUntil != nil {
		until = pgtype.Timestamptz{Time: *suspendedUntil, Valid: true}
	}
	if err := s.q.SetCustomerSuspendedUntil(ctx, customerID, until); err != nil {
		slog.Warn("admin: failed to sync suspended_until", "customer_id", customerID, "error", err)
	}
}

// ─── private helpers ──────────────────────────────────────────────────────────

func toAdminRow(
	id uuid.UUID,
	firstName, lastName, email string,
	phone pgtype.Text,
	regDate pgtype.Timestamptz,
	status sqlcdb.AccountStatus,
	role sqlcdb.UserRole,
) AdminUserRow {
	return AdminUserRow{
		CustomerID:       id,
		FirstName:        firstName,
		LastName:         lastName,
		Email:            email,
		Phone:            nullableStr(phone),
		RegistrationDate: nullableTime(regDate),
		AccountStatus:    status,
		UserRole:         role,
	}
}

func nullableStr(t pgtype.Text) string {
	if t.Valid {
		return t.String
	}
	return ""
}

func nullableTime(t pgtype.Timestamptz) string {
	if t.Valid {
		return t.Time.UTC().Format(time.RFC3339)
	}
	return ""
}
