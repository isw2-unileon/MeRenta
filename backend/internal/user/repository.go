package user

import (
	"context"
	"fmt"

	"github.com/isw2-unileon/MeRenta/backend/internal/models"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Repository handles database operations for customers.
type Repository struct {
	db *pgxpool.Pool
}

// NewRepository creates a new user repository.
func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

// CreateCustomer inserts a new customer into the database.
func (r *Repository) CreateCustomer(ctx context.Context, customer *models.Customer) error {
	err := r.db.QueryRow(
		ctx,
		createCustomerQuery,
		customer.FirstName,
		customer.LastName,
		customer.Email,
		customer.Phone,
		customer.PasswordHash,
	).Scan(&customer.CustomerID, &customer.RegistrationDate)

	if err != nil {
		return fmt.Errorf("error creating customer: %w", err)
	}

	customer.AccountStatus = "active"
	customer.UserRole = "user"
	return nil
}

// GetCustomerByEmail retrieves a customer by their email address.
func (r *Repository) GetCustomerByEmail(ctx context.Context, email string) (*models.Customer, error) {
	customer := &models.Customer{}
	err := r.db.QueryRow(ctx, getCustomerByEmailQuery, email).Scan(
		&customer.CustomerID,
		&customer.FirstName,
		&customer.LastName,
		&customer.Email,
		&customer.Phone,
		&customer.PasswordHash,
		&customer.AvatarURL,
		&customer.RegistrationDate,
		&customer.AccountStatus,
		&customer.UserRole,
		&customer.StripeCustomerID,
	)

	if err != nil {
		return nil, fmt.Errorf("error getting customer by email: %w", err)
	}

	return customer, nil
}

// GetCustomerByID retrieves a customer by their ID.
func (r *Repository) GetCustomerByID(ctx context.Context, customerID string) (*models.Customer, error) {
	customer := &models.Customer{}
	err := r.db.QueryRow(ctx, getCustomerByIDQuery, customerID).Scan(
		&customer.CustomerID,
		&customer.FirstName,
		&customer.LastName,
		&customer.Email,
		&customer.Phone,
		&customer.PasswordHash,
		&customer.AvatarURL,
		&customer.RegistrationDate,
		&customer.AccountStatus,
		&customer.UserRole,
		&customer.StripeCustomerID,
	)

	if err != nil {
		return nil, fmt.Errorf("error getting customer by ID: %w", err)
	}

	return customer, nil
}
