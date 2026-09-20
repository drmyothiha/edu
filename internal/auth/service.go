package auth

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"edu-platform/internal/database"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

var (
	ErrUserNotFound      = errors.New("user not found")
	ErrInvalidPassword   = errors.New("invalid email or password")
	ErrUserAlreadyExists = errors.New("a user with this email already exists")
	ErrInvalidRole       = errors.New("invalid role; must be 'sysadmin', 'school_admin', 'teacher', 'parent', or 'student'")
)

var validRoles = map[string]bool{
	"sysadmin":     true,
	"school_admin": true,
	"admin":        true, // legacy alias for backward compatibility
	"teacher":      true,
	"parent":       true,
	"student":      true,
}

// UserDTO represents sanitized user data returned to clients
type UserDTO struct {
	ID        uuid.UUID  `json:"id"`
	Email     string     `json:"email"`
	FullName  string     `json:"full_name"`
	Role      string     `json:"role"`
	SchoolID  *uuid.UUID `json:"school_id,omitempty"`
	CreatedAt time.Time  `json:"created_at"`
}

// AuthResponse represents the response containing token and user profile
type AuthResponse struct {
	Token     string    `json:"token"`
	ExpiresAt time.Time `json:"expires_at"`
	User      UserDTO   `json:"user"`
}

// LoginRequest defines login credentials
type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

// RegisterRequest defines user registration payload
type RegisterRequest struct {
	Email    string     `json:"email"`
	Password string     `json:"password"`
	FullName string     `json:"full_name"`
	Role     string     `json:"role"`
	SchoolID *uuid.UUID `json:"school_id,omitempty"`
}

// Service defines authentication and user operations
type Service struct {
	querier    database.Querier
	jwtManager *JWTManager
}

// NewService creates a new auth Service
func NewService(querier database.Querier, jwtManager *JWTManager) *Service {
	return &Service{
		querier:    querier,
		jwtManager: jwtManager,
	}
}

// Login verifies credentials and returns JWT
func (s *Service) Login(ctx context.Context, req LoginRequest) (*AuthResponse, error) {
	email := strings.TrimSpace(strings.ToLower(req.Email))
	if email == "" || req.Password == "" {
		return nil, errors.New("email and password are required")
	}

	user, err := s.querier.GetUserByEmail(ctx, email)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrInvalidPassword
		}
		return nil, fmt.Errorf("failed to query user: %w", err)
	}

	if !CheckPasswordHash(req.Password, user.PasswordHash) {
		return nil, ErrInvalidPassword
	}

	var schoolID *uuid.UUID
	if user.SchoolID.Valid {
		sid := uuid.UUID(user.SchoolID.Bytes)
		schoolID = &sid
	}

	token, expiresAt, err := s.jwtManager.GenerateWithSchool(user.ID, user.Email, user.Role, schoolID)
	if err != nil {
		return nil, fmt.Errorf("failed to generate token: %w", err)
	}

	return &AuthResponse{
		Token:     token,
		ExpiresAt: expiresAt,
		User: UserDTO{
			ID:        user.ID,
			Email:     user.Email,
			FullName:  user.FullName,
			Role:      user.Role,
			SchoolID:  schoolID,
			CreatedAt: user.CreatedAt.Time,
		},
	}, nil
}

// Register creates a new user account and returns an auth token
func (s *Service) Register(ctx context.Context, req RegisterRequest) (*AuthResponse, error) {
	email := strings.TrimSpace(strings.ToLower(req.Email))
	role := strings.TrimSpace(strings.ToLower(req.Role))
	fullName := strings.TrimSpace(req.FullName)

	if email == "" {
		return nil, errors.New("email is required")
	}
	if len(req.Password) < 6 {
		return nil, errors.New("password must be at least 6 characters long")
	}
	if fullName == "" {
		return nil, errors.New("full_name is required")
	}
	if !validRoles[role] {
		return nil, ErrInvalidRole
	}

	// Check if already exists
	_, err := s.querier.GetUserByEmail(ctx, email)
	if err == nil {
		return nil, ErrUserAlreadyExists
	} else if !errors.Is(err, pgx.ErrNoRows) {
		return nil, fmt.Errorf("failed to check existing user: %w", err)
	}

	hash, err := HashPassword(req.Password)
	if err != nil {
		return nil, fmt.Errorf("failed to hash password: %w", err)
	}

	var pgSchoolID pgtype.UUID
	if req.SchoolID != nil && *req.SchoolID != uuid.Nil {
		pgSchoolID = pgtype.UUID{
			Bytes: [16]byte(*req.SchoolID),
			Valid: true,
		}
	}

	user, err := s.querier.CreateUser(ctx, database.CreateUserParams{
		Email:        email,
		PasswordHash: hash,
		FullName:     fullName,
		Role:         role,
		SchoolID:     pgSchoolID,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create user: %w", err)
	}

	token, expiresAt, err := s.jwtManager.GenerateWithSchool(user.ID, user.Email, user.Role, req.SchoolID)
	if err != nil {
		return nil, fmt.Errorf("failed to generate token: %w", err)
	}

	return &AuthResponse{
		Token:     token,
		ExpiresAt: expiresAt,
		User: UserDTO{
			ID:        user.ID,
			Email:     user.Email,
			FullName:  user.FullName,
			Role:      user.Role,
			SchoolID:  req.SchoolID,
			CreatedAt: user.CreatedAt.Time,
		},
	}, nil
}

// GetUserByID fetches user details by ID
func (s *Service) GetUserByID(ctx context.Context, id uuid.UUID) (*UserDTO, error) {
	user, err := s.querier.GetUserByID(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrUserNotFound
		}
		return nil, fmt.Errorf("failed to get user: %w", err)
	}

	var schoolID *uuid.UUID
	if user.SchoolID.Valid {
		sid := uuid.UUID(user.SchoolID.Bytes)
		schoolID = &sid
	}

	return &UserDTO{
		ID:        user.ID,
		Email:     user.Email,
		FullName:  user.FullName,
		Role:      user.Role,
		SchoolID:  schoolID,
		CreatedAt: user.CreatedAt.Time,
	}, nil
}
