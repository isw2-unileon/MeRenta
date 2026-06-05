package service

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/isw2-unileon/MeRenta/backend/internal/model"
	"github.com/isw2-unileon/MeRenta/backend/internal/sqlcdb"
	"github.com/isw2-unileon/MeRenta/backend/pkg/hash"
	"github.com/isw2-unileon/MeRenta/backend/pkg/jwt"
)

type authQuerierStub struct {
	allowNewRegistrations bool
	emailExists           bool
	customer              sqlcdb.Customer
	customerByID          sqlcdb.GetCustomerByIDRow
	suspendedUntil        pgtype.Timestamptz
	verificationStatus    sqlcdb.VerificationStatus
	updateEmailArg        sqlcdb.UpdateCustomerEmailParams
}

func (s *authQuerierStub) CreateCustomer(_ context.Context, arg sqlcdb.CreateCustomerParams) (sqlcdb.CreateCustomerRow, error) {
	return sqlcdb.CreateCustomerRow{
		CustomerID:       uuid.MustParse("11111111-1111-1111-1111-111111111111"),
		FirstName:        arg.FirstName,
		LastName:         arg.LastName,
		Email:            arg.Email,
		Phone:            arg.Phone,
		AvatarUrl:        arg.AvatarUrl,
		RegistrationDate: pgtype.Timestamptz{Time: time.Date(2026, 6, 1, 12, 0, 0, 0, time.UTC), Valid: true},
		AccountStatus:    sqlcdb.AccountStatusActive,
		UserRole:         arg.UserRole,
	}, nil
}

func (s *authQuerierStub) DeleteCustomerAccountData(context.Context, uuid.UUID) error {
	return nil
}

func (s *authQuerierStub) ExistsCustomerByEmail(context.Context, string) (bool, error) {
	return s.emailExists, nil
}

func (s *authQuerierStub) GetCustomerByEmail(context.Context, string) (sqlcdb.Customer, error) {
	if s.customer.CustomerID == uuid.Nil {
		return sqlcdb.Customer{}, pgx.ErrNoRows
	}
	return s.customer, nil
}

func (s *authQuerierStub) GetCustomerByID(context.Context, uuid.UUID) (sqlcdb.GetCustomerByIDRow, error) {
	if s.customerByID.CustomerID == uuid.Nil {
		return sqlcdb.GetCustomerByIDRow{}, pgx.ErrNoRows
	}
	return s.customerByID, nil
}

func (s *authQuerierStub) UpdateCustomerEmail(
	_ context.Context,
	arg sqlcdb.UpdateCustomerEmailParams,
) (sqlcdb.UpdateCustomerEmailRow, error) {
	s.updateEmailArg = arg
	return sqlcdb.UpdateCustomerEmailRow(arg), nil
}

func (s *authQuerierStub) UpdateCustomerPassword(context.Context, sqlcdb.UpdateCustomerPasswordParams) error {
	return nil
}

func (s *authQuerierStub) UpdateCustomerProfile(
	context.Context,
	sqlcdb.UpdateCustomerProfileParams,
) (sqlcdb.UpdateCustomerProfileRow, error) {
	return sqlcdb.UpdateCustomerProfileRow{}, nil
}

func (s *authQuerierStub) GetCustomerSuspendedUntil(context.Context, uuid.UUID) (pgtype.Timestamptz, error) {
	return s.suspendedUntil, nil
}

func (s *authQuerierStub) EnsureCustomerVerificationSchema(context.Context) error {
	return nil
}

func (s *authQuerierStub) GetCustomerVerificationStatus(context.Context, uuid.UUID) (sqlcdb.VerificationStatus, error) {
	if s.verificationStatus == "" {
		return sqlcdb.VerificationStatusNone, nil
	}
	return s.verificationStatus, nil
}

func (s *authQuerierStub) RequestCustomerVerification(context.Context, uuid.UUID) (sqlcdb.VerificationStatus, error) {
	return sqlcdb.VerificationStatusPending, nil
}

func (s *authQuerierStub) GetAllowNewRegistrations(context.Context) (bool, error) {
	return s.allowNewRegistrations, nil
}

func TestAuthServiceRegisterGuardsAndSuccess(t *testing.T) {
	t.Parallel()

	req := model.RegisterRequest{
		FirstName: "Lucia",
		LastName:  "Perez",
		Email:     "lucia@example.com",
		Password:  "secret123",
		Phone:     "600000000",
	}

	for _, tt := range []struct {
		name string
		stub *authQuerierStub
		want error
	}{
		{name: "registrations disabled", stub: &authQuerierStub{}, want: ErrRegistrationDisabled},
		{name: "email exists", stub: &authQuerierStub{allowNewRegistrations: true, emailExists: true}, want: ErrEmailExists},
	} {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			svc := NewAuthService(tt.stub, testJWTManager(), nil, "")
			if _, err := svc.Register(context.Background(), req); !errors.Is(err, tt.want) {
				t.Fatalf("Register error = %v, want %v", err, tt.want)
			}
		})
	}

	svc := NewAuthService(&authQuerierStub{allowNewRegistrations: true}, testJWTManager(), nil, "")
	res, err := svc.Register(context.Background(), req)
	if err != nil {
		t.Fatalf("Register returned error: %v", err)
	}
	if res.Token == "" || res.Customer.Email != req.Email || res.Customer.Phone != req.Phone {
		t.Fatalf("response = %+v", res)
	}
}

