package sqlcdb

import (
	"context"
	"database/sql/driver"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

// VerificationStatus values stored in customer.verification_status.
type VerificationStatus string

const (
	// VerificationStatusNone means the customer has not requested verification.
	VerificationStatusNone VerificationStatus = "none"
	// VerificationStatusPending means the customer is waiting for admin review.
	VerificationStatusPending VerificationStatus = "pending"
	// VerificationStatusVerified means the admin granted the verified badge.
	VerificationStatusVerified VerificationStatus = "verified"
	// VerificationStatusRejected means the admin rejected the latest request.
	VerificationStatusRejected VerificationStatus = "rejected"
)

// Scan implements database scanning for the Postgres enum.
func (e *VerificationStatus) Scan(src interface{}) error {
	switch s := src.(type) {
	case []byte:
		*e = VerificationStatus(s)
	case string:
		*e = VerificationStatus(s)
	default:
		return fmt.Errorf("unsupported scan type for VerificationStatus: %T", src)
	}
	return nil
}

// Value implements the driver Valuer interface.
func (e VerificationStatus) Value() (driver.Value, error) {
	return string(e), nil
}

// AdminVerificationRow is a compact row for the admin verification queue.
type AdminVerificationRow struct {
	CustomerID              uuid.UUID
	FirstName               string
	LastName                string
	Email                   string
	Phone                   pgtype.Text
	AvatarURL               pgtype.Text
	AccountStatus           AccountStatus
	VerificationStatus      VerificationStatus
	RequestedVerificationAt pgtype.Timestamptz
	HasAddress              bool
}

// EnsureCustomerVerificationSchema creates the verification storage expected by
// this feature when a local database has not applied the latest migration yet.
func (q *Queries) EnsureCustomerVerificationSchema(ctx context.Context) error {
	const query = `
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'verification_status_enum') THEN
        CREATE TYPE verification_status_enum AS ENUM ('none', 'pending', 'verified', 'rejected');
    END IF;
END $$;

ALTER TABLE customer
    ADD COLUMN IF NOT EXISTS verification_status verification_status_enum NOT NULL DEFAULT 'none',
    ADD COLUMN IF NOT EXISTS requested_verification_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_customer_verification_status
    ON customer (verification_status, requested_verification_at DESC);`
	_, err := q.db.Exec(ctx, query)
	return err
}

// ListAdminVerificationRows returns customers for the verification queue.
func (q *Queries) ListAdminVerificationRows(
	ctx context.Context,
	status VerificationStatus,
	limit, offset int32,
) ([]AdminVerificationRow, error) {
	const query = `
SELECT
    c.customer_id,
    c.first_name,
    c.last_name,
    c.email,
    c.phone,
    c.avatar_url,
    c.account_status,
    c.verification_status,
    c.requested_verification_at,
    EXISTS (SELECT 1 FROM address a WHERE a.customer_id = c.customer_id) AS has_address
FROM customer c
WHERE c.verification_status = $1
ORDER BY c.requested_verification_at DESC NULLS LAST, c.registration_date DESC
LIMIT $2 OFFSET $3`

	rows, err := q.db.Query(ctx, query, status, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []AdminVerificationRow
	for rows.Next() {
		var row AdminVerificationRow
		if err := rows.Scan(
			&row.CustomerID,
			&row.FirstName,
			&row.LastName,
			&row.Email,
			&row.Phone,
			&row.AvatarURL,
			&row.AccountStatus,
			&row.VerificationStatus,
			&row.RequestedVerificationAt,
			&row.HasAddress,
		); err != nil {
			return nil, err
		}
		items = append(items, row)
	}
	return items, rows.Err()
}

// CountAdminVerificationRows returns the total queue size for a status.
func (q *Queries) CountAdminVerificationRows(ctx context.Context, status VerificationStatus) (int64, error) {
	const query = `SELECT COUNT(*) FROM customer WHERE verification_status = $1`
	var count int64
	err := q.db.QueryRow(ctx, query, status).Scan(&count)
	return count, err
}

// UpdateCustomerVerificationStatus sets the admin decision for a customer.
func (q *Queries) UpdateCustomerVerificationStatus(
	ctx context.Context,
	customerID uuid.UUID,
	status VerificationStatus,
) (VerificationStatus, error) {
	const query = `
UPDATE customer
SET verification_status = $2
WHERE customer_id = $1
RETURNING verification_status`
	var updated VerificationStatus
	err := q.db.QueryRow(ctx, query, customerID, status).Scan(&updated)
	return updated, err
}

// RequestCustomerVerification moves the current user into the pending queue.
func (q *Queries) RequestCustomerVerification(ctx context.Context, customerID uuid.UUID) (VerificationStatus, error) {
	const query = `
UPDATE customer
SET verification_status = 'pending',
    requested_verification_at = now()
WHERE customer_id = $1
  AND verification_status <> 'verified'
RETURNING verification_status`
	var status VerificationStatus
	err := q.db.QueryRow(ctx, query, customerID).Scan(&status)
	return status, err
}

// GetCustomerVerificationStatus reads the profile badge status for the customer.
func (q *Queries) GetCustomerVerificationStatus(ctx context.Context, customerID uuid.UUID) (VerificationStatus, error) {
	const query = `SELECT verification_status FROM customer WHERE customer_id = $1`
	var status VerificationStatus
	err := q.db.QueryRow(ctx, query, customerID).Scan(&status)
	return status, err
}
