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
)

var (
	ErrUserNotFound      = errors.New("user not found")
	ErrInvalidPassword   = errors.New("invalid email or password")
	ErrUserAlreadyExists = errors.New("a user with this email already exists")
	ErrInvalidRole       = errors.New("invalid role; must be 'admin', 'teacher', 'parent', or 'student'")
)

var validRoles = map[string]bool{
	"admin":   true,
	"teacher": true,
	"parent":  true,
	"student": true,
}

// UserDTO represents sanitized user data returned to clients
type UserDTO struct {
	ID        uuid.UUID `json:"id"`
	Email     string    `json:"email"`
	FullName  string    `json:"full_name"`
	Role      string    `json:"role"`
	CreatedAt time.Time `json:"created_at"`
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
	Email    string `json:"email"`
	Password string `json:"password"`
	FullName string `json:"full_name"`
	Role     string `json:"role"`
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

	token, expiresAt, err := s.jwtManager.Generate(user.ID, user.Email, user.Role)
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

	user, err := s.querier.CreateUser(ctx, database.CreateUserParams{
		Email:        email,
		PasswordHash: hash,
		FullName:     fullName,
		Role:         role,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create user: %w", err)
	}

	token, expiresAt, err := s.jwtManager.Generate(user.ID, user.Email, user.Role)
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

	return &UserDTO{
		ID:        user.ID,
		Email:     user.Email,
		FullName:  user.FullName,
		Role:      user.Role,
		CreatedAt: user.CreatedAt.Time,
	}, nil
}
