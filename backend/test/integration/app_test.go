//go:build integration

package integration

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/isw2-unileon/MeRenta/backend/internal/handler"
	"github.com/isw2-unileon/MeRenta/backend/internal/model"
	"github.com/isw2-unileon/MeRenta/backend/internal/router"
	"github.com/isw2-unileon/MeRenta/backend/internal/service"
	"github.com/isw2-unileon/MeRenta/backend/internal/sqlcdb"
	"github.com/isw2-unileon/MeRenta/backend/pkg/jwt"
)

const usageRules = "Conducir con permiso vigente. Prohibido fumar, competir o circular fuera de carretera. Respetar límites de velocidad y carga de batería. Devolver limpio, sin daños y con el nivel de carga acordado."

type testApp struct {
	ctx    context.Context
	pool   *pgxpool.Pool
	q      *sqlcdb.Queries
	router *gin.Engine
	jwtMgr *jwt.Manager
}

type apiResponse struct {
	Success bool            `json:"success"`
	Data    json.RawMessage `json:"data"`
	Error   string          `json:"error"`
}

type fakeStorage struct {
	uploaded []string
}

func (s *fakeStorage) Upload(_ context.Context, bucket, path, _ string, _ io.Reader) error {
	s.uploaded = append(s.uploaded, bucket+"/"+path)
	return nil
}

func (s *fakeStorage) SignURL(_ context.Context, bucket, path string, _ int) (string, error) {
	return "https://storage.test/object/sign/" + bucket + "/" + path + "?token=test", nil
}

type fakePayment struct{}

func (fakePayment) CreatePaymentIntent(context.Context, model.CreatePaymentIntentRequest) (model.CreatePaymentIntentResponse, error) {
	return model.CreatePaymentIntentResponse{
		ClientSecret:    "pi_secret_integration",
		PaymentIntentID: "pi_integration",
		AmountEUR:       42,
	}, nil
}

type fakeRefunder struct {
	refunded []string
}

func (r *fakeRefunder) RefundPayment(_ context.Context, paymentIntentID string) error {
	r.refunded = append(r.refunded, paymentIntentID)
	return nil
}

func setupTestApp(t *testing.T) *testApp {
	t.Helper()

	databaseURL := strings.TrimSpace(os.Getenv("MERENTA_TEST_DATABASE_URL"))
	if databaseURL == "" {
		databaseURL = strings.TrimSpace(os.Getenv("TEST_DATABASE_URL"))
	}
	if databaseURL == "" {
		t.Skip("set MERENTA_TEST_DATABASE_URL or TEST_DATABASE_URL to run integration tests")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 45*time.Second)
	t.Cleanup(cancel)

	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		t.Fatalf("connect test database: %v", err)
	}
	t.Cleanup(pool.Close)

	cleanupDB(t, ctx, pool)
	t.Cleanup(func() { cleanupDB(t, context.Background(), pool) })

	gin.SetMode(gin.TestMode)
	q := sqlcdb.New(pool)
	jwtMgr := jwt.NewManager("integration-test-secret-with-32-bytes", "merenta-test", "merenta-web", time.Hour, time.Minute)
	storage := &fakeStorage{}
	refunder := &fakeRefunder{}

	authSvc := service.NewAuthService(q, jwtMgr, storage, "avatar")
	itemSvc := service.NewItemService(q)
	itemImgSvc := service.NewItemImageService(q, storage, "item")
	addrSvc := service.NewAddressService(q)
	favSvc := service.NewFavoriteService(q)
	chatSvc, err := service.NewChatService(q, []byte("12345678901234567890123456789012"))
	if err != nil {
		t.Fatalf("create chat service: %v", err)
	}
	reviewSvc := service.NewReviewService(q)
	bookingSvc := service.NewBookingService(q, refunder)
	adminSvc := service.NewAdminService(q, refunder)
	incidentSvc := service.NewIncidentService(q)
	landingSvc := service.NewLandingService(q)

	r := router.Setup(
		handler.NewAuthHandler(authSvc),
		handler.NewItemHandler(itemSvc),
		handler.NewItemImageHandler(itemImgSvc),
		handler.NewAddressHandler(addrSvc),
		handler.NewFavoriteHandler(favSvc),
		handler.NewChatHandler(chatSvc, handler.NewChatHub(), jwtMgr),
		handler.NewReviewHandler(reviewSvc),
		handler.NewPaymentHandler(fakePayment{}),
		handler.NewBookingHandler(bookingSvc),
		handler.NewIncidentHandler(incidentSvc),
		handler.NewAdminHandler(adminSvc),
		handler.NewLandingHandler(landingSvc),
		jwtMgr,
		"http://localhost:5173",
		pool.Ping,
	)

	return &testApp{ctx: ctx, pool: pool, q: q, router: r, jwtMgr: jwtMgr}
}

