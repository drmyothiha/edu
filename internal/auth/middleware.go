package auth

import (
	"context"
	"net/http"
	"strings"

	"edu-platform/internal/response"
	"github.com/google/uuid"
)

type contextKey string

const (
	userContextKey contextKey = "auth_user"
)

// UserContext holds the authenticated user data stored in request context
type UserContext struct {
	UserID   uuid.UUID  `json:"user_id"`
	Email    string     `json:"email"`
	Role     string     `json:"role"`
	SchoolID *uuid.UUID `json:"school_id,omitempty"`
}

// Middleware provides HTTP middleware methods for authentication and authorization
type Middleware struct {
	jwtManager *JWTManager
}

// NewMiddleware creates a new auth Middleware
func NewMiddleware(jwtManager *JWTManager) *Middleware {
	return &Middleware{jwtManager: jwtManager}
}

// RequireAuth ensures the incoming request has a valid Bearer JWT token
func (m *Middleware) RequireAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		var tokenStr string
		if authHeader != "" {
			parts := strings.SplitN(authHeader, " ", 2)
			if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
				response.Unauthorized(w, "invalid authorization header format, expected 'Bearer <token>'")
				return
			}
			tokenStr = strings.TrimSpace(parts[1])
		} else if qToken := r.URL.Query().Get("token"); qToken != "" {
			tokenStr = strings.TrimSpace(qToken)
		}

		if tokenStr == "" {
			response.Unauthorized(w, "missing authorization token")
			return
		}

		claims, err := m.jwtManager.Validate(tokenStr)
		if err != nil {
			response.Unauthorized(w, "invalid or expired token")
			return
		}

		userCtx := &UserContext{
			UserID:   claims.UserID,
			Email:    claims.Email,
			Role:     claims.Role,
			SchoolID: claims.SchoolID,
		}

		ctx := context.WithValue(r.Context(), userContextKey, userCtx)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// RequireRoles restricts access to users with one of the specified roles
func (m *Middleware) RequireRoles(allowedRoles ...string) func(http.Handler) http.Handler {
	allowed := make(map[string]bool, len(allowedRoles))
	for _, role := range allowedRoles {
		allowed[strings.ToLower(role)] = true
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			user, ok := UserFromContext(r.Context())
			if !ok || user == nil {
				response.Unauthorized(w, "authentication required")
				return
			}

			if !allowed[strings.ToLower(user.Role)] {
				response.Forbidden(w, "insufficient permissions for this resource")
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// UserFromContext retrieves the UserContext from the request context
func UserFromContext(ctx context.Context) (*UserContext, bool) {
	u, ok := ctx.Value(userContextKey).(*UserContext)
	return u, ok && u != nil
}

// MustUserFromContext returns the UserContext or panics if not present (to be used after RequireAuth)
func MustUserFromContext(ctx context.Context) *UserContext {
	u, ok := UserFromContext(ctx)
	if !ok {
		panic("user context missing from authenticated request")
	}
	return u
}

// ContextWithUser returns a new context with the given UserContext attached
func ContextWithUser(ctx context.Context, u *UserContext) context.Context {
	return context.WithValue(ctx, userContextKey, u)
}

