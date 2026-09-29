package notification

import (
	"encoding/json"
	"net/http"

	"edu-platform/internal/auth"
	"edu-platform/internal/response"
)

// Handler handles HTTP requests for notifications and devices
type Handler struct {
	service *Service
}

// NewHandler creates a new notification Handler
func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

// Stream handles GET /api/v1/notifications/stream (SSE)
func (h *Handler) Stream(w http.ResponseWriter, r *http.Request) {
	h.service.Broker().StreamHandler(w, r)
}

// RegisterDeviceTokenRequest holds payload for token registration
type RegisterDeviceTokenRequest struct {
	FCMToken string `json:"fcm_token"`
	Platform string `json:"platform"`
}

// RegisterDeviceToken handles POST /api/v1/devices/token
func (h *Handler) RegisterDeviceToken(w http.ResponseWriter, r *http.Request) {
	user, ok := auth.UserFromContext(r.Context())
	if !ok || user == nil {
		response.Unauthorized(w, "authentication required")
		return
	}

	var req RegisterDeviceTokenRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.BadRequest(w, "invalid request body")
		return
	}

	if req.FCMToken == "" {
		response.BadRequest(w, "fcm_token is required")
		return
	}

	if err := h.service.RegisterDeviceToken(r.Context(), user.UserID, req.FCMToken, req.Platform); err != nil {
		response.InternalServerError(w, "failed to register device token")
		return
	}

	response.JSON(w, http.StatusOK, map[string]string{
		"status":  "ok",
		"message": "device token registered successfully",
	})
}

// UnregisterDeviceTokenRequest holds payload for token unregistration
type UnregisterDeviceTokenRequest struct {
	FCMToken string `json:"fcm_token"`
}

// UnregisterDeviceToken handles DELETE /api/v1/devices/token
func (h *Handler) UnregisterDeviceToken(w http.ResponseWriter, r *http.Request) {
	var req UnregisterDeviceTokenRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.BadRequest(w, "invalid request body")
		return
	}

	if err := h.service.UnregisterDeviceToken(r.Context(), req.FCMToken); err != nil {
		response.InternalServerError(w, "failed to unregister device token")
		return
	}

	response.JSON(w, http.StatusOK, map[string]string{
		"status":  "ok",
		"message": "device token unregistered successfully",
	})
}
