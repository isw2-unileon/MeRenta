package models

import "time"

// Customer represents a customer/user in the system.
type Customer struct {
	CustomerID       string    `db:"customer_id"`
	FirstName        string    `db:"first_name"`
	LastName         string    `db:"last_name"`
	Email            string    `db:"email"`
	Phone            *string   `db:"phone"` // Optional
	PasswordHash     string    `db:"password_hash"`
	AvatarURL        *string   `db:"avatar_url"` // Optional
	RegistrationDate time.Time `db:"registration_date"`
	AccountStatus    string    `db:"account_status"`     // 'active', 'suspended', 'deleted'
	UserRole         string    `db:"user_role"`          // 'user', 'admin', 'moderator'
	StripeCustomerID *string   `db:"stripe_customer_id"` // Optional
}

// RegisterRequest represents the payload for customer registration.
type RegisterRequest struct {
	FirstName       string `json:"first_name" binding:"required,min=2"`
	LastName        string `json:"last_name" binding:"required,min=2"`
	Email           string `json:"email" binding:"required,email"`
	Password        string `json:"password" binding:"required,min=8"`
	ConfirmPassword string `json:"confirm_password" binding:"required,min=8"`
	Phone           string `json:"phone" binding:"omitempty,min=9"`
}

// RegisterResponse represents the successful registration response.
type RegisterResponse struct {
	CustomerID       string    `json:"customer_id"`
	FirstName        string    `json:"first_name"`
	LastName         string    `json:"last_name"`
	Email            string    `json:"email"`
	RegistrationDate time.Time `json:"registration_date"`
	UserRole         string    `json:"user_role"`
}

// LoginRequest represents the payload for customer login.
type LoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=8"`
}

// LoginResponse represents the successful login response.
type LoginResponse struct {
	AccessToken  string         `json:"access_token"`
	RefreshToken string         `json:"refresh_token"`
	Customer     CustomerPublic `json:"customer"`
}

// CustomerPublic represents public customer information without sensitive data.
type CustomerPublic struct {
	CustomerID       string    `json:"customer_id"`
	FirstName        string    `json:"first_name"`
	LastName         string    `json:"last_name"`
	Email            string    `json:"email"`
	Phone            *string   `json:"phone"`
	AvatarURL        *string   `json:"avatar_url"`
	RegistrationDate time.Time `json:"registration_date"`
	AccountStatus    string    `json:"account_status"`
	UserRole         string    `json:"user_role"`
}
