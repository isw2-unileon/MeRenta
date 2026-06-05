// Package service contains business logic for the API.
package service

import (
	"context"
	"errors"
	"fmt"
	"mime/multipart"
	"path/filepath"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/isw2-unileon/MeRenta/backend/internal/model"
	"github.com/isw2-unileon/MeRenta/backend/internal/sqlcdb"
	"github.com/isw2-unileon/MeRenta/backend/pkg/hash"
	"github.com/isw2-unileon/MeRenta/backend/pkg/jwt"
	"github.com/isw2-unileon/MeRenta/backend/pkg/storage"
)

var (
	// ErrEmailExists indicates the email is already registered.
	ErrEmailExists = errors.New("email is already registered")
	// ErrInvalidCredentials indicates the email or password is incorrect.
	ErrInvalidCredentials = errors.New("invalid credentials")
	// ErrAccountNotActive indicates the account is not active.
	ErrAccountNotActive = errors.New("account is not active")
	// ErrAccountBanned indicates the account has been permanently banned.
	ErrAccountBanned = errors.New("account banned")
	// ErrCustomerNotFound indicates no customer exists with the given ID.
	ErrCustomerNotFound = errors.New("customer not found")
	// ErrEmailMismatch indicates the email confirmation does not match.
	ErrEmailMismatch = errors.New("email confirmation does not match")
	// ErrPasswordMismatch indicates the password confirmation does not match.
	ErrPasswordMismatch = errors.New("password confirmation does not match")
	// ErrRegistrationDisabled is returned when an admin has closed new sign-ups.
	ErrRegistrationDisabled = errors.New("new registrations are currently disabled")
)

// ErrAccountSuspended is returned when the account is temporarily suspended.
// It carries the optional suspension end time.
type ErrAccountSuspended struct {
	Until *time.Time
}

// Error implements the error interface.
func (e *ErrAccountSuspended) Error() string {
	if e.Until != nil {
		return "account suspended until " + e.Until.Format(time.RFC3339)
	}
	return "account is suspended"
}

// authQuerier extends sqlcdb.Querier with handwritten customer ext queries.
type authQuerier interface {
	CreateCustomer(ctx context.Context, arg sqlcdb.CreateCustomerParams) (sqlcdb.CreateCustomerRow, error)
	DeleteCustomerAccountData(ctx context.Context, customerID uuid.UUID) error
	ExistsCustomerByEmail(ctx context.Context, email string) (bool, error)
	GetCustomerByEmail(ctx context.Context, email string) (sqlcdb.Customer, error)
	GetCustomerByID(ctx context.Context, customerID uuid.UUID) (sqlcdb.GetCustomerByIDRow, error)
	UpdateCustomerEmail(ctx context.Context, arg sqlcdb.UpdateCustomerEmailParams) (sqlcdb.UpdateCustomerEmailRow, error)
	UpdateCustomerPassword(ctx context.Context, arg sqlcdb.UpdateCustomerPasswordParams) error
	UpdateCustomerProfile(ctx context.Context, arg sqlcdb.UpdateCustomerProfileParams) (sqlcdb.UpdateCustomerProfileRow, error)
	GetCustomerSuspendedUntil(ctx context.Context, customerID uuid.UUID) (pgtype.Timestamptz, error)
	EnsureCustomerVerificationSchema(ctx context.Context) error
	GetCustomerVerificationStatus(ctx context.Context, customerID uuid.UUID) (sqlcdb.VerificationStatus, error)
	RequestCustomerVerification(ctx context.Context, customerID uuid.UUID) (sqlcdb.VerificationStatus, error)
	// GetAllowNewRegistrations returns the platform flag that gates new sign-ups.
	GetAllowNewRegistrations(ctx context.Context) (bool, error)
}

// AuthService handles authentication use cases.
type AuthService struct {
	q      authQuerier
	jwt    *jwt.Manager
	st     storage.Client
	bucket string
}

// NewAuthService creates an AuthService with its dependencies.
func NewAuthService(q authQuerier, jwt *jwt.Manager, storageClient storage.Client, avatarBucket string) *AuthService {
	return &AuthService{q: q, jwt: jwt, st: storageClient, bucket: avatarBucket}
}

