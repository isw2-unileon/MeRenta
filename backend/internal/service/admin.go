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

// ErrAdminBookingNotFound is returned when the target booking does not exist.
var ErrAdminBookingNotFound = errors.New("booking not found")

// adminQuerier is the minimal DB interface needed by AdminService.
type adminQuerier interface {
	CountCustomers(ctx context.Context) (int64, error)
	CountItems(ctx context.Context) (int64, error)
	ListCustomers(ctx context.Context, arg sqlcdb.ListCustomersParams) ([]sqlcdb.ListCustomersRow, error)
	ListCustomersByStatus(ctx context.Context, arg sqlcdb.ListCustomersByStatusParams) ([]sqlcdb.ListCustomersByStatusRow, error)
	SearchCustomers(ctx context.Context, arg sqlcdb.SearchCustomersParams) ([]sqlcdb.SearchCustomersRow, error)
	SearchItemCards(ctx context.Context, arg sqlcdb.SearchItemCardsParams) ([]sqlcdb.SearchItemCardsRow, error)
	UpdateCustomerStatus(ctx context.Context, arg sqlcdb.UpdateCustomerStatusParams) (sqlcdb.UpdateCustomerStatusRow, error)
	SetCustomerSuspendedUntil(ctx context.Context, customerID uuid.UUID, until pgtype.Timestamptz) error
	EnsureCustomerVerificationSchema(ctx context.Context) error
	ListAdminVerificationRows(ctx context.Context, status sqlcdb.VerificationStatus, limit, offset int32) ([]sqlcdb.AdminVerificationRow, error)
	CountAdminVerificationRows(ctx context.Context, status sqlcdb.VerificationStatus) (int64, error)
	UpdateCustomerVerificationStatus(ctx context.Context, customerID uuid.UUID, status sqlcdb.VerificationStatus) (sqlcdb.VerificationStatus, error)
	AdminListBookings(ctx context.Context, arg sqlcdb.AdminListBookingsParams) ([]sqlcdb.BookingDetailRow, error)
	AdminListPayments(ctx context.Context, arg sqlcdb.AdminListPaymentsParams) ([]sqlcdb.BookingDetailRow, error)
	GetBookingByID(ctx context.Context, bookingID uuid.UUID) (sqlcdb.BookingDetailRow, error)
	GetBookingStats(ctx context.Context) (sqlcdb.BookingStatsRow, error)
	GetMonthlyRevenue(ctx context.Context) ([]sqlcdb.MonthlyRevenueRow, error)
	UpdateBookingStatus(ctx context.Context, arg sqlcdb.UpdateBookingStatusParams) (sqlcdb.BookingRow, error)
	CountOpenIncidents(ctx context.Context) (int64, error)
	CountUnderReviewIncidents(ctx context.Context) (int64, error)
	ListIncidentsAdmin(ctx context.Context, arg sqlcdb.ListIncidentsAdminParams) ([]sqlcdb.IncidentRow, error)
	CountItemCardsByCategory(ctx context.Context, arg sqlcdb.CountItemCardsByCategoryParams) ([]sqlcdb.CountItemCardsByCategoryRow, error)
	InsertAuditLog(ctx context.Context, p sqlcdb.InsertAuditLogParams) error
	ListAuditLog(ctx context.Context, action string, adminID uuid.UUID, allAdmins bool, limit, offset int32) ([]sqlcdb.AuditLogRow, error)
	CountAuditLog(ctx context.Context, action string, adminID uuid.UUID, allAdmins bool) (int64, error)
}

// AdminService provides admin-only business logic.
type AdminService struct {
	q        adminQuerier
	refunder PaymentRefunder // issues Stripe refunds when admin cancels/rejects paid bookings
}

