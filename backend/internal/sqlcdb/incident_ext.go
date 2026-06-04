package sqlcdb

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

// ── Enum types ────────────────────────────────────────────────────────────────

// IncidentType classifies the incident reason.
type IncidentType string

const (
	// IncidentTypeDamage means the item was damaged.
	IncidentTypeDamage IncidentType = "damage"
	// IncidentTypeLateReturn means the item was returned late.
	IncidentTypeLateReturn IncidentType = "late_return"
	// IncidentTypeItemMismatch means the item did not match the listing.
	IncidentTypeItemMismatch IncidentType = "item_mismatch"
	// IncidentTypeNotDelivered means the item was not delivered.
	IncidentTypeNotDelivered IncidentType = "not_delivered"
	// IncidentTypeOther means the incident does not fit another category.
	IncidentTypeOther IncidentType = "other"
	// IncidentTypeNotAvailable means the listing is not actually available.
	IncidentTypeNotAvailable IncidentType = "not_available"
	// IncidentTypeForbiddenItem means the listing contains a forbidden item.
	IncidentTypeForbiddenItem IncidentType = "forbidden_item"
)

// Scan implements the Scanner interface for IncidentType.
func (e *IncidentType) Scan(src interface{}) error {
	switch s := src.(type) {
	case []byte:
		*e = IncidentType(s)
	case string:
		*e = IncidentType(s)
	default:
		return fmt.Errorf("unsupported scan type for IncidentType: %T", src)
	}
	return nil
}

// IncidentStatus tracks the lifecycle of an incident.
type IncidentStatus string

const (
	// IncidentStatusOpen is the initial state.
	IncidentStatusOpen IncidentStatus = "open"
	// IncidentStatusUnderReview means the admin is investigating.
	IncidentStatusUnderReview IncidentStatus = "under_review"
	// IncidentStatusResolved means the incident has been closed.
	IncidentStatusResolved IncidentStatus = "resolved"
	// IncidentStatusClosed means the incident has been archived.
	IncidentStatusClosed IncidentStatus = "closed"
)

// Scan implements the Scanner interface for IncidentStatus.
func (e *IncidentStatus) Scan(src interface{}) error {
	switch s := src.(type) {
	case []byte:
		*e = IncidentStatus(s)
	case string:
		*e = IncidentStatus(s)
	default:
		return fmt.Errorf("unsupported scan type for IncidentStatus: %T", src)
	}
	return nil
}

// ── Row types ─────────────────────────────────────────────────────────────────

// CreateIncidentParams holds the fields needed to open a new incident.
type CreateIncidentParams struct {
	RentalID       uuid.UUID
	ReporterID     uuid.UUID
	IncidentType   IncidentType
	Description    string
	AssociatedCost pgtype.Numeric
}

// CreateProductIncidentParams holds the fields needed to report a product outside a rental.
type CreateProductIncidentParams struct {
	ItemID       uuid.UUID
	ReporterID   uuid.UUID
	IncidentType IncidentType
	Description  string
	Priority     string
}

// CreateUserIncidentParams holds the fields needed to report a user outside a rental.
type CreateUserIncidentParams struct {
	ReportedCustomerID uuid.UUID
	ReporterID         uuid.UUID
	IncidentType       IncidentType
	Description        string
	Priority           string
}

// IncidentRow is the full enriched incident used in both list and detail views.
type IncidentRow struct {
	IncidentID     uuid.UUID
	RentalID       uuid.UUID
	ReporterID     uuid.UUID
	ReporterName   string
	ReportedID     uuid.UUID
	ReportedName   string
	BookingID      uuid.UUID
	ItemID         uuid.UUID
	ItemTitle      string
	StartDate      time.Time
	EndDate        time.Time
	IncidentType   IncidentType
	Description    string
	IncidentStatus IncidentStatus
	Priority       string
	AssociatedCost pgtype.Numeric
	ReportedAt     pgtype.Timestamptz
	TotalCount     int64
}

// ── SQL ───────────────────────────────────────────────────────────────────────