// Register creates a new customer account and returns an auth response.
// Returns ErrRegistrationDisabled when an admin has closed new sign-ups.
func (s *AuthService) Register(ctx context.Context, req model.RegisterRequest) (*model.AuthResponse, error) {
	if allowed, checkErr := s.q.GetAllowNewRegistrations(ctx); checkErr == nil && !allowed {
		return nil, ErrRegistrationDisabled
	}

	exists, err := s.q.ExistsCustomerByEmail(ctx, req.Email)
	if err != nil {
		return nil, err
	}
	if exists {
		return nil, ErrEmailExists
	}

	hashed, err := hash.Password(req.Password)
	if err != nil {
		return nil, err
	}

	phone := pgtype.Text{}
	if req.Phone != "" {
		phone = pgtype.Text{String: req.Phone, Valid: true}
	}

	c, err := s.q.CreateCustomer(ctx, sqlcdb.CreateCustomerParams{
		FirstName:        req.FirstName,
		LastName:         req.LastName,
		Email:            req.Email,
		Phone:            phone,
		PasswordHash:     hashed,
		UserRole:         sqlcdb.UserRoleUser,
		AvatarUrl:        pgtype.Text{},
		StripeCustomerID: pgtype.Text{},
	})
	if err != nil {
		if isUniqueViolation(err) {
			return nil, ErrEmailExists
		}
		return nil, err
	}

	token, err := s.jwt.Generate(c.CustomerID, c.Email, string(c.UserRole))
	if err != nil {
		return nil, err
	}

	return &model.AuthResponse{
		Token:    token,
		Customer: toCustomerResponse(c),
	}, nil
}

// Login verifies credentials and returns a new auth response.
func (s *AuthService) Login(ctx context.Context, req model.LoginRequest) (*model.AuthResponse, error) {
	c, err := s.q.GetCustomerByEmail(ctx, req.Email)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrInvalidCredentials
		}
		return nil, err
	}

	if !hash.Check(req.Password, c.PasswordHash) {
		return nil, ErrInvalidCredentials
	}

	switch c.AccountStatus {
	case sqlcdb.AccountStatusActive:
		// allowed through
	case sqlcdb.AccountStatusBanned:
		return nil, ErrAccountBanned
	case sqlcdb.AccountStatusSuspended:
		return nil, s.buildSuspendedError(ctx, c.CustomerID)
	default:
		return nil, ErrAccountNotActive
	}

	token, err := s.jwt.Generate(c.CustomerID, c.Email, string(c.UserRole))
	if err != nil {
		return nil, err
	}

	return &model.AuthResponse{
		Token: token,
		Customer: buildCustomerResponse(
			c.CustomerID, c.FirstName, c.LastName, c.Email,
			c.Phone, c.AvatarUrl, c.RegistrationDate,
			c.AccountStatus, c.UserRole,
			getVerificationStatusOrDefault(ctx, s.q, c.CustomerID),
		),
	}, nil
}

// buildCustomerResponse maps the customer columns shared across the various
// sqlc row types into the API response model.
func buildCustomerResponse(
	customerID uuid.UUID,
	firstName, lastName, email string,
	phone, avatarURL pgtype.Text,
	registrationDate pgtype.Timestamptz,
	accountStatus sqlcdb.AccountStatus,
	userRole sqlcdb.UserRole,
	verificationStatus sqlcdb.VerificationStatus,
) model.CustomerResponse {
	return model.CustomerResponse{
		CustomerID:         customerID.String(),
		FirstName:          firstName,
		LastName:           lastName,
		Email:              email,
		Phone:              phone.String,
		AvatarURL:          avatarURL.String,
		RegistrationDate:   registrationDate.Time,
		AccountStatus:      string(accountStatus),
		UserRole:           string(userRole),
		VerificationStatus: string(verificationStatus),
	}
}

// toCustomerResponse maps a CreateCustomer row into a response model.
func toCustomerResponse(c sqlcdb.CreateCustomerRow) model.CustomerResponse {
	return buildCustomerResponse(
		c.CustomerID, c.FirstName, c.LastName, c.Email,
		c.Phone, c.AvatarUrl, c.RegistrationDate,
		c.AccountStatus, c.UserRole, sqlcdb.VerificationStatusNone,
	)
}

// GetCustomerByID fetches a customer profile by its ID.
// For suspended accounts the response also includes SuspendedUntil.
func (s *AuthService) GetCustomerByID(ctx context.Context, id uuid.UUID) (*model.CustomerResponse, error) {
	c, err := s.q.GetCustomerByID(ctx, id)
	if err != nil {
		return nil, err
	}
	resp := buildCustomerResponse(
		c.CustomerID, c.FirstName, c.LastName, c.Email,
		c.Phone, c.AvatarUrl, c.RegistrationDate,
		c.AccountStatus, c.UserRole,
		getVerificationStatusOrDefault(ctx, s.q, id),
	)
	if c.AccountStatus == sqlcdb.AccountStatusSuspended {
		if t, tErr := s.q.GetCustomerSuspendedUntil(ctx, id); tErr == nil && t.Valid {
			resp.SuspendedUntil = &t.Time
		}
	}
	return &resp, nil
}

