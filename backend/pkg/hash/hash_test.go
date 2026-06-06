package hash

import "testing"

func TestPasswordHashesAndChecksPlaintext(t *testing.T) {
	t.Parallel()

	hashed, err := Password("super-secret")
	if err != nil {
		t.Fatalf("Password returned error: %v", err)
	}
	if hashed == "super-secret" {
		t.Fatal("hash should not equal plaintext")
	}
	if !Check("super-secret", hashed) {
		t.Fatal("expected hash to verify the original password")
	}
	if Check("wrong-password", hashed) {
		t.Fatal("wrong password should not verify")
	}
}
