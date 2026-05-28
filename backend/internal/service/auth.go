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
	// ErrCustomerNotFound indicates no customer exists with the given ID.
	ErrCustomerNotFound = errors.New("customer not found")
	// ErrEmailMismatch indicates the email confirmation does not match.
	ErrEmailMismatch = errors.New("email confirmation does not match")
	// ErrPasswordMismatch indicates the password confirmation does not match.
	ErrPasswordMismatch = errors.New("password confirmation does not match")
)

// AuthService handles authentication use cases.
type AuthService struct {
	q      sqlcdb.Querier
	jwt    *jwt.Manager
	st     storage.Client
	bucket string
}

// NewAuthService creates an AuthService with its dependencies.
func NewAuthService(q sqlcdb.Querier, jwt *jwt.Manager, storageClient storage.Client, avatarBucket string) *AuthService {
	return &AuthService{q: q, jwt: jwt, st: storageClient, bucket: avatarBucket}
}

// Register creates a new customer account and returns an auth response.
func (s *AuthService) Register(ctx context.Context, req model.RegisterRequest) (*model.AuthResponse, error) {
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

	if c.AccountStatus != sqlcdb.AccountStatusActive {
		return nil, ErrAccountNotActive
	}

	token, err := s.jwt.Generate(c.CustomerID, c.Email, string(c.UserRole))
	if err != nil {
		return nil, err
	}

	return &model.AuthResponse{
		Token: token,
		Customer: model.CustomerResponse{
			CustomerID:       c.CustomerID.String(),
			FirstName:        c.FirstName,
			LastName:         c.LastName,
			Email:            c.Email,
			Phone:            c.Phone.String,
			AvatarURL:        c.AvatarUrl.String,
			RegistrationDate: c.RegistrationDate.Time,
			AccountStatus:    string(c.AccountStatus),
			UserRole:         string(c.UserRole),
		},
	}, nil
}

// toCustomerResponse maps a CreateCustomer row into a response model.
func toCustomerResponse(c sqlcdb.CreateCustomerRow) model.CustomerResponse {
	return model.CustomerResponse{
		CustomerID:       c.CustomerID.String(),
		FirstName:        c.FirstName,
		LastName:         c.LastName,
		Email:            c.Email,
		Phone:            c.Phone.String,
		AvatarURL:        c.AvatarUrl.String,
		RegistrationDate: c.RegistrationDate.Time,
		AccountStatus:    string(c.AccountStatus),
		UserRole:         string(c.UserRole),
	}
}

// GetCustomerByID fetches a customer profile by its ID.
func (s *AuthService) GetCustomerByID(ctx context.Context, id uuid.UUID) (*model.CustomerResponse, error) {
	c, err := s.q.GetCustomerByID(ctx, id)
	if err != nil {
		return nil, err
	}
	resp := model.CustomerResponse{
		CustomerID:       c.CustomerID.String(),
		FirstName:        c.FirstName,
		LastName:         c.LastName,
		Email:            c.Email,
		Phone:            c.Phone.String,
		AvatarURL:        c.AvatarUrl.String,
		RegistrationDate: c.RegistrationDate.Time,
		AccountStatus:    string(c.AccountStatus),
		UserRole:         string(c.UserRole),
	}
	return &resp, nil
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

	return &model.CustomerResponse{
		CustomerID:       c.CustomerID.String(),
		FirstName:        c.FirstName,
		LastName:         c.LastName,
		Email:            c.Email,
		Phone:            c.Phone.String,
		AvatarURL:        c.AvatarUrl.String,
		RegistrationDate: c.RegistrationDate.Time,
		AccountStatus:    string(c.AccountStatus),
		UserRole:         string(c.UserRole),
	}, nil
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
		resp := model.CustomerResponse{
			CustomerID:       current.CustomerID.String(),
			FirstName:        current.FirstName,
			LastName:         current.LastName,
			Email:            current.Email,
			Phone:            current.Phone.String,
			AvatarURL:        current.AvatarUrl.String,
			RegistrationDate: current.RegistrationDate.Time,
			AccountStatus:    string(current.AccountStatus),
			UserRole:         string(current.UserRole),
		}
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

	return &model.CustomerResponse{
		CustomerID:       updated.CustomerID.String(),
		FirstName:        updated.FirstName,
		LastName:         updated.LastName,
		Email:            updated.Email,
		Phone:            updated.Phone.String,
		AvatarURL:        updated.AvatarUrl.String,
		RegistrationDate: updated.RegistrationDate.Time,
		AccountStatus:    string(updated.AccountStatus),
		UserRole:         string(updated.UserRole),
	}, nil
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

	return &model.CustomerResponse{
		CustomerID:       updated.CustomerID.String(),
		FirstName:        updated.FirstName,
		LastName:         updated.LastName,
		Email:            updated.Email,
		Phone:            updated.Phone.String,
		AvatarURL:        updated.AvatarUrl.String,
		RegistrationDate: updated.RegistrationDate.Time,
		AccountStatus:    string(updated.AccountStatus),
		UserRole:         string(updated.UserRole),
	}, nil
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

	return &model.CustomerProfileResponse{
		CustomerID:       c.CustomerID.String(),
		FirstName:        c.FirstName,
		LastName:         c.LastName,
		AvatarURL:        c.AvatarUrl.String,
		RegistrationDate: c.RegistrationDate.Time,
	}, nil
}

func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}
