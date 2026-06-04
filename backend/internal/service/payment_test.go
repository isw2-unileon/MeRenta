package service

import "testing"

func TestRentalDays(t *testing.T) {
	t.Parallel()

	days, err := rentalDays("2026-06-01", "2026-06-04")
	if err != nil {
		t.Fatalf("rentalDays returned error: %v", err)
	}
	if days != 3 {
		t.Fatalf("days = %d", days)
	}
}

func TestRentalDaysRejectsInvalidDates(t *testing.T) {
	t.Parallel()

	if _, err := rentalDays("bad", "2026-06-04"); err == nil {
		t.Fatal("expected invalid start date to fail")
	}
	if _, err := rentalDays("2026-06-01", "bad"); err == nil {
		t.Fatal("expected invalid end date to fail")
	}
}
