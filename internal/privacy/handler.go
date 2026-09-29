package privacy

import (
	"encoding/json"
	"net/http"

	"edu-platform/internal/response"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

// RequestErasure handles POST /api/v1/privacy/erasure-requests
func (h *Handler) RequestErasure(w http.ResponseWriter, r *http.Request) {
	var body struct {
		StudentID   string `json:"student_id"`
		OriginalDID string `json:"original_did"`
		SchoolID    string `json:"school_id"`
		RequestType string `json:"request_type"` // "FullErasure" or "DeIdentifyAnalytics"
		LegalBasis  string `json:"legal_basis"`
		Reason      string `json:"reason"`
	}

	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		response.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}

	stuUUID, err := uuid.Parse(body.StudentID)
	if err != nil {
		response.Error(w, http.StatusBadRequest, "invalid student_id uuid")
		return
	}

	var schoolUUID *uuid.UUID
	if sID, err := uuid.Parse(body.SchoolID); err == nil {
		schoolUUID = &sID
	}

	reqType := RequestType(body.RequestType)
	if reqType == "" {
		reqType = RequestTypeDeIdentifyAnalytics
	}

	req, err := h.service.SubmitErasureRequest(
		r.Context(),
		stuUUID,
		body.OriginalDID,
		schoolUUID,
		nil,
		reqType,
		body.LegalBasis,
		body.Reason,
	)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, err.Error())
		return
	}

	response.JSON(w, http.StatusAccepted, req)
}

// GetAuditLogs handles GET /api/v1/privacy/audit-logs
func (h *Handler) GetAuditLogs(w http.ResponseWriter, r *http.Request) {
	logs := h.service.GetAuditLogs()
	response.JSON(w, http.StatusOK, map[string]interface{}{
		"total": logs,
	})
}

// GetPolicies handles GET /api/v1/privacy/policies
func (h *Handler) GetPolicies(w http.ResponseWriter, r *http.Request) {
	policies := h.service.GetPolicies()
	response.JSON(w, http.StatusOK, map[string]interface{}{
		"policies": policies,
	})
}

// GetErasureRequest handles GET /api/v1/privacy/erasure-requests/{id}
func (h *Handler) GetErasureRequest(w http.ResponseWriter, r *http.Request) {
	idParam := chi.URLParam(r, "id")
	id, err := uuid.Parse(idParam)
	if err != nil {
		response.Error(w, http.StatusBadRequest, "invalid erasure request uuid")
		return
	}

	req, err := h.service.GetErasureRequest(id)
	if err != nil {
		response.NotFound(w, "erasure request not found")
		return
	}

	response.JSON(w, http.StatusOK, req)
}