const incidentCols = `
    i.incident_id,
    COALESCE(i.rental_id, '00000000-0000-0000-0000-000000000000'::uuid) AS rental_id,
    i.reporter_id,
    rep.first_name || ' ' || rep.last_name          AS reporter_name,
    CASE WHEN i.reported_customer_id IS NOT NULL
         THEN reported.customer_id
         WHEN b.booking_id IS NULL
         THEN own.customer_id
         WHEN b.renter_id = i.reporter_id
         THEN own.customer_id ELSE b.renter_id
    END                                              AS reported_id,
    CASE WHEN i.reported_customer_id IS NOT NULL
         THEN reported.first_name || ' ' || reported.last_name
         WHEN b.booking_id IS NULL
         THEN own.first_name || ' ' || own.last_name
         WHEN b.renter_id = i.reporter_id
         THEN own.first_name || ' ' || own.last_name
         ELSE ren.first_name || ' ' || ren.last_name
    END                                              AS reported_name,
    COALESCE(b.booking_id, '00000000-0000-0000-0000-000000000000'::uuid) AS booking_id,
    COALESCE(it.item_id, '00000000-0000-0000-0000-000000000000'::uuid) AS item_id,
    COALESCE(it.title, 'Usuario reportado')          AS item_title,
    COALESCE(b.start_date::timestamptz, i.reported_at) AS start_date,
    COALESCE(b.end_date::timestamptz, i.reported_at)   AS end_date,
    i.incident_type,
    i.description,
    i.incident_status,
    COALESCE(i.priority, 'medium')                  AS priority,
    i.associated_cost,
    i.reported_at
`

const incidentJoins = `
FROM incident i
LEFT JOIN rental  r   ON r.rental_id   = i.rental_id
LEFT JOIN booking b   ON b.booking_id  = r.booking_id
LEFT JOIN item it ON it.item_id = COALESCE(b.item_id, i.item_id)
JOIN customer rep ON rep.customer_id = i.reporter_id
LEFT JOIN customer ren ON ren.customer_id = b.renter_id
LEFT JOIN customer own ON own.customer_id = it.owner_id
LEFT JOIN customer reported ON reported.customer_id = i.reported_customer_id
`

const createIncident = `
INSERT INTO incident (rental_id, reporter_id, incident_type, description, associated_cost)
VALUES ($1, $2, $3, $4, $5)
RETURNING incident_id
`

const createProductIncident = `
INSERT INTO incident (item_id, reporter_id, incident_type, description, priority)
VALUES ($1, $2, $3, $4, $5)
RETURNING incident_id
`

const createUserIncident = `
INSERT INTO incident (reported_customer_id, reporter_id, incident_type, description, priority)
VALUES ($1, $2, $3, $4, $5)
RETURNING incident_id
`

const getIncidentByID = `
SELECT ` + incidentCols + `, 0::bigint AS total_count
` + incidentJoins + `
WHERE i.incident_id = $1
LIMIT 1
`

const listIncidentsByReporter = `
SELECT ` + incidentCols + `, COUNT(*) OVER() AS total_count
` + incidentJoins + `
WHERE i.reporter_id = $1
ORDER BY i.reported_at DESC
LIMIT $2 OFFSET $3
`

const listIncidentsAdmin = `
SELECT ` + incidentCols + `, COUNT(*) OVER() AS total_count
` + incidentJoins + `
WHERE ($1::text IS NULL OR i.incident_status::text = $1::text)
  AND ($2::text IS NULL OR i.incident_type::text   = $2::text)
ORDER BY i.reported_at DESC
LIMIT $3 OFFSET $4
`

const updateIncidentStatus = `
UPDATE incident SET incident_status = $2 WHERE incident_id = $1
RETURNING incident_id, incident_status
`

const updateIncidentPriority = `
UPDATE incident SET priority = $2 WHERE incident_id = $1
RETURNING incident_id, priority
`

const countOpenIncidents = `
SELECT COUNT(*) FROM incident WHERE incident_status = 'open'
`

const countUnderReviewIncidents = `
SELECT COUNT(*) FROM incident WHERE incident_status = 'under_review'
`

// ── Methods ───────────────────────────────────────────────────────────────────

// CreateIncident opens a new incident and returns its generated ID.
func (q *Queries) CreateIncident(ctx context.Context, arg CreateIncidentParams) (uuid.UUID, error) {
	var id uuid.UUID
	err := q.db.QueryRow(ctx, createIncident,
		arg.RentalID, arg.ReporterID, arg.IncidentType,
		arg.Description, arg.AssociatedCost,
	).Scan(&id)
	return id, err
}

