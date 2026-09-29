package revocation

import (
	"encoding/json"
	"net/http"

	"edu-platform/internal/response"
)

type Handler struct {
	registry *Registry
}

func NewHandler(registry *Registry) *Handler {
	return &Handler{registry: registry}
}

// CheckStatus handles GET /api/v1/credentials/revocation-status?hash=0x...
func (h *Handler) CheckStatus(w http.ResponseWriter, r *http.Request) {
	hash := r.URL.Query().Get("hash")
	if hash == "" {
		response.Error(w, http.StatusBadRequest, "credential hash query parameter required")
		return
	}

	result, err := h.registry.CheckStatus(hash)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, err.Error())
		return
	}

	response.JSON(w, http.StatusOK, result)
}

// Revoke handles POST /api/v1/credentials/revoke
func (h *Handler) Revoke(w http.ResponseWriter, r *http.Request) {
	var body struct {
		CredentialHash string `json:"credential_hash"`
		Reason         string `json:"reason"`
		Details        string `json:"details"`
	}

	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		response.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if body.CredentialHash == "" {
		response.Error(w, http.StatusBadRequest, "credential_hash is required")
		return
	}

	reason := ReasonCode(body.Reason)
	if reason == "" {
		reason = ReasonErroneousIssuance
	}

	record, err := h.registry.RevokeCredential(r.Context(), body.CredentialHash, reason, body.Details, nil)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, err.Error())
		return
	}

	response.JSON(w, http.StatusOK, record)
}

// GetStatusListCredential handles GET /api/v1/credentials/status-list
func (h *Handler) GetStatusListCredential(w http.ResponseWriter, r *http.Request) {
	cred, err := h.registry.ExportStatusListCredential()
	if err != nil {
		response.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	response.JSON(w, http.StatusOK, cred)
}
