package auth

import (
	"testing"
	"time"
)

func TestPasswordHashingAndVerification(t *testing.T) {
	password := "SentriX@Admin2026!Secure"

	hash, err := HashPassword(password)
	if err != nil {
		t.Fatalf("HashPassword failed: %v", err)
	}

	if hash == "" {
		t.Fatal("Expected non-empty password hash")
	}

	valid, err := VerifyPassword(password, hash)
	if err != nil {
		t.Fatalf("VerifyPassword failed: %v", err)
	}
	if !valid {
		t.Fatal("VerifyPassword returned false for valid password")
	}

	invalid, err := VerifyPassword("WrongPassword123!", hash)
	if err != nil {
		t.Fatalf("VerifyPassword errored on wrong password: %v", err)
	}
	if invalid {
		t.Fatal("VerifyPassword returned true for wrong password")
	}
}

func TestJWTAccessToken(t *testing.T) {
	userID := "usr-123e4567-e89b-12d3-a456-426614174000"
	email := "operator@sentrix.internal"
	role := "ADMIN"

	tokenStr, expiresAt, err := GenerateAccessToken(userID, email, role)
	if err != nil {
		t.Fatalf("GenerateAccessToken failed: %v", err)
	}

	if tokenStr == "" {
		t.Fatal("Expected non-empty token string")
	}

	if expiresAt.Before(time.Now()) {
		t.Fatal("Token expiration time should be in the future")
	}

	claims, err := ValidateAccessToken(tokenStr)
	if err != nil {
		t.Fatalf("ValidateAccessToken failed: %v", err)
	}

	if claims.Subject != userID {
		t.Errorf("Expected subject %s, got %s", userID, claims.Subject)
	}
	if claims.Email != email {
		t.Errorf("Expected email %s, got %s", email, claims.Email)
	}
	if claims.Role != role {
		t.Errorf("Expected role %s, got %s", role, claims.Role)
	}

	// Test invalid token
	_, err = ValidateAccessToken(tokenStr + "tampered")
	if err == nil {
		t.Fatal("Expected error for tampered token, got nil")
	}
}
