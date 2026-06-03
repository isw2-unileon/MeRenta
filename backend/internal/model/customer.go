// Package model contains request and response DTOs.
package model

import "time"

// RegisterRequest defines the payload for user registration.
type RegisterRequest struct {
	FirstName string `json:"first_name" binding:"required,min=2,max=100"`
	LastName  string `json:"last_name"  binding:"required,min=2,max=150"`
	Email     string `json:"email"      binding:"required,email,max=255"`
	Phone     string `json:"phone"      binding:"omitempty,max=20"`
	Password  string `json:"password"   binding:"required,min=8,max=72"`
}

// LoginRequest defines the payload for user login.
type LoginRequest struct {
	Email    string `json:"email"    binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

// UpdateProfileRequest defines editable customer profile fields.
type UpdateProfileRequest struct {
	FirstName string  `json:"first_name" binding:"required,min=2,max=100"`
	LastName  string  `json:"last_name"  binding:"required,min=2,max=150"`
	Phone     *string `json:"phone"      binding:"omitempty,max=20"`
	AvatarURL *string `json:"avatar_url" binding:"omitempty"`
}

// UpdateEmailRequest defines the payload for changing the current user's email.
type UpdateEmailRequest struct {
	Email        string `json:"email"         binding:"required,email,max=255"`
	ConfirmEmail string `json:"confirm_email" binding:"required,email,max=255"`
}

// UpdatePasswordRequest defines the payload for changing the current user's password.
type UpdatePasswordRequest struct {
	CurrentPassword    string `json:"current_password"     binding:"required"`
	NewPassword        string `json:"new_password"         binding:"required,min=8,max=72"`
	ConfirmNewPassword string `json:"confirm_new_password" binding:"required,min=8,max=72"`
}

// CustomerResponse exposes customer data to API clients.
type CustomerResponse struct {
	CustomerID       string     `json:"customer_id"`
	FirstName        string     `json:"first_name"`
	LastName         string     `json:"last_name"`
	Email            string     `json:"email"`
	Phone            string     `json:"phone,omitempty"`
	AvatarURL        string     `json:"avatar_url,omitempty"`
	RegistrationDate time.Time  `json:"registration_date"`
	AccountStatus    string     `json:"account_status"`
	UserRole         string     `json:"user_role"`
	SuspendedUntil   *time.Time `json:"suspended_until,omitempty"`
}

// AuthResponse returns a JWT token and the customer profile.
type AuthResponse struct {
	Token    string           `json:"token"`
	Customer CustomerResponse `json:"customer"`
}

// CustomerProfileResponse is the minimal public profile shown on listing pages
// (e.g. the owner card on a product detail page). It deliberately omits
// sensitive fields such as email, phone and stripe_customer_id.
type CustomerProfileResponse struct {
	CustomerID       string    `json:"customer_id"`
	FirstName        string    `json:"first_name"`
	LastName         string    `json:"last_name"`
	AvatarURL        string    `json:"avatar_url,omitempty"`
	RegistrationDate time.Time `json:"registration_date"`
}
