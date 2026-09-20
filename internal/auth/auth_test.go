package auth

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/google/uuid"
)

func TestPasswordHashing(t *testing.T) {
	password := "SecureSecret123!"

	hash, err := HashPassword(password)
	if err != nil {
		t.Fatalf("unexpected error hashing password: %v", err)
	}

	if hash == password {
		t.Fatalf("hash should not equal plain text password")
	}

	if !CheckPasswordHash(password, hash) {
		t.Fatalf("password should verify against its generated hash")
	}

	if CheckPasswordHash("WrongPassword", hash) {
		t.Fatalf("incorrect password should not verify")
	}

	_, err = HashPassword("")
	if err == nil {
		t.Fatalf("expected error when hashing empty password")
	}
}

func TestJWTGenerationAndValidation(t *testing.T) {
	manager := NewJWTManager("super-test-secret-key-that-is-at-least-32-bytes!", 1*time.Hour, "edu-test")
	userID := uuid.New()
	email := "teacher@edu.local"
	role := "teacher"

	tokenStr, expiresAt, err := manager.Generate(userID, email, role)
	if err != nil {
		t.Fatalf("failed to generate token: %v", err)
	}

	if tokenStr == "" {
		t.Fatalf("token string should not be empty")
	}

	if expiresAt.Before(time.Now()) {
		t.Fatalf("expiresAt should be in the future")
	}

	claims, err := manager.Validate(tokenStr)
	if err != nil {
		t.Fatalf("failed to validate valid token: %v", err)
	}

	if claims.UserID != userID {
		t.Errorf("expected userID %s, got %s", userID, claims.UserID)
	}
	if claims.Email != email {
		t.Errorf("expected email %s, got %s", email, claims.Email)
	}
	if claims.Role != role {
		t.Errorf("expected role %s, got %s", role, claims.Role)
	}
}

func TestJWTValidationExpired(t *testing.T) {
	manager := NewJWTManager("super-test-secret-key-that-is-at-least-32-bytes!", -1*time.Hour, "edu-test")
	userID := uuid.New()

	tokenStr, _, err := manager.Generate(userID, "expired@edu.local", "student")
	if err != nil {
		t.Fatalf("failed to generate token: %v", err)
	}

	_, err = manager.Validate(tokenStr)
	if err == nil {
		t.Fatalf("expected validation error for expired token, got nil")
	}
}

func TestJWTValidationInvalidSecret(t *testing.T) {
	manager1 := NewJWTManager("secret-key-111111111111111111111111111111", 1*time.Hour, "edu-test")
	manager2 := NewJWTManager("secret-key-222222222222222222222222222222", 1*time.Hour, "edu-test")

	tokenStr, _, err := manager1.Generate(uuid.New(), "user@edu.local", "admin")
	if err != nil {
		t.Fatalf("failed to generate token: %v", err)
	}

	_, err = manager2.Validate(tokenStr)
	if err == nil {
		t.Fatalf("expected validation error when signed with different key, got nil")
	}
}

func TestMiddlewareRequireAuth(t *testing.T) {
	manager := NewJWTManager("secret-key-test-auth-middleware-32-bytes-long", 1*time.Hour, "edu-test")
	mw := NewMiddleware(manager)

	handler := mw.RequireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		u := MustUserFromContext(r.Context())
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("hello " + u.Role))
	}))

	// Case 1: Missing auth header
	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)
	if rr.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 Unauthorized for missing auth header, got %d", rr.Code)
	}

	// Case 2: Invalid format
	req = httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("Authorization", "Basic abc123")
	rr = httptest.NewRecorder()
	handler.ServeHTTP(rr, req)
	if rr.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 Unauthorized for invalid auth header format, got %d", rr.Code)
	}

	// Case 3: Valid token
	validToken, _, err := manager.Generate(uuid.New(), "teacher@edu.local", "teacher")
	if err != nil {
		t.Fatalf("failed to generate token: %v", err)
	}

	req = httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("Authorization", "Bearer "+validToken)
	rr = httptest.NewRecorder()
	handler.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK for valid token, got %d: %s", rr.Code, rr.Body.String())
	}
}

func TestMiddlewareRequireRoles(t *testing.T) {
	manager := NewJWTManager("secret-key-test-auth-middleware-32-bytes-long", 1*time.Hour, "edu-test")
	mw := NewMiddleware(manager)

	teacherOnlyHandler := mw.RequireAuth(
		mw.RequireRoles("teacher", "admin")(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte("access granted"))
		})),
	)

	// Case 1: Teacher token -> Allowed
	teacherToken, _, _ := manager.Generate(uuid.New(), "teacher@edu.local", "teacher")
	req := httptest.NewRequest(http.MethodGet, "/teacher-resource", nil)
	req.Header.Set("Authorization", "Bearer "+teacherToken)
	rr := httptest.NewRecorder()
	teacherOnlyHandler.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK for teacher role, got %d", rr.Code)
	}

	// Case 2: Admin token -> Allowed
	adminToken, _, _ := manager.Generate(uuid.New(), "admin@edu.local", "admin")
	req = httptest.NewRequest(http.MethodGet, "/teacher-resource", nil)
	req.Header.Set("Authorization", "Bearer "+adminToken)
	rr = httptest.NewRecorder()
	teacherOnlyHandler.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Errorf("expected 200 OK for admin role, got %d", rr.Code)
	}

	// Case 3: Student token -> Forbidden 403
	studentToken, _, _ := manager.Generate(uuid.New(), "student@edu.local", "student")
	req = httptest.NewRequest(http.MethodGet, "/teacher-resource", nil)
	req.Header.Set("Authorization", "Bearer "+studentToken)
	rr = httptest.NewRecorder()
	teacherOnlyHandler.ServeHTTP(rr, req)
	if rr.Code != http.StatusForbidden {
		t.Errorf("expected 403 Forbidden for student accessing teacher resource, got %d", rr.Code)
	}
}
