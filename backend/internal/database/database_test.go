package database

import (
	"context"
	"testing"
)

func TestConnectRejectsEmptyDatabaseURL(t *testing.T) {
	t.Parallel()

	if _, err := Connect(context.Background(), ""); err == nil {
		t.Fatal("expected empty database URL to fail")
	}
}