func TestAuthServiceLoginMapsAccountStates(t *testing.T) {
	t.Parallel()

	customerID := uuid.MustParse("11111111-1111-1111-1111-111111111111")
	passwordHash, err := hash.Password("secret123")
	if err != nil {
		t.Fatalf("hash password: %v", err)
	}
	suspendedUntil := time.Date(2026, 7, 1, 0, 0, 0, 0, time.UTC)

	tests := []struct {
		name   string
		status sqlcdb.AccountStatus
		want   error
	}{
		{name: "banned", status: sqlcdb.AccountStatusBanned, want: ErrAccountBanned},
		{name: "inactive", status: "inactive", want: ErrAccountNotActive},
		{name: "suspended", status: sqlcdb.AccountStatusSuspended, want: &ErrAccountSuspended{}},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			stub := &authQuerierStub{
				customer:       testCustomer(customerID, "lucia@example.com", passwordHash, tt.status),
				suspendedUntil: pgtype.Timestamptz{Time: suspendedUntil, Valid: true},
			}
			svc := NewAuthService(stub, testJWTManager(), nil, "")

			_, err := svc.Login(context.Background(), model.LoginRequest{Email: "lucia@example.com", Password: "secret123"})
			if tt.status == sqlcdb.AccountStatusSuspended {
				var suspErr *ErrAccountSuspended
				if !errors.As(err, &suspErr) || suspErr.Until == nil || !suspErr.Until.Equal(suspendedUntil) {
					t.Fatalf("suspended error = %#v", err)
				}
				return
			}
			if !errors.Is(err, tt.want) {
				t.Fatalf("Login error = %v, want %v", err, tt.want)
			}
		})
	}

	stub := &authQuerierStub{customer: testCustomer(customerID, "lucia@example.com", passwordHash, sqlcdb.AccountStatusActive)}
	svc := NewAuthService(stub, testJWTManager(), nil, "")
	res, err := svc.Login(context.Background(), model.LoginRequest{Email: "lucia@example.com", Password: "secret123"})
	if err != nil {
		t.Fatalf("Login returned error: %v", err)
	}
	if res.Token == "" || res.Customer.CustomerID != customerID.String() {
		t.Fatalf("response = %+v", res)
	}

	if _, err := svc.Login(context.Background(), model.LoginRequest{Email: "lucia@example.com", Password: "bad"}); !errors.Is(err, ErrInvalidCredentials) {
		t.Fatalf("bad password error = %v", err)
	}
}

func TestAuthServiceUpdateEmailValidation(t *testing.T) {
	t.Parallel()

	customerID := uuid.MustParse("11111111-1111-1111-1111-111111111111")
	stub := &authQuerierStub{
		customerByID: testCustomerByID(customerID, "old@example.com", sqlcdb.AccountStatusActive),
	}
	svc := NewAuthService(stub, testJWTManager(), nil, "")

	if _, err := svc.UpdateEmail(context.Background(), customerID, model.UpdateEmailRequest{
		Email: "new@example.com", ConfirmEmail: "other@example.com",
	}); !errors.Is(err, ErrEmailMismatch) {
		t.Fatalf("mismatch error = %v", err)
	}

	stub.emailExists = true
	if _, err := svc.UpdateEmail(context.Background(), customerID, model.UpdateEmailRequest{
		Email: "new@example.com", ConfirmEmail: "new@example.com",
	}); !errors.Is(err, ErrEmailExists) {
		t.Fatalf("duplicate error = %v", err)
	}

	stub.emailExists = false
	res, err := svc.UpdateEmail(context.Background(), customerID, model.UpdateEmailRequest{
		Email: "new@example.com", ConfirmEmail: "NEW@example.com",
	})
	if err != nil {
		t.Fatalf("UpdateEmail returned error: %v", err)
	}
	if stub.updateEmailArg.Email != "new@example.com" || res.Email != "old@example.com" {
		t.Fatalf("update arg = %+v response = %+v", stub.updateEmailArg, res)
	}
}

func testJWTManager() *jwt.Manager {
	return jwt.NewManager("test-secret", "issuer", "audience", time.Hour, time.Minute)
}

func testCustomer(id uuid.UUID, email, passwordHash string, status sqlcdb.AccountStatus) sqlcdb.Customer {
	return sqlcdb.Customer{
		CustomerID:       id,
		FirstName:        "Lucia",
		LastName:         "Perez",
		Email:            email,
		Phone:            pgtype.Text{String: "600000000", Valid: true},
		PasswordHash:     passwordHash,
		RegistrationDate: pgtype.Timestamptz{Time: time.Date(2026, 6, 1, 12, 0, 0, 0, time.UTC), Valid: true},
		AccountStatus:    status,
		UserRole:         sqlcdb.UserRoleUser,
	}
}

func testCustomerByID(id uuid.UUID, email string, status sqlcdb.AccountStatus) sqlcdb.GetCustomerByIDRow {
	return sqlcdb.GetCustomerByIDRow{
		CustomerID:       id,
		FirstName:        "Lucia",
		LastName:         "Perez",
		Email:            email,
		Phone:            pgtype.Text{String: "600000000", Valid: true},
		RegistrationDate: pgtype.Timestamptz{Time: time.Date(2026, 6, 1, 12, 0, 0, 0, time.UTC), Valid: true},
		AccountStatus:    status,
		UserRole:         sqlcdb.UserRoleUser,
	}
}