// buildSuspendedError fetches the suspension end date and wraps it in ErrAccountSuspended.
func (s *AuthService) buildSuspendedError(ctx context.Context, id uuid.UUID) error {
	suspErr := &ErrAccountSuspended{}
	if t, err := s.q.GetCustomerSuspendedUntil(ctx, id); err == nil && t.Valid {
		suspErr.Until = &t.Time
	}
	return suspErr
}

// UpdateProfile updates editable profile fields for a customer.
func (s *AuthService) UpdateProfile(ctx context.Context, id uuid.UUID, req model.UpdateProfileRequest) (*model.CustomerResponse, error) {
	phone := pgtype.Text{}
	if req.Phone != nil && *req.Phone != "" {
		phone = pgtype.Text{String: *req.Phone, Valid: true}
	}

	avatarURL := pgtype.Text{}
	if req.AvatarURL != nil && *req.AvatarURL != "" {
		avatarURL = pgtype.Text{String: *req.AvatarURL, Valid: true}
	}

	c, err := s.q.UpdateCustomerProfile(ctx, sqlcdb.UpdateCustomerProfileParams{
		CustomerID: id,
		FirstName:  req.FirstName,
		LastName:   req.LastName,
		Phone:      phone,
		AvatarUrl:  avatarURL,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrCustomerNotFound
		}
		return nil, err
	}

	resp := buildCustomerResponse(
		c.CustomerID, c.FirstName, c.LastName, c.Email,
		c.Phone, c.AvatarUrl, c.RegistrationDate,
		c.AccountStatus, c.UserRole,
		getVerificationStatusOrDefault(ctx, s.q, id),
	)
	return &resp, nil
}

// UpdateEmail changes the customer's email after checking uniqueness.
func (s *AuthService) UpdateEmail(ctx context.Context, id uuid.UUID, req model.UpdateEmailRequest) (*model.CustomerResponse, error) {
	email := strings.TrimSpace(req.Email)
	confirmEmail := strings.TrimSpace(req.ConfirmEmail)
	if !strings.EqualFold(email, confirmEmail) {
		return nil, ErrEmailMismatch
	}

	current, err := s.q.GetCustomerByID(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrCustomerNotFound
		}
		return nil, err
	}

	if strings.EqualFold(current.Email, email) {
		resp := buildCustomerResponse(
			current.CustomerID, current.FirstName, current.LastName, current.Email,
			current.Phone, current.AvatarUrl, current.RegistrationDate,
			current.AccountStatus, current.UserRole,
			getVerificationStatusOrDefault(ctx, s.q, id),
		)
		return &resp, nil
	}

	exists, err := s.q.ExistsCustomerByEmail(ctx, email)
	if err != nil {
		return nil, err
	}
	if exists {
		return nil, ErrEmailExists
	}

	if _, err := s.q.UpdateCustomerEmail(ctx, sqlcdb.UpdateCustomerEmailParams{
		CustomerID: id,
		Email:      email,
	}); err != nil {
		if isUniqueViolation(err) {
			return nil, ErrEmailExists
		}
		return nil, err
	}

	updated, err := s.q.GetCustomerByID(ctx, id)
	if err != nil {
		return nil, err
	}

	resp := buildCustomerResponse(
		updated.CustomerID, updated.FirstName, updated.LastName, updated.Email,
		updated.Phone, updated.AvatarUrl, updated.RegistrationDate,
		updated.AccountStatus, updated.UserRole,
		getVerificationStatusOrDefault(ctx, s.q, id),
	)
	return &resp, nil
}

// RequestVerification queues the current customer for admin profile-badge review.
func (s *AuthService) RequestVerification(ctx context.Context, id uuid.UUID) (sqlcdb.VerificationStatus, error) {
	current, err := s.q.GetCustomerByID(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", ErrCustomerNotFound
		}
		return "", err
	}
	if current.AccountStatus != sqlcdb.AccountStatusActive {
		return "", ErrAccountNotActive
	}

	if err := s.q.EnsureCustomerVerificationSchema(ctx); err != nil {
		return "", err
	}

	status, err := s.q.RequestCustomerVerification(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			existing, getErr := s.q.GetCustomerVerificationStatus(ctx, id)
			if getErr == nil && existing == sqlcdb.VerificationStatusVerified {
				return existing, nil
			}
			return "", ErrCustomerNotFound
		}
		return "", err
	}
	return status, nil
}

