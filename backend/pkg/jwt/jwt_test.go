package jwt

import (
	"testing"
	"time"

	"github.com/google/uuid"
)

func TestManagerGenerateAndVerify(t *testing.T) {
	t.Parallel()

	manager := NewManager("test-secret-with-at-least-32-bytes", "merenta", "web", time.Hour, time.Second)
	customerID := uuid.MustParse("11111111-1111-1111-1111-111111111111")

	token, err := manager.Generate(customerID, "diego@example.com", "admin")
	if err != nil {
		t.Fatalf("Generate returned error: %v", err)
	}

	claims, err := manager.Verify(token)
	if err != nil {
		t.Fatalf("Verify returned error: %v", err)
	}
	if claims.CustomerID != customerID || claims.Email != "diego@example.com" || claims.Role != "admin" {
		t.Fatalf("unexpected claims: %+v", claims)
	}
}

func TestManagerVerifyRejectsWrongSecretAndExpiredTokens(t *testing.T) {
	t.Parallel()

	customerID := uuid.MustParse("22222222-2222-2222-2222-222222222222")
	manager := NewManager("test-secret-with-at-least-32-bytes", "merenta", "web", time.Hour, 0)
	token, err := manager.Generate(customerID, "laura@example.com", "customer")
	if err != nil {
		t.Fatalf("Generate returned error: %v", err)
	}

	wrongSecret := NewManager("different-secret-with-32-bytes!!", "merenta", "web", time.Hour, 0)
	if _, err := wrongSecret.Verify(token); err == nil {
		t.Fatal("expected wrong secret to fail verification")
	}

	expired := NewManager("test-secret-with-at-least-32-bytes", "merenta", "web", -time.Hour, 0)
	expiredToken, err := expired.Generate(customerID, "laura@example.com", "customer")
	if err != nil {
		t.Fatalf("Generate expired token returned error: %v", err)
	}
	if _, err := expired.Verify(expiredToken); err == nil {
		t.Fatal("expected expired token to fail verification")
	}
}
