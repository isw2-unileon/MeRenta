package sqlcdb

import (
	"context"
	"time"

	"github.com/google/uuid"
)

// PlatformConfig holds the singleton platform settings row.
type PlatformConfig struct {
	// AllowNewRegistrations controls whether POST /api/auth/register is open.
	AllowNewRegistrations bool
	// UpdatedAt is when the config was last saved.
	UpdatedAt time.Time
	// UpdatedByEmail is the email of the admin who last changed it.
	// Empty when the row has never been edited or the admin account was deleted.
	UpdatedByEmail string
}

// GetPlatformConfig returns the singleton platform settings row, joining
// customer to resolve the editor's email.
// Returns a safe, permissive default when the row does not exist.
func (q *Queries) GetPlatformConfig(ctx context.Context) (PlatformConfig, error) {
	const query = `
SELECT pc.allow_new_registrations,
       pc.updated_at,
       COALESCE(c.email, '') AS updated_by_email
FROM   platform_config pc
LEFT   JOIN customer c ON c.customer_id = pc.updated_by
WHERE  pc.id = 1`

	var cfg PlatformConfig
	err := q.db.QueryRow(ctx, query).Scan(
		&cfg.AllowNewRegistrations,
		&cfg.UpdatedAt,
		&cfg.UpdatedByEmail,
	)
	if err != nil {
		// Row not yet seeded — return a permissive default so the app stays
		// functional even before the migration has been applied.
		return PlatformConfig{AllowNewRegistrations: true, UpdatedAt: time.Now()}, nil
	}
	return cfg, nil
}

// SetPlatformConfig upserts the singleton row with the new
// allow_new_registrations value and records which admin changed it.
func (q *Queries) SetPlatformConfig(
	ctx context.Context,
	allowReg bool,
	adminID uuid.UUID,
) (PlatformConfig, error) {
	const query = `
INSERT INTO platform_config (id, allow_new_registrations, updated_at, updated_by)
VALUES (1, $1, NOW(), $2)
ON CONFLICT (id) DO UPDATE
    SET allow_new_registrations = EXCLUDED.allow_new_registrations,
        updated_at              = NOW(),
        updated_by              = EXCLUDED.updated_by`

	if _, err := q.db.Exec(ctx, query, allowReg, adminID); err != nil {
		return PlatformConfig{}, err
	}
	return q.GetPlatformConfig(ctx)
}

// GetAllowNewRegistrations is a lightweight gate for the registration endpoint.
// Returns true (fail-open) on any DB error so a transient failure never
// permanently locks out new sign-ups.
func (q *Queries) GetAllowNewRegistrations(ctx context.Context) (bool, error) {
	const query = `SELECT allow_new_registrations FROM platform_config WHERE id = 1`
	var allow bool
	if err := q.db.QueryRow(ctx, query).Scan(&allow); err != nil {
		return true, nil
	}
	return allow, nil
}
