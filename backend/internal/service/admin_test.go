package service

import (
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/isw2-unileon/MeRenta/backend/internal/sqlcdb"
)

func TestToAdminRowIncludesAvatarURL(t *testing.T) {
	t.Parallel()

	id := uuid.MustParse("44444444-4444-4444-4444-444444444444")
	row := toAdminRow(
		id,
		"Diego",
		"Perez",
		"diego@example.com",
		pgtype.Text{String: "600000000", Valid: true},
		pgtype.Text{String: "https://cdn.example.com/avatar.jpg", Valid: true},
		pgtype.Timestamptz{Time: time.Date(2026, 6, 1, 12, 0, 0, 0, time.UTC), Valid: true},
		sqlcdb.AccountStatusActive,
		sqlcdb.UserRoleAdmin,
	)

	if row.CustomerID != id {
		t.Fatalf("CustomerID = %s", row.CustomerID)
	}
	if row.AvatarURL != "https://cdn.example.com/avatar.jpg" {
		t.Fatalf("AvatarURL = %q", row.AvatarURL)
	}
	if row.Phone != "600000000" {
		t.Fatalf("Phone = %q", row.Phone)
	}
	if row.RegistrationDate == "" {
		t.Fatal("RegistrationDate should be formatted")
	}
}

func TestNullableAdminHelpers(t *testing.T) {
	t.Parallel()

	if got := nullableStr(pgtype.Text{}); got != "" {
		t.Fatalf("nullableStr invalid = %q", got)
	}
	if got := nullableStr(pgtype.Text{String: "hola", Valid: true}); got != "hola" {
		t.Fatalf("nullableStr valid = %q", got)
	}
	if got := nullableTime(pgtype.Timestamptz{}); got != "" {
		t.Fatalf("nullableTime invalid = %q", got)
	}
}
