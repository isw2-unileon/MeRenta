// Package hash provides password hashing utilities.
package hash

import "golang.org/x/crypto/bcrypt"

// Password hashes a plaintext password using bcrypt.
func Password(plain string) (string, error) {
	bytes, err := bcrypt.GenerateFromPassword([]byte(plain), bcrypt.DefaultCost)
	return string(bytes), err
}

// Check verifies a plaintext password against its bcrypt hash.
func Check(plain, hashed string) bool {
	return bcrypt.CompareHashAndPassword([]byte(hashed), []byte(plain)) == nil
}