func cleanupDB(t *testing.T, ctx context.Context, pool *pgxpool.Pool) {
	t.Helper()

	_, err := pool.Exec(ctx, `
DO $$
DECLARE
  table_names text[];
BEGIN
  SELECT array_agg(format('%I.%I', schemaname, tablename))
  INTO table_names
  FROM pg_tables
  WHERE schemaname = 'public'
    AND tablename = ANY (ARRAY[
      'admin_audit_log',
      'customer_verification',
      'platform_config',
      'incident',
      'review',
      'rental',
      'booking',
      'conversation_deleted',
      'message',
      'conversation',
      'favorite',
      'item_image',
      'item',
      'address',
      'customer'
    ]);

  IF table_names IS NOT NULL THEN
    EXECUTE 'TRUNCATE TABLE ' || array_to_string(table_names, ', ') || ' RESTART IDENTITY CASCADE';
  END IF;
END $$;`)
	if err != nil {
		t.Fatalf("cleanup test database: %v", err)
	}
}

func doJSON(t *testing.T, app *testApp, method, path string, cookie *http.Cookie, body any) (*httptest.ResponseRecorder, apiResponse) {
	t.Helper()

	var reader io.Reader
	if body != nil {
		payload, err := json.Marshal(body)
		if err != nil {
			t.Fatalf("marshal request body: %v", err)
		}
		reader = bytes.NewReader(payload)
	}

	req := httptest.NewRequest(method, path, reader)
	req.Header.Set("Content-Type", "application/json")
	if cookie != nil {
		req.AddCookie(cookie)
	}

	w := httptest.NewRecorder()
	app.router.ServeHTTP(w, req)

	var res apiResponse
	if w.Body.Len() > 0 {
		if err := json.Unmarshal(w.Body.Bytes(), &res); err != nil {
			t.Fatalf("decode response body status=%d body=%s: %v", w.Code, w.Body.String(), err)
		}
	}
	return w, res
}

func requireStatus(t *testing.T, w *httptest.ResponseRecorder, want int) {
	t.Helper()
	if w.Code != want {
		t.Fatalf("status = %d want %d body=%s", w.Code, want, w.Body.String())
	}
}

func decodeData[T any](t *testing.T, res apiResponse) T {
	t.Helper()

	var out T
	if len(res.Data) == 0 {
		t.Fatal("response data is empty")
	}
	if err := json.Unmarshal(res.Data, &out); err != nil {
		t.Fatalf("decode data %s: %v", string(res.Data), err)
	}
	return out
}

func registerViaHTTP(t *testing.T, app *testApp, prefix string) (model.AuthResponse, *http.Cookie) {
	t.Helper()

	email := uniqueEmail(t, prefix)
	w, res := doJSON(t, app, http.MethodPost, "/api/auth/register", nil, map[string]any{
		"first_name": "Integration",
		"last_name":  "User",
		"email":      email,
		"password":   "password123",
	})
	requireStatus(t, w, http.StatusCreated)

	auth := decodeData[model.AuthResponse](t, res)
	cookie := findCookie(t, w, "access_token")
	return auth, cookie
}

func loginViaHTTP(t *testing.T, app *testApp, email string) *http.Cookie {
	t.Helper()

	w, _ := doJSON(t, app, http.MethodPost, "/api/auth/login", nil, map[string]any{
		"email":    email,
		"password": "password123",
	})
	requireStatus(t, w, http.StatusOK)
	return findCookie(t, w, "access_token")
}

func findCookie(t *testing.T, w *httptest.ResponseRecorder, name string) *http.Cookie {
	t.Helper()

	for _, cookie := range w.Result().Cookies() {
		if cookie.Name == name {
			return cookie
		}
	}
	t.Fatalf("cookie %q not found in %v", name, w.Result().Cookies())
	return nil
}

func promoteAdmin(t *testing.T, app *testApp, customerID string) {
	t.Helper()

	if _, err := app.pool.Exec(app.ctx, "UPDATE customer SET user_role = 'admin' WHERE customer_id = $1", customerID); err != nil {
		t.Fatalf("promote admin: %v", err)
	}
}

func uniqueEmail(t *testing.T, prefix string) string {
	t.Helper()

	clean := strings.NewReplacer("/", "-", " ", "-").Replace(t.Name())
	return fmt.Sprintf("%s-%d-%s@example.test", prefix, time.Now().UnixNano(), clean)
}

func createAddress(t *testing.T, app *testApp, cookie *http.Cookie) model.AddressResponse {
	t.Helper()

	w, res := doJSON(t, app, http.MethodPost, "/api/addresses", cookie, map[string]any{
		"street":      "Calle Ancha",
		"number":      "10",
		"city":        "Leon",
		"province":    "Leon",
		"postal_code": "24001",
		"country":     "Spain",
	})
	requireStatus(t, w, http.StatusCreated)
	return decodeData[model.AddressResponse](t, res)
}

func createItem(t *testing.T, app *testApp, cookie *http.Cookie, addressID string) model.ItemResponse {
	t.Helper()

	w, res := doJSON(t, app, http.MethodPost, "/api/items", cookie, map[string]any{
		"address_id":    addressID,
		"category":      "vehicles",
		"title":         "Patinete eléctrico urbano",
		"description":   "Patinete plegable con batería revisada.",
		"usage_rules":   usageRules,
		"condition":     "good",
		"price_per_day": 18.5,
		"deposit":       120,
		"min_days":      1,
		"max_days":      7,
	})
	requireStatus(t, w, http.StatusCreated)
	return decodeData[model.ItemResponse](t, res)
}
