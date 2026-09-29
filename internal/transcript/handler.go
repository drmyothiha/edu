package transcript

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

// GetReportCard handles GET /api/v1/transcripts/report-cards/{id}
func (h *Handler) GetReportCard(w http.ResponseWriter, r *http.Request) {
	idParam := chi.URLParam(r, "id")
	id, err := uuid.Parse(idParam)
	if err != nil {
		response.Error(w, http.StatusBadRequest, "invalid report card uuid")
		return
	}

	card, err := h.service.GetReportCard(id)
	if err != nil {
		response.NotFound(w, "report card not found")
		return
	}

	response.JSON(w, http.StatusOK, card)
}

// VerifyReportCard handles GET /api/v1/transcripts/verify?hash=0x...
func (h *Handler) VerifyReportCard(w http.ResponseWriter, r *http.Request) {
	hash := r.URL.Query().Get("hash")
	if hash == "" {
		response.Error(w, http.StatusBadRequest, "verification hash parameter required")
		return
	}

	card, valid := h.service.VerifyReportCard(hash)
	if !valid {
		response.JSON(w, http.StatusOK, map[string]interface{}{
			"valid":   false,
			"message": "no authentic transcript found matching this cryptographic hash",
		})
		return
	}

	response.JSON(w, http.StatusOK, map[string]interface{}{
		"valid":       true,
		"report_card": card,
	})
}

// CompileSampleReportCard handles POST /api/v1/transcripts/compile-sample
func (h *Handler) CompileSampleReportCard(w http.ResponseWriter, r *http.Request) {
	var req struct {
		StudentID     string             `json:"student_id"`
		StudentDID    string             `json:"student_did"`
		NameEN        string             `json:"name_en"`
		NameMM        string             `json:"name_mm"`
		RollNumber    string             `json:"roll_number"`
		SchoolID      string             `json:"school_id"`
		SchoolNameEN  string             `json:"school_name_en"`
		SchoolNameMM  string             `json:"school_name_mm"`
		SchoolCode    string             `json:"school_code"`
		AcademicYear  string             `json:"academic_year"`
		Term          string             `json:"term"`
		GradeLevel    string             `json:"grade_level"`
		Scores        map[string]float64 `json:"scores"`
		Remarks       map[string]string  `json:"remarks"`
		Rank          int                `json:"rank"`
		TotalStudents int                `json:"total_students"`
		PresentDays   int                `json:"present_days"`
		TotalDays     int                `json:"total_days"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}

	studentID, _ := uuid.Parse(req.StudentID)
	if studentID == uuid.Nil {
		studentID = uuid.New()
	}
	schoolID, _ := uuid.Parse(req.SchoolID)
	if schoolID == uuid.Nil {
		schoolID = uuid.New()
	}

	card, err := h.service.GenerateAndStoreReportCard(
		r.Context(),
		studentID, req.StudentDID, req.NameEN, req.NameMM, req.RollNumber,
		schoolID, req.SchoolNameEN, req.SchoolNameMM, req.SchoolCode,
		req.AcademicYear, req.Term, req.GradeLevel,
		req.Scores, req.Remarks,
		req.Rank, req.TotalStudents,
		req.PresentDays, req.TotalDays,
		nil,
	)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, err.Error())
		return
	}

	response.JSON(w, http.StatusCreated, card)
}
