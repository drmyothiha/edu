package auth

import (
	"errors"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

var (
	ErrInvalidToken = errors.New("invalid or expired token")
	ErrTokenExpired = errors.New("token has expired")
)

// Claims defines custom claims for authentication with multi-tenant facility scope
type Claims struct {
	UserID   uuid.UUID  `json:"user_id"`
	Email    string     `json:"email"`
	Role     string     `json:"role"`
	SchoolID *uuid.UUID `json:"school_id,omitempty"`
	jwt.RegisteredClaims
}

// JWTManager handles signing and validating JWTs
type JWTManager struct {
	secretKey     []byte
	tokenDuration time.Duration
	issuer        string
}

// NewJWTManager creates a new JWTManager
func NewJWTManager(secretKey string, tokenDuration time.Duration, issuer string) *JWTManager {
	if issuer == "" {
		issuer = "edu-platform"
	}
	return &JWTManager{
		secretKey:     []byte(secretKey),
		tokenDuration: tokenDuration,
		issuer:        issuer,
	}
}

// Generate creates a new JWT token without school scope (legacy/backward compatibility)
func (m *JWTManager) Generate(userID uuid.UUID, email, role string) (string, time.Time, error) {
	return m.GenerateWithSchool(userID, email, role, nil)
}

// GenerateWithSchool creates a new JWT token containing tenant school_id and user role
func (m *JWTManager) GenerateWithSchool(userID uuid.UUID, email, role string, schoolID *uuid.UUID) (string, time.Time, error) {
	now := time.Now().UTC()
	expiresAt := now.Add(m.tokenDuration)

	claims := Claims{
		UserID:   userID,
		Email:    email,
		Role:     role,
		SchoolID: schoolID,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   userID.String(),
			Issuer:    m.issuer,
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(expiresAt),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString(m.secretKey)
	if err != nil {
		return "", time.Time{}, fmt.Errorf("failed to sign token: %w", err)
	}

	return tokenString, expiresAt, nil
}

// Validate verifies a JWT string and returns its claims
func (m *JWTManager) Validate(tokenString string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(
		tokenString,
		&Claims{},
		func(token *jwt.Token) (any, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("unexpected token signing method: %v", token.Header["alg"])
			}
			return m.secretKey, nil
		},
	)

	if err != nil {
		return nil, ErrInvalidToken
	}

	claims, ok := token.Claims.(*Claims)
	if !ok || !token.Valid {
		return nil, ErrInvalidToken
	}

	return claims, nil
}