// NewAdminService builds a new AdminService.
// refunder may be nil in tests; when nil, no Stripe refund is attempted.
func NewAdminService(q adminQuerier, refunder PaymentRefunder) *AdminService {
	return &AdminService{q: q, refunder: refunder}
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

// AdminVerificationRow is one customer in the admin verification queue.
type AdminVerificationRow struct {
	CustomerID         uuid.UUID                 `json:"customer_id"`
	FirstName          string                    `json:"first_name"`
	LastName           string                    `json:"last_name"`
	Email              string                    `json:"email"`
	Phone              string                    `json:"phone,omitempty"`
	AvatarURL          string                    `json:"avatar_url,omitempty"`
	AccountStatus      sqlcdb.AccountStatus      `json:"account_status"`
	VerificationStatus sqlcdb.VerificationStatus `json:"verification_status"`
	RequestedAt        string                    `json:"requested_at"`
	HasAddress         bool                      `json:"has_address"`
}

// AdminVerificationListResponse is the paginated verification queue.
type AdminVerificationListResponse struct {
	Requests []AdminVerificationRow `json:"requests"`
	Total    int64                  `json:"total"`
	Page     int                    `json:"page"`
	Limit    int                    `json:"limit"`
}

// AuditEntry is one admin action in the audit log.
type AuditEntry struct {
	LogID      string `json:"log_id"`
	AdminEmail string `json:"admin_email"`
	Action     string `json:"action"`
	EntityType string `json:"entity_type"`
	EntityID   string `json:"entity_id"`
	OldValue   string `json:"old_value,omitempty"`
	NewValue   string `json:"new_value"`
	Detail     string `json:"detail,omitempty"`
	CreatedAt  string `json:"created_at"`
}

// AuditLogListResponse is the paginated audit log returned to admins.
type AuditLogListResponse struct {
	Entries []AuditEntry `json:"entries"`
	Total   int64        `json:"total"`
	Page    int          `json:"page"`
	Limit   int          `json:"limit"`
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

// ListVerification returns profile badge requests filtered by decision status.
func (s *AdminService) ListVerification(
	ctx context.Context,
	status string,
	page, limit int,
) (AdminVerificationListResponse, error) {
	offset := int32((page - 1) * limit) //nolint:gosec
	lim := int32(limit)                 //nolint:gosec
	verificationStatus := sqlcdb.VerificationStatus(status)

	if err := s.q.EnsureCustomerVerificationSchema(ctx); err != nil {
		return AdminVerificationListResponse{}, err
	}

	total, err := s.q.CountAdminVerificationRows(ctx, verificationStatus)
	if err != nil {
		return AdminVerificationListResponse{}, err
	}
	list, err := s.q.ListAdminVerificationRows(ctx, verificationStatus, lim, offset)
	if err != nil {
		return AdminVerificationListResponse{}, err
	}

	rows := make([]AdminVerificationRow, len(list))
	for i, c := range list {
		rows[i] = AdminVerificationRow{
			CustomerID:         c.CustomerID,
			FirstName:          c.FirstName,
			LastName:           c.LastName,
			Email:              c.Email,
			Phone:              nullableStr(c.Phone),
			AvatarURL:          nullableStr(c.AvatarURL),
			AccountStatus:      c.AccountStatus,
			VerificationStatus: c.VerificationStatus,
			RequestedAt:        nullableTime(c.RequestedVerificationAt),
			HasAddress:         c.HasAddress,
		}
	}
	return AdminVerificationListResponse{Requests: rows, Total: total, Page: page, Limit: limit}, nil
}

// UpdateVerification records an admin verification decision.
func (s *AdminService) UpdateVerification(
	ctx context.Context,
	customerID uuid.UUID,
	status sqlcdb.VerificationStatus,
) (sqlcdb.VerificationStatus, error) {
	if err := s.q.EnsureCustomerVerificationSchema(ctx); err != nil {
		return "", err
	}

	updated, err := s.q.UpdateCustomerVerificationStatus(ctx, customerID, status)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", ErrAdminUserNotFound
		}
		return "", err
	}
	return updated, nil
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

// LogAuditEntry writes an audit log entry. Errors are warnings only.
func (s *AdminService) LogAuditEntry(
	ctx context.Context,
	adminID uuid.UUID,
	adminEmail, action, entityType, entityID, oldValue, newValue, detail string,
) {
	if err := s.q.InsertAuditLog(ctx, sqlcdb.InsertAuditLogParams{
		AdminID:    adminID,
		AdminEmail: adminEmail,
		Action:     action,
		EntityType: entityType,
		EntityID:   entityID,
		OldValue:   textOrNull(oldValue),
		NewValue:   newValue,
		Detail:     textOrNull(detail),
	}); err != nil {
		slog.Warn("admin audit log insert failed", "admin_id", adminID, "action", action, "error", err)
	}
}

// ListAuditLog returns audit entries, newest first.
func (s *AdminService) ListAuditLog(ctx context.Context, action string, page, limit int) (AuditLogListResponse, error) {
	offset := int32((page - 1) * limit) //nolint:gosec
	lim := int32(limit)                 //nolint:gosec

	total, err := s.q.CountAuditLog(ctx, action, uuid.Nil, true)
	if err != nil {
		return AuditLogListResponse{}, err
	}
	list, err := s.q.ListAuditLog(ctx, action, uuid.Nil, true, lim, offset)
	if err != nil {
		return AuditLogListResponse{}, err
	}

	entries := make([]AuditEntry, len(list))
	for i, row := range list {
		entries[i] = AuditEntry{
			LogID:      row.LogID.String(),
			AdminEmail: row.AdminEmail,
			Action:     row.Action,
			EntityType: row.EntityType,
			EntityID:   row.EntityID,
			OldValue:   nullableStr(row.OldValue),
			NewValue:   row.NewValue,
			Detail:     nullableStr(row.Detail),
			CreatedAt:  nullableTime(row.CreatedAt),
		}
	}
	return AuditLogListResponse{Entries: entries, Total: total, Page: page, Limit: limit}, nil
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

// ListBookings returns bookings for the admin panel with optional status filter,
// full-text search and configurable sort order.
func (s *AdminService) ListBookings(ctx context.Context, status, query, sort string, page, limit int) (*model.BookingListResponse, error) {
	offset := (page - 1) * limit
	rows, err := s.q.AdminListBookings(ctx, sqlcdb.AdminListBookingsParams{
		Status: status,
		Query:  query,
		Sort:   sort,
		Limit:  limit,
		Offset: offset,
	})
	if err != nil {
		return nil, err
	}
	result, err := buildBookingListResponse(rows)
	if err != nil {
		return nil, err
	}
	return &result, nil
}

// ListPayments returns all bookings that went through Stripe, paginated.
// paymentStatus: "" = all, "paid" = charged, "refunded" = refunded.
func (s *AdminService) ListPayments(ctx context.Context, paymentStatus, query string, page, limit int) (*model.BookingListResponse, error) {
	offset := (page - 1) * limit
	rows, err := s.q.AdminListPayments(ctx, sqlcdb.AdminListPaymentsParams{
		PaymentStatus: paymentStatus,
		Query:         query,
		Limit:         limit,
		Offset:        offset,
	})
	if err != nil {
		return nil, err
	}
	result, err := buildBookingListResponse(rows)
	if err != nil {
		return nil, err
	}
	return &result, nil
}

// AdminUpdateBookingStatus sets a booking to any valid status (admin override).
// When the new status is cancelled or rejected, a Stripe refund is issued
// automatically if the booking has a payment_intent_id.
func (s *AdminService) AdminUpdateBookingStatus(
	ctx context.Context,
	bookingID uuid.UUID,
	status sqlcdb.BookingStatus,
) (model.BookingResponse, error) {
	if isRefundStatus(status) && s.refunder != nil {
		booking, bErr := s.q.GetBookingByID(ctx, bookingID)
		if bErr == nil && booking.PaymentIntentID.Valid && booking.PaymentIntentID.String != "" {
			if rErr := s.refunder.RefundPayment(ctx, booking.PaymentIntentID.String); rErr != nil {
				slog.Warn("admin refund failed", "booking_id", bookingID, "error", rErr)
			}
		}
	}

	row, err := s.q.UpdateBookingStatus(ctx, sqlcdb.UpdateBookingStatusParams{
		BookingID: bookingID,
		Status:    status,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return model.BookingResponse{}, ErrAdminBookingNotFound
		}
		return model.BookingResponse{}, err
	}
	return bookingRowToResponse(row)
}

// AdminStatsResponse holds all KPI counts and chart data for the admin dashboard.
type AdminStatsResponse struct {
	Users           int64               `json:"users"`
	Products        int64               `json:"products"`
	Bookings        AdminBookingStats   `json:"bookings"`
	Revenue         float64             `json:"revenue"`
	MonthlyRevenue  []MonthlyPoint      `json:"monthly_revenue"`
	Categories      []CategoryPoint     `json:"categories"`
	Incidents       AdminIncidentStats  `json:"incidents"`
	RecentIncidents []RecentIncidentRow `json:"recent_incidents"`
}

// AdminBookingStats breaks down bookings by lifecycle status.
type AdminBookingStats struct {
	Total     int64 `json:"total"`
	Pending   int64 `json:"pending"`
	Accepted  int64 `json:"accepted"`
	Completed int64 `json:"completed"`
	Cancelled int64 `json:"cancelled"`
	Rejected  int64 `json:"rejected"`
}

// AdminIncidentStats holds open and under-review incident counts.
type AdminIncidentStats struct {
	Open        int64 `json:"open"`
	UnderReview int64 `json:"under_review"`
}

// MonthlyPoint is a single data point in the revenue chart.
type MonthlyPoint struct {
	Month   string  `json:"month"`
	Revenue float64 `json:"revenue"`
}

// CategoryPoint is a single bar in the categories chart.
type CategoryPoint struct {
	Category string `json:"category"`
	Count    int64  `json:"count"`
}

// RecentIncidentRow is a compact incident summary for the dashboard.
type RecentIncidentRow struct {
	IncidentID   string `json:"incident_id"`
	Type         string `json:"type"`
	ItemTitle    string `json:"item_title"`
	ReporterName string `json:"reporter_name"`
	Status       string `json:"status"`
	Priority     string `json:"priority"`
	ReportedAt   string `json:"reported_at"`
}

// GetStats fetches all KPIs and chart data for the admin dashboard.
func (s *AdminService) GetStats(ctx context.Context) (AdminStatsResponse, error) {
	users, err := s.q.CountCustomers(ctx)
	if err != nil {
		return AdminStatsResponse{}, err
	}
	products, err := s.q.CountItems(ctx)
	if err != nil {
		return AdminStatsResponse{}, err
	}
	bStats, err := s.q.GetBookingStats(ctx)
	if err != nil {
		return AdminStatsResponse{}, err
	}
	open, err := s.q.CountOpenIncidents(ctx)
	if err != nil {
		return AdminStatsResponse{}, err
	}
	underReview, err := s.q.CountUnderReviewIncidents(ctx)
	if err != nil {
		return AdminStatsResponse{}, err
	}
	monthlyRows, err := s.q.GetMonthlyRevenue(ctx)
	if err != nil {
		return AdminStatsResponse{}, err
	}
	catRows, err := s.q.CountItemCardsByCategory(ctx, sqlcdb.CountItemCardsByCategoryParams{})
	if err != nil {
		return AdminStatsResponse{}, err
	}
	incRows, err := s.q.ListIncidentsAdmin(ctx, sqlcdb.ListIncidentsAdminParams{Limit: 5})
	if err != nil {
		return AdminStatsResponse{}, err
	}

	revenue, _ := numericToFloat64(bStats.TotalRevenue)
	return AdminStatsResponse{
		Users:    users,
		Products: products,
		Bookings: AdminBookingStats{
			Total: bStats.Total, Pending: bStats.Pending, Accepted: bStats.Accepted,
			Completed: bStats.Completed, Cancelled: bStats.Cancelled, Rejected: bStats.Rejected,
		},
		Revenue:         revenue,
		MonthlyRevenue:  toMonthlyPoints(monthlyRows),
		Categories:      toCategoryPoints(catRows),
		Incidents:       AdminIncidentStats{Open: open, UnderReview: underReview},
		RecentIncidents: toRecentIncidents(incRows),
	}, nil
}

var spanishMonths = [13]string{"", "Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"}

func toMonthlyPoints(rows []sqlcdb.MonthlyRevenueRow) []MonthlyPoint {
	pts := make([]MonthlyPoint, len(rows))
	for i, r := range rows {
		rev, _ := numericToFloat64(r.Revenue)
		pts[i] = MonthlyPoint{Month: spanishMonths[r.Month.Month()], Revenue: rev}
	}
	return pts
}

func toCategoryPoints(rows []sqlcdb.CountItemCardsByCategoryRow) []CategoryPoint {
	pts := make([]CategoryPoint, len(rows))
	for i, r := range rows {
		pts[i] = CategoryPoint{Category: string(r.Category), Count: r.TotalCount}
	}
	return pts
}

func toRecentIncidents(rows []sqlcdb.IncidentRow) []RecentIncidentRow {
	pts := make([]RecentIncidentRow, len(rows))
	for i, r := range rows {
		reportedAt := ""
		if r.ReportedAt.Valid {
			reportedAt = r.ReportedAt.Time.Format(time.RFC3339)
		}
		pts[i] = RecentIncidentRow{
			IncidentID:   r.IncidentID.String(),
			Type:         string(r.IncidentType),
			ItemTitle:    r.ItemTitle,
			ReporterName: r.ReporterName,
			Status:       string(r.IncidentStatus),
			Priority:     r.Priority,
			ReportedAt:   reportedAt,
		}
	}
	return pts
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

func textOrNull(value string) pgtype.Text {
	return pgtype.Text{String: value, Valid: value != ""}
}
