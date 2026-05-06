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

// CustomerResponse exposes customer data to API clients.
type CustomerResponse struct {
	CustomerID       string    `json:"customer_id"`
	FirstName        string    `json:"first_name"`
	LastName         string    `json:"last_name"`
	Email            string    `json:"email"`
	Phone            string    `json:"phone,omitempty"`
	AvatarURL        string    `json:"avatar_url,omitempty"`
	RegistrationDate time.Time `json:"registration_date"`
	AccountStatus    string    `json:"account_status"`
	UserRole         string    `json:"user_role"`
}

// AuthResponse returns a JWT token and the customer profile.
type AuthResponse struct {
	Token    string           `json:"token"`
	Customer CustomerResponse `json:"customer"`
}
