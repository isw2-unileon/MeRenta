// Package storage provides a minimal Supabase Storage REST client
// for server-side file upload and signed-URL generation.
package storage

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
)

// Client is the interface the rest of the application depends on.
// Keeping it narrow makes it easy to stub in tests.
type Client interface {
	Upload(ctx context.Context, bucket, path, contentType string, body io.Reader) error
	SignURL(ctx context.Context, bucket, path string, expiresIn int) (string, error)
}

// SupabaseClient is a minimal REST client for Supabase Storage operations.
// It authenticates as a service role so it can access private buckets.
type SupabaseClient struct {
	baseURL    string
	serviceKey string
	httpClient *http.Client
}

// NewSupabaseClient returns a SupabaseClient configured for the given project.
//
// baseURL    — https://<project>.supabase.co
// serviceKey — the service role secret key (never exposed to clients)
func NewSupabaseClient(baseURL, serviceKey string) *SupabaseClient {
	return &SupabaseClient{
		baseURL:    normalizeBaseURL(baseURL),
		serviceKey: serviceKey,
		httpClient: &http.Client{},
	}
}

// Upload stores body at bucket/path using the service role key.
// contentType must be a valid MIME type (e.g. "image/jpeg").
func (c *SupabaseClient) Upload(
	ctx context.Context,
	bucket, path, contentType string,
	body io.Reader,
) error {
	endpoint, err := objectEndpoint(c.baseURL, "object", bucket, path)
	if err != nil {
		return fmt.Errorf("storage upload: build endpoint: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, body)
	if err != nil {
		return fmt.Errorf("storage upload: build request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+c.serviceKey)
	req.Header.Set("apikey", c.serviceKey)
	req.Header.Set("Content-Type", contentType)
	req.Header.Set("x-upsert", "false")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("storage upload: %w", err)
	}
	defer resp.Body.Close() //nolint:errcheck

	if resp.StatusCode >= http.StatusMultipleChoices {
		return c.decodeStorageError("upload", resp)
	}

	return nil
}

// signURLRequest is the payload for the Supabase sign endpoint.
type signURLRequest struct {
	ExpiresIn int `json:"expiresIn"`
}

// signURLResponse is the Supabase Storage sign endpoint response shape.
type signURLResponse struct {
	SignedURL string `json:"signedURL"`
}

// SignURL generates a pre-signed URL for the object at bucket/path,
// valid for expiresIn seconds.
func (c *SupabaseClient) SignURL(
	ctx context.Context,
	bucket, path string,
	expiresIn int,
) (string, error) {
	endpoint, err := objectEndpoint(c.baseURL, "object/sign", bucket, path)
	if err != nil {
		return "", fmt.Errorf("storage sign: build endpoint: %w", err)
	}

	body, err := json.Marshal(signURLRequest{ExpiresIn: expiresIn})
	if err != nil {
		return "", fmt.Errorf("storage sign: marshal: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return "", fmt.Errorf("storage sign: build request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+c.serviceKey)
	req.Header.Set("apikey", c.serviceKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("storage sign: %w", err)
	}
	defer resp.Body.Close() //nolint:errcheck

	if resp.StatusCode >= http.StatusMultipleChoices {
		return "", c.decodeStorageError("sign", resp)
	}

	var result signURLResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", fmt.Errorf("storage sign: decode response: %w", err)
	}

	// Supabase returns a relative path — prepend the base URL.
	if len(result.SignedURL) > 0 && result.SignedURL[0] == '/' {
		return c.baseURL + result.SignedURL, nil
	}

	return result.SignedURL, nil
}

func normalizeBaseURL(baseURL string) string {
	normalized := strings.TrimSpace(baseURL)
	normalized = strings.TrimRight(normalized, "/")
	normalized = strings.TrimSuffix(normalized, "/storage/v1")
	return strings.TrimRight(normalized, "/")
}

func objectEndpoint(baseURL, operation, bucket, objectPath string) (string, error) {
	endpoint, err := url.JoinPath(baseURL, "storage/v1", operation, bucket, objectPath)
	if err != nil {
		return "", err
	}

	return endpoint, nil
}

// storageErrorBody is the error envelope returned by the Supabase Storage API.
type storageErrorBody struct {
	Error   string `json:"error"`
	Message string `json:"message"`
}

// decodeStorageError reads the response body and returns a descriptive error.
func (c *SupabaseClient) decodeStorageError(op string, resp *http.Response) error {
	var payload storageErrorBody
	_ = json.NewDecoder(resp.Body).Decode(&payload)

	if payload.Error != "" {
		return fmt.Errorf("storage %s: %s", op, payload.Error)
	}

	if payload.Message != "" {
		return fmt.Errorf("storage %s: %s", op, payload.Message)
	}

	return fmt.Errorf("storage %s: status %d", op, resp.StatusCode)
}
