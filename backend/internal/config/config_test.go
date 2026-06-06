package config

import (
	"encoding/base64"
	"testing"
	"time"
)

func TestDurationParsers(t *testing.T) {
	t.Parallel()

	if got := mustParsePositiveDuration("TEST_DURATION", "15m"); got != 15*time.Minute {
		t.Fatalf("positive duration = %v", got)
	}
	if got := mustParseNonNegativeDuration("TEST_LEEWAY", "0s"); got != 0 {
		t.Fatalf("non-negative duration = %v", got)
	}
}

func TestEnvironmentHelpers(t *testing.T) {
	t.Setenv("MERENTA_TEST_ENV", "configured")

	if got := getEnv("MERENTA_TEST_ENV", "fallback"); got != "configured" {
		t.Fatalf("getEnv configured = %q", got)
	}
	if got := getEnv("MERENTA_TEST_MISSING", "fallback"); got != "fallback" {
		t.Fatalf("getEnv fallback = %q", got)
	}
	if !isProductionMode("prod") || !isProductionMode(" release ") {
		t.Fatal("expected prod and release to be production modes")
	}
	if isProductionMode("debug") {
		t.Fatal("debug should not be production mode")
	}
}

func TestGetMessageEncryptionKey(t *testing.T) {
	fallback := []byte("0123456789abcdef0123456789abcdef")
	t.Setenv("MESSAGE_ENCRYPTION_KEY", "")
	if got := getMessageEncryptionKey(fallback); string(got) != string(fallback) {
		t.Fatalf("fallback key = %q", got)
	}

	explicit := []byte("abcdef0123456789abcdef0123456789")
	t.Setenv("MESSAGE_ENCRYPTION_KEY", base64.StdEncoding.EncodeToString(explicit))
	if got := getMessageEncryptionKey(fallback); string(got) != string(explicit) {
		t.Fatalf("explicit key = %q", got)
	}
}