// CreateProductIncident stores a product report directly in the incident table.
func (q *Queries) CreateProductIncident(ctx context.Context, arg CreateProductIncidentParams) (uuid.UUID, error) {
	var id uuid.UUID
	err := q.db.QueryRow(ctx, createProductIncident,
		arg.ItemID, arg.ReporterID, arg.IncidentType, arg.Description, arg.Priority,
	).Scan(&id)
	return id, err
}

// CreateUserIncident stores a user report directly in the incident table.
func (q *Queries) CreateUserIncident(ctx context.Context, arg CreateUserIncidentParams) (uuid.UUID, error) {
	var id uuid.UUID
	err := q.db.QueryRow(ctx, createUserIncident,
		arg.ReportedCustomerID, arg.ReporterID, arg.IncidentType, arg.Description, arg.Priority,
	).Scan(&id)
	return id, err
}

// GetIncidentByID returns the full enriched incident or pgx.ErrNoRows.
func (q *Queries) GetIncidentByID(ctx context.Context, incidentID uuid.UUID) (IncidentRow, error) {
	return scanIncident(q.db.QueryRow(ctx, getIncidentByID, incidentID))
}

// ListIncidentsByReporter returns all incidents filed by a customer, newest first.
func (q *Queries) ListIncidentsByReporter(ctx context.Context, reporterID uuid.UUID, limit, offset int32) ([]IncidentRow, error) {
	rows, err := q.db.Query(ctx, listIncidentsByReporter, reporterID, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return collectIncidents(rows)
}

// ListIncidentsAdminParams controls optional filters for the admin list.
type ListIncidentsAdminParams struct {
	Status pgtype.Text // NULL = all statuses
	Type   pgtype.Text // NULL = all types
	Limit  int32
	Offset int32
}

// ListIncidentsAdmin returns a filtered, paginated incident list for admins.
func (q *Queries) ListIncidentsAdmin(ctx context.Context, arg ListIncidentsAdminParams) ([]IncidentRow, error) {
	rows, err := q.db.Query(ctx, listIncidentsAdmin,
		arg.Status, arg.Type, arg.Limit, arg.Offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return collectIncidents(rows)
}

// UpdateIncidentStatus changes the status of an incident.
func (q *Queries) UpdateIncidentStatus(ctx context.Context, id uuid.UUID, status IncidentStatus) (IncidentStatus, error) {
	var outID uuid.UUID
	var outStatus IncidentStatus
	err := q.db.QueryRow(ctx, updateIncidentStatus, id, status).Scan(&outID, &outStatus)
	return outStatus, err
}

// UpdateIncidentPriority changes the priority of an incident.
func (q *Queries) UpdateIncidentPriority(ctx context.Context, id uuid.UUID, priority string) (string, error) {
	var outID uuid.UUID
	var outPriority string
	err := q.db.QueryRow(ctx, updateIncidentPriority, id, priority).Scan(&outID, &outPriority)
	return outPriority, err
}

// CountOpenIncidents returns the number of incidents in 'open' state.
func (q *Queries) CountOpenIncidents(ctx context.Context) (int64, error) {
	var n int64
	err := q.db.QueryRow(ctx, countOpenIncidents).Scan(&n)
	return n, err
}

// CountUnderReviewIncidents returns the number of incidents currently under review.
func (q *Queries) CountUnderReviewIncidents(ctx context.Context) (int64, error) {
	var n int64
	err := q.db.QueryRow(ctx, countUnderReviewIncidents).Scan(&n)
	return n, err
}

// ── Scan helpers ──────────────────────────────────────────────────────────────

func scanIncident(row pgx.Row) (IncidentRow, error) {
	var r IncidentRow
	err := row.Scan(
		&r.IncidentID,
		&r.RentalID,
		&r.ReporterID,
		&r.ReporterName,
		&r.ReportedID,
		&r.ReportedName,
		&r.BookingID,
		&r.ItemID,
		&r.ItemTitle,
		&r.StartDate,
		&r.EndDate,
		&r.IncidentType,
		&r.Description,
		&r.IncidentStatus,
		&r.Priority,
		&r.AssociatedCost,
		&r.ReportedAt,
		&r.TotalCount,
	)
	return r, err
}

func collectIncidents(rows pgx.Rows) ([]IncidentRow, error) {
	return pgx.CollectRows(rows, func(row pgx.CollectableRow) (IncidentRow, error) {
		return scanIncident(row)
	})
}
