// Package service contains business logic for the API.
package service

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"io"
	"strings"
)

// encryptedMessagePrefix tags stored ciphertext so plaintext (legacy) and
// encrypted message bodies can be told apart on read.
const encryptedMessagePrefix = "enc:v1:"

// messageCipher encrypts message bodies before they are stored.
type messageCipher struct {
	aead cipher.AEAD
}

// newMessageCipher builds a messageCipher from a 16/24/32-byte AES key using
// AES-GCM authenticated encryption.
func newMessageCipher(key []byte) (*messageCipher, error) {
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	aead, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	return &messageCipher{aead: aead}, nil
}

// Encrypt seals plaintext with a fresh random nonce and returns the prefixed,
// base64-encoded nonce+ciphertext payload.
func (c *messageCipher) Encrypt(plaintext string) (string, error) {
	nonce := make([]byte, c.aead.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}

	ciphertext := c.aead.Seal(nil, nonce, []byte(plaintext), nil)
	payload := append(append([]byte{}, nonce...), ciphertext...)

	return encryptedMessagePrefix + base64.RawStdEncoding.EncodeToString(payload), nil
}

// Decrypt reverses Encrypt. Values without the encryption prefix are assumed to
// be legacy plaintext and returned unchanged.
func (c *messageCipher) Decrypt(value string) (string, error) {
	if !strings.HasPrefix(value, encryptedMessagePrefix) {
		return value, nil
	}

	payload, err := base64.RawStdEncoding.DecodeString(strings.TrimPrefix(value, encryptedMessagePrefix))
	if err != nil {
		return "", err
	}

	nonceSize := c.aead.NonceSize()
	if len(payload) < nonceSize {
		return "", fmt.Errorf("encrypted message payload is too short")
	}

	nonce := payload[:nonceSize]
	ciphertext := payload[nonceSize:]
	plaintext, err := c.aead.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return "", err
	}

	return string(plaintext), nil
}
