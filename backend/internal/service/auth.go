// Package service contains business logic for the API.
package service

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/isw2-unileon/MeRenta/backend/internal/model"
	"github.com/isw2-unileon/MeRenta/backend/internal/sqlcdb"
	"github.com/isw2-unileon/MeRenta/backend/pkg/hash"
	"github.com/isw2-unileon/MeRenta/backend/pkg/jwt"
)

var (
	// ErrEmailExists indicates the email is already registered.
	ErrEmailExists = errors.New("email is already registered")
	// ErrInvalidCredentials indicates the email or password is incorrect.
	ErrInvalidCredentials = errors.New("invalid credentials")
	// ErrAccountNotActive indicates the account is not active.
	ErrAccountNotActive = errors.New("account is not active")
)

// AuthService handles authentication use cases.
type AuthService struct {
	q   sqlcdb.Querier
	jwt *jwt.Manager
}

// NewAuthService creates an AuthService with its dependencies.
func NewAuthService(q sqlcdb.Querier, jwt *jwt.Manager) *AuthService {
	return &AuthService{q: q, jwt: jwt}
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

func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}
