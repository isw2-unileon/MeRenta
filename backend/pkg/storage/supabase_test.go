package storage

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestNormalizeBaseURLAndObjectEndpoint(t *testing.T) {
	t.Parallel()

	if got := normalizeBaseURL(" https://project.supabase.co/storage/v1/ "); got != "https://project.supabase.co" {
		t.Fatalf("normalized = %q", got)
	}

	endpoint, err := objectEndpoint("https://project.supabase.co", "object", "items", "folder/image 1.jpg")
	if err != nil {
		t.Fatalf("objectEndpoint returned error: %v", err)
	}
	if !strings.Contains(endpoint, "/storage/v1/object/items/folder/image%201.jpg") {
		t.Fatalf("endpoint = %q", endpoint)
	}
}

func TestUploadSendsStorageRequest(t *testing.T) {
	t.Parallel()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Fatalf("method = %s", r.Method)
		}
		if r.URL.Path != "/storage/v1/object/items/folder/image.jpg" {
			t.Fatalf("path = %s", r.URL.Path)
		}
		if got := r.Header.Get("Authorization"); got != "Bearer service-key" {
			t.Fatalf("authorization = %q", got)
		}
		if got := r.Header.Get("x-upsert"); got != "false" {
			t.Fatalf("x-upsert = %q", got)
		}
		body, _ := io.ReadAll(r.Body)
		if string(body) != "image-bytes" {
			t.Fatalf("body = %q", body)
		}
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	client := NewSupabaseClient(server.URL+"/storage/v1", "service-key")
	if err := client.Upload(context.Background(), "items", "folder/image.jpg", "image/jpeg", strings.NewReader("image-bytes")); err != nil {
		t.Fatalf("Upload returned error: %v", err)
	}
}

func TestSignURLBuildsAbsoluteStorageURL(t *testing.T) {
	t.Parallel()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/storage/v1/object/sign/items/folder/image.jpg" {
			t.Fatalf("path = %s", r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"signedURL":"/object/sign/items/folder/image.jpg?token=abc"}`))
	}))
	defer server.Close()

	client := NewSupabaseClient(server.URL, "service-key")
	signed, err := client.SignURL(context.Background(), "items", "folder/image.jpg", 60)
	if err != nil {
		t.Fatalf("SignURL returned error: %v", err)
	}
	if signed != server.URL+"/storage/v1/object/sign/items/folder/image.jpg?token=abc" {
		t.Fatalf("signed url = %q", signed)
	}
}

func TestStorageErrorsUseResponsePayload(t *testing.T) {
	t.Parallel()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusBadRequest)
		_, _ = w.Write([]byte(`{"error":"bad object"}`))
	}))
	defer server.Close()

	client := NewSupabaseClient(server.URL, "service-key")
	if err := client.Upload(context.Background(), "items", "x.jpg", "image/jpeg", strings.NewReader("x")); err == nil || !strings.Contains(err.Error(), "bad object") {
		t.Fatalf("expected storage payload error, got %v", err)
	}
}
