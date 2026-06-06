package service

import (
	"strings"
	"testing"
)

func TestMessageCipherEncryptDecryptRoundTrip(t *testing.T) {
	t.Parallel()

	cipher, err := newMessageCipher([]byte("0123456789abcdef0123456789abcdef"))
	if err != nil {
		t.Fatalf("newMessageCipher returned error: %v", err)
	}

	encrypted, err := cipher.Encrypt("hola mundo")
	if err != nil {
		t.Fatalf("Encrypt returned error: %v", err)
	}
	if !strings.HasPrefix(encrypted, encryptedMessagePrefix) {
		t.Fatalf("encrypted value should have prefix, got %q", encrypted)
	}
	if encrypted == encryptedMessagePrefix+"hola mundo" {
		t.Fatal("encrypted value should not contain raw plaintext")
	}

	decrypted, err := cipher.Decrypt(encrypted)
	if err != nil {
		t.Fatalf("Decrypt returned error: %v", err)
	}
	if decrypted != "hola mundo" {
		t.Fatalf("decrypted = %q", decrypted)
	}
}

func TestMessageCipherDecryptKeepsPlaintextAndRejectsBadPayloads(t *testing.T) {
	t.Parallel()

	cipher, err := newMessageCipher([]byte("0123456789abcdef0123456789abcdef"))
	if err != nil {
		t.Fatalf("newMessageCipher returned error: %v", err)
	}

	if got, err := cipher.Decrypt("legacy message"); err != nil || got != "legacy message" {
		t.Fatalf("legacy decrypt = %q, %v", got, err)
	}
	if _, err := cipher.Decrypt(encryptedMessagePrefix + "not valid base64"); err == nil {
		t.Fatal("expected invalid base64 payload to fail")
	}
	if _, err := cipher.Decrypt(encryptedMessagePrefix + "AA"); err == nil {
		t.Fatal("expected short encrypted payload to fail")
	}
}

func TestNewMessageCipherRejectsInvalidKeySize(t *testing.T) {
	t.Parallel()

	if _, err := newMessageCipher([]byte("too-short")); err == nil {
		t.Fatal("expected invalid AES key size to fail")
	}
}
