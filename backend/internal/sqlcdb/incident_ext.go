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

// IncidentType classifies whether the incident concerns the item or the user.
type IncidentType string

const (
	// IncidentTypeProduct means the incident is about the rented product.
	IncidentTypeProduct IncidentType = "product"
	// IncidentTypeUser means the incident is about the other party's behaviour.
	IncidentTypeUser IncidentType = "user"
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
	// IncidentStatusReviewing means the admin is investigating.
	IncidentStatusReviewing IncidentStatus = "reviewing"
	// IncidentStatusEscalated means the incident requires senior action.
	IncidentStatusEscalated IncidentStatus = "escalated"
	// IncidentStatusResolved means the incident has been closed.
	IncidentStatusResolved IncidentStatus = "resolved"
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
    i.rental_id,
    i.reporter_id,
    rep.first_name || ' ' || rep.last_name          AS reporter_name,
    CASE WHEN b.renter_id = i.reporter_id
         THEN own.customer_id ELSE b.renter_id
    END                                              AS reported_id,
    CASE WHEN b.renter_id = i.reporter_id
         THEN own.first_name || ' ' || own.last_name
         ELSE ren.first_name || ' ' || ren.last_name
    END                                              AS reported_name,
    b.booking_id,
    it.item_id,
    it.title                                         AS item_title,
    b.start_date,
    b.end_date,
    i.incident_type,
    i.description,
    i.incident_status,
    COALESCE(i.priority, 'medium')                  AS priority,
    i.associated_cost,
    i.reported_at
`

const incidentJoins = `
FROM incident i
JOIN rental   r   ON r.rental_id   = i.rental_id
JOIN booking  b   ON b.booking_id  = r.booking_id
JOIN item     it  ON it.item_id    = b.item_id
JOIN customer rep ON rep.customer_id = i.reporter_id
JOIN customer ren ON ren.customer_id = b.renter_id
JOIN customer own ON own.customer_id = it.owner_id
`

const createIncident = `
INSERT INTO incident (rental_id, reporter_id, incident_type, description, associated_cost)
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

const countOpenIncidents = `
SELECT COUNT(*) FROM incident WHERE incident_status = 'open'
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

// CountOpenIncidents returns the number of incidents in 'open' state.
func (q *Queries) CountOpenIncidents(ctx context.Context) (int64, error) {
	var n int64
	err := q.db.QueryRow(ctx, countOpenIncidents).Scan(&n)
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