// UpdatePassword changes the customer's password after verifying the current one.
func (s *AuthService) UpdatePassword(ctx context.Context, id uuid.UUID, req model.UpdatePasswordRequest) error {
	if req.NewPassword != req.ConfirmNewPassword {
		return ErrPasswordMismatch
	}

	current, err := s.q.GetCustomerByID(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrCustomerNotFound
		}
		return err
	}

	withPassword, err := s.q.GetCustomerByEmail(ctx, current.Email)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrCustomerNotFound
		}
		return err
	}

	if !hash.Check(req.CurrentPassword, withPassword.PasswordHash) {
		return ErrInvalidCredentials
	}

	hashed, err := hash.Password(req.NewPassword)
	if err != nil {
		return err
	}

	return s.q.UpdateCustomerPassword(ctx, sqlcdb.UpdateCustomerPasswordParams{
		CustomerID:   id,
		PasswordHash: hashed,
	})
}

// DeleteAccount removes the current customer and related account data.
func (s *AuthService) DeleteAccount(ctx context.Context, id uuid.UUID) error {
	if _, err := s.q.GetCustomerByID(ctx, id); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrCustomerNotFound
		}
		return err
	}

	return s.q.DeleteCustomerAccountData(ctx, id)
}

// UploadAvatar uploads an avatar image and stores its signed URL on the customer profile.
func (s *AuthService) UploadAvatar(ctx context.Context, id uuid.UUID, fh *multipart.FileHeader) (*model.CustomerResponse, error) {
	if s.st == nil {
		return nil, errors.New("avatar storage is not configured")
	}

	current, err := s.q.GetCustomerByID(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrCustomerNotFound
		}
		return nil, err
	}

	file, err := fh.Open()
	if err != nil {
		return nil, fmt.Errorf("open avatar file: %w", err)
	}
	defer func() {
		_ = file.Close()
	}()

	ext := strings.ToLower(filepath.Ext(fh.Filename))
	if ext == "" {
		ext = ".jpg"
	}

	contentType := fh.Header.Get("Content-Type")
	if contentType == "" {
		contentType = "image/jpeg"
	}

	path := fmt.Sprintf("%s/avatar-%d%s", id.String(), time.Now().UnixMilli(), ext)
	if err := s.st.Upload(ctx, s.bucket, path, contentType, file); err != nil {
		return nil, err
	}

	avatarURL, err := s.st.SignURL(ctx, s.bucket, path, signedURLTTL)
	if err != nil {
		return nil, err
	}

	updated, err := s.q.UpdateCustomerProfile(ctx, sqlcdb.UpdateCustomerProfileParams{
		CustomerID: id,
		FirstName:  current.FirstName,
		LastName:   current.LastName,
		Phone:      current.Phone,
		AvatarUrl:  pgtype.Text{String: avatarURL, Valid: true},
	})
	if err != nil {
		return nil, err
	}

	resp := buildCustomerResponse(
		updated.CustomerID, updated.FirstName, updated.LastName, updated.Email,
		updated.Phone, updated.AvatarUrl, updated.RegistrationDate,
		updated.AccountStatus, updated.UserRole,
		getVerificationStatusOrDefault(ctx, s.q, id),
	)
	return &resp, nil
}

// GetPublicProfile returns the minimal public profile for any customer.
// Returns ErrCustomerNotFound when the customer does not exist.
func (s *AuthService) GetPublicProfile(ctx context.Context, id uuid.UUID) (*model.CustomerProfileResponse, error) {
	c, err := s.q.GetCustomerByID(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrCustomerNotFound
		}

		return nil, err
	}

	verificationStatus, err := s.q.GetCustomerVerificationStatus(ctx, id)
	if err != nil {
		verificationStatus = sqlcdb.VerificationStatusNone
	}

	return &model.CustomerProfileResponse{
		CustomerID:         c.CustomerID.String(),
		FirstName:          c.FirstName,
		LastName:           c.LastName,
		AvatarURL:          c.AvatarUrl.String,
		RegistrationDate:   c.RegistrationDate.Time,
		VerificationStatus: string(verificationStatus),
	}, nil
}

func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}

func getVerificationStatusOrDefault(
	ctx context.Context,
	q authQuerier,
	id uuid.UUID,
) sqlcdb.VerificationStatus {
	status, err := q.GetCustomerVerificationStatus(ctx, id)
	if err != nil {
		return sqlcdb.VerificationStatusNone
	}
	return status
}
