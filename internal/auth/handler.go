package auth

import (
	"errors"
	"net/http"

	"edu-platform/internal/response"

	"github.com/go-chi/chi/v5"
)

// Handler handles HTTP requests for authentication
type Handler struct {
	service *Service
}

// NewHandler creates a new auth Handler
func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

// Routes returns a subrouter for auth endpoints
func (h *Handler) Routes(authMiddleware *Middleware) http.Handler {
	r := chi.NewRouter()

	r.Post("/login", h.Login)
	r.Post("/register", h.Register)

	r.Group(func(protected chi.Router) {
		protected.Use(authMiddleware.RequireAuth)
		protected.Get("/me", h.Me)
		protected.Put("/profile", h.UpdateProfile)
		protected.Put("/password", h.ChangePassword)
		protected.Post("/avatar", h.UploadAvatar)
	})

	return r
}

// Login authenticates a user and returns a signed JWT
func (h *Handler) Login(w http.ResponseWriter, r *http.Request) {
	var req LoginRequest
	if err := response.DecodeJSON(r, &req); err != nil {
		response.BadRequest(w, "invalid request body: "+err.Error())
		return
	}

	authResp, err := h.service.Login(r.Context(), req)
	if err != nil {
		if errors.Is(err, ErrInvalidPassword) {
			response.Unauthorized(w, err.Error())
			return
		}
		response.BadRequest(w, err.Error())
		return
	}

	response.JSON(w, http.StatusOK, authResp)
}

// Register creates a new user account and returns a token
func (h *Handler) Register(w http.ResponseWriter, r *http.Request) {
	var req RegisterRequest
	if err := response.DecodeJSON(r, &req); err != nil {
		response.BadRequest(w, "invalid request body: "+err.Error())
		return
	}

	authResp, err := h.service.Register(r.Context(), req)
	if err != nil {
		if errors.Is(err, ErrUserAlreadyExists) {
			response.Conflict(w, err.Error())
			return
		}
		if errors.Is(err, ErrInvalidRole) {
			response.BadRequest(w, err.Error())
			return
		}
		response.BadRequest(w, err.Error())
		return
	}

	response.JSON(w, http.StatusCreated, authResp)
}

// Me returns the currently authenticated user's profile
func (h *Handler) Me(w http.ResponseWriter, r *http.Request) {
	userCtx, ok := UserFromContext(r.Context())
	if !ok || userCtx == nil {
		response.Unauthorized(w, "authentication required")
		return
	}

	user, err := h.service.GetUserByID(r.Context(), userCtx.UserID)
	if err != nil {
		if errors.Is(err, ErrUserNotFound) {
			response.NotFound(w, "user not found")
			return
		}
		response.InternalServerError(w, "failed to fetch user profile")
		return
	}

	response.JSON(w, http.StatusOK, user)
}

// UpdateProfile handles PUT /api/v1/auth/profile
func (h *Handler) UpdateProfile(w http.ResponseWriter, r *http.Request) {
	userCtx, ok := UserFromContext(r.Context())
	if !ok || userCtx == nil {
		response.Unauthorized(w, "authentication required")
		return
	}

	var req UpdateProfileRequest
	if err := response.DecodeJSON(r, &req); err != nil {
		response.BadRequest(w, "invalid request body: "+err.Error())
		return
	}

	updated, err := h.service.UpdateProfile(r.Context(), userCtx.UserID, req)
	if err != nil {
		if errors.Is(err, ErrUserNotFound) {
			response.NotFound(w, "user not found")
			return
		}
		response.BadRequest(w, err.Error())
		return
	}

	response.JSON(w, http.StatusOK, updated)
}

// ChangePassword handles PUT /api/v1/auth/password
func (h *Handler) ChangePassword(w http.ResponseWriter, r *http.Request) {
	userCtx, ok := UserFromContext(r.Context())
	if !ok || userCtx == nil {
		response.Unauthorized(w, "authentication required")
		return
	}

	var req ChangePasswordRequest
	if err := response.DecodeJSON(r, &req); err != nil {
		response.BadRequest(w, "invalid request body: "+err.Error())
		return
	}

	if err := h.service.ChangePassword(r.Context(), userCtx.UserID, req); err != nil {
		if errors.Is(err, ErrInvalidPassword) {
			response.Unauthorized(w, err.Error())
			return
		}
		response.BadRequest(w, err.Error())
		return
	}

	response.JSON(w, http.StatusOK, map[string]string{
		"message": "password updated successfully",
	})
}

// UploadAvatar handles POST /api/v1/auth/avatar
func (h *Handler) UploadAvatar(w http.ResponseWriter, r *http.Request) {
	userCtx, ok := UserFromContext(r.Context())
	if !ok || userCtx == nil {
		response.Unauthorized(w, "authentication required")
		return
	}

	var req struct {
		AvatarURL string `json:"avatar_url"`
	}
	if err := response.DecodeJSON(r, &req); err != nil {
		response.BadRequest(w, "invalid request body: "+err.Error())
		return
	}

	updated, err := h.service.UpdateAvatar(r.Context(), userCtx.UserID, req.AvatarURL)
	if err != nil {
		response.InternalServerError(w, "failed to update avatar: "+err.Error())
		return
	}

	response.JSON(w, http.StatusOK, map[string]interface{}{
		"avatar_url": req.AvatarURL,
		"user":       updated,
	})
}
