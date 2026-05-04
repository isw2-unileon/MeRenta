package user

import (
	"context"
	"errors"
	"fmt"

	"github.com/isw2-unileon/MeRenta/backend/internal/models"
	"golang.org/x/crypto/bcrypt"
)

// Service handles business logic for customer operations.
type Service struct {
	repo *Repository
}

// NewService creates a new user service.
func NewService(repo *Repository) *Service {
	return &Service{repo: repo}
}

// Register creates a new customer with a hashed password.
func (s *Service) Register(ctx context.Context, req *models.RegisterRequest) (*models.RegisterResponse, error) {
	// Validate input
	if req.Email == "" || req.Password == "" || req.FirstName == "" || req.LastName == "" {
		return nil, errors.New("all fields are required")
	}

	if len(req.Password) < 8 {
		return nil, errors.New("password must be at least 8 characters long")
	}

	// Validate passwords match
	if req.Password != req.ConfirmPassword {
		return nil, errors.New("passwords do not match")
	}

	// Check if customer already exists
	_, err := s.repo.GetCustomerByEmail(ctx, req.Email)
	if err == nil {
		return nil, errors.New("user with this email already exists")
	}

	// Hash the password using bcrypt
	hashedPassword, err := s.hashPassword(req.Password)
	if err != nil {
		return nil, fmt.Errorf("error hashing password: %w", err)
	}

	// Create the customer
	customer := &models.Customer{
		FirstName:    req.FirstName,
		LastName:     req.LastName,
		Email:        req.Email,
		PasswordHash: hashedPassword,
	}

	// Add optional phone if provided
	if req.Phone != "" {
		customer.Phone = &req.Phone
	}

	if err := s.repo.CreateCustomer(ctx, customer); err != nil {
		return nil, fmt.Errorf("error registering customer: %w", err)
	}

	// Return response without the password
	return &models.RegisterResponse{
		CustomerID:       customer.CustomerID,
		FirstName:        customer.FirstName,
		LastName:         customer.LastName,
		Email:            customer.Email,
		RegistrationDate: customer.RegistrationDate,
		UserRole:         customer.UserRole,
	}, nil
}

// hashPassword hashes a password using bcrypt.
// Uses bcrypt cost 12 which balances security and performance.
func (s *Service) hashPassword(password string) (string, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", fmt.Errorf("error generating password hash: %w", err)
	}
	return string(hash), nil
}

// VerifyPassword verifies a password against its hash.
func (s *Service) VerifyPassword(hashedPassword, password string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(hashedPassword), []byte(password))
	return err == nil
}

// LoginCustomer authenticates a customer and returns the customer if credentials are valid.
func (s *Service) LoginCustomer(ctx context.Context, email, password string) (*models.Customer, error) {
	customer, err := s.repo.GetCustomerByEmail(ctx, email)
	if err != nil {
		return nil, errors.New("invalid email or password")
	}

	if !s.VerifyPassword(customer.PasswordHash, password) {
		return nil, errors.New("invalid email or password")
	}

	return customer, nil
}
