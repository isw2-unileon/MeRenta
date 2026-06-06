package service

import (
	"errors"
	"math"
	"testing"

	"github.com/jackc/pgx/v5/pgconn"

	"github.com/isw2-unileon/MeRenta/backend/internal/model"
	"github.com/isw2-unileon/MeRenta/backend/internal/sqlcdb"
)

func TestItemValidationHelpers(t *testing.T) {
	t.Parallel()

	if !isValidCategory(string(sqlcdb.CategoryEnumTools)) {
		t.Fatal("tools should be a valid category")
	}
	if isValidCategory("invalid") {
		t.Fatal("invalid category should be rejected")
	}
	if !isValidCondition(string(sqlcdb.ItemConditionGood)) {
		t.Fatal("good should be a valid condition")
	}
	if isValidCondition("mint") {
		t.Fatal("unknown condition should be rejected")
	}
	if !isValidEditableStatus(string(sqlcdb.ItemStatusAvailable)) || !isValidEditableStatus("withdrawn") {
		t.Fatal("expected available and withdrawn to be editable")
	}
	if isValidEditableStatus("rented") {
		t.Fatal("rented should not be editable from item editing")
	}
}

func TestNumericHelpers(t *testing.T) {
	t.Parallel()

	numeric, err := float64ToNumeric(12.345)
	if err != nil {
		t.Fatalf("float64ToNumeric returned error: %v", err)
	}
	got, err := numericToFloat64(numeric)
	if err != nil {
		t.Fatalf("numericToFloat64 returned error: %v", err)
	}
	if got != 12.35 {
		t.Fatalf("rounded numeric = %v", got)
	}

	if optional, err := optionalFloat64ToNumeric(nil); err != nil || optional.Valid {
		t.Fatalf("nil optional numeric = %+v, %v", optional, err)
	}

	maxDays := 7
	int4, err := optionalIntToInt4(&maxDays)
	if err != nil {
		t.Fatalf("optionalIntToInt4 returned error: %v", err)
	}
	if !int4.Valid || int4.Int32 != 7 {
		t.Fatalf("int4 = %+v", int4)
	}
	if _, err := intToInt32(math.MaxInt64); err == nil {
		t.Fatal("expected int32 overflow to fail")
	}
}

func TestPrepareUpdateItemValuesValidation(t *testing.T) {
	t.Parallel()

	req := model.UpdateItemRequest{
		AddressID:   "33333333-3333-3333-3333-333333333333",
		Category:    string(sqlcdb.CategoryEnumTools),
		Condition:   string(sqlcdb.ItemConditionGood),
		PricePerDay: 5,
		ItemStatus:  string(sqlcdb.ItemStatusAvailable),
	}

	values, err := prepareUpdateItemValues(req)
	if err != nil {
		t.Fatalf("prepareUpdateItemValues returned error: %v", err)
	}
	if values.minDays != 1 {
		t.Fatalf("default min days = %d", values.minDays)
	}

	req.ItemStatus = "rented"
	if _, err := prepareUpdateItemValues(req); !errors.Is(err, ErrInvalidItemStatus) {
		t.Fatalf("expected invalid item status, got %v", err)
	}

	req.ItemStatus = string(sqlcdb.ItemStatusAvailable)
	req.MaxDays = ptrInt(0)
	if _, err := prepareUpdateItemValues(req); !errors.Is(err, ErrInvalidRentalPeriod) {
		t.Fatalf("expected invalid rental period, got %v", err)
	}
}

func TestPostgresErrorClassifiers(t *testing.T) {
	t.Parallel()

	if !isForeignKeyViolation(&pgconn.PgError{Code: "23503"}) {
		t.Fatal("expected FK violation to be detected")
	}
	if !isInvalidTextRepresentation(&pgconn.PgError{Code: "22P02"}) {
		t.Fatal("expected invalid text representation to be detected")
	}
	if !isUndefinedTableNamed(&pgconn.PgError{Code: "42P01", Message: `relation "item_image" does not exist`}, "item_image") {
		t.Fatal("expected undefined item_image table to be detected")
	}
}

func TestToInt32CapsLargeValues(t *testing.T) {
	t.Parallel()

	if got := toInt32(math.MaxInt64); got != math.MaxInt32 {
		t.Fatalf("toInt32(max) = %d", got)
	}
	if got := toInt32(42); got != 42 {
		t.Fatalf("toInt32(42) = %d", got)
	}
}

func ptrInt(v int) *int {
	return &v
}
