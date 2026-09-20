package school

import (
	"errors"
	"net/http"
	"strings"

	"edu-platform/internal/auth"
	"edu-platform/internal/response"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

// Handler handles HTTP requests for school domain
type Handler struct {
	service *Service
}

// NewHandler creates a new school Handler
func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

// CreateClass handles POST /api/v1/classes
func (h *Handler) CreateClass(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	user, ok := auth.UserFromContext(ctx)
	if !ok || user == nil {
		response.Unauthorized(w, "authentication required")
		return
	}

	var req CreateClassRequest
	if err := response.DecodeJSON(r, &req); err != nil {
		response.BadRequest(w, "invalid request body: "+err.Error())
		return
	}

	class, err := h.service.CreateClass(ctx, user.UserID, req)
	if err != nil {
		handleError(w, err)
		return
	}

	response.JSON(w, http.StatusCreated, class)
}

// GetClass handles GET /api/v1/classes/{id}
func (h *Handler) GetClass(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	classID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.BadRequest(w, "invalid class ID format")
		return
	}

	class, err := h.service.GetClass(ctx, classID)
	if err != nil {
		handleError(w, err)
		return
	}

	response.JSON(w, http.StatusOK, class)
}

// ListClasses handles GET /api/v1/classes
func (h *Handler) ListClasses(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	user, _ := auth.UserFromContext(ctx)

	var teacherID *uuid.UUID
	teacherParam := r.URL.Query().Get("teacher_id")
	if teacherParam != "" {
		tid, err := uuid.Parse(teacherParam)
		if err != nil {
			response.BadRequest(w, "invalid teacher_id format")
			return
		}
		teacherID = &tid
	} else if user != nil && user.Role == "teacher" {
		// Default to showing current teacher's classes unless specified
		teacherID = &user.UserID
	}

	classes, err := h.service.ListClasses(ctx, teacherID)
	if err != nil {
		handleError(w, err)
		return
	}

	response.JSON(w, http.StatusOK, classes)
}

// EnrollStudent handles POST /api/v1/classes/{id}/enroll
func (h *Handler) EnrollStudent(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	classID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.BadRequest(w, "invalid class ID format")
		return
	}

	var req EnrollStudentRequest
	if err := response.DecodeJSON(r, &req); err != nil {
		response.BadRequest(w, "invalid request body: "+err.Error())
		return
	}

	if req.StudentID == uuid.Nil {
		response.BadRequest(w, "student_id is required")
		return
	}

	if err := h.service.EnrollStudent(ctx, classID, req.StudentID); err != nil {
		handleError(w, err)
		return
	}

	response.JSON(w, http.StatusOK, map[string]any{
		"message":    "student enrolled successfully",
		"class_id":   classID,
		"student_id": req.StudentID,
	})
}

// ListStudents handles GET /api/v1/classes/{id}/students
func (h *Handler) ListStudents(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	classID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.BadRequest(w, "invalid class ID format")
		return
	}

	students, err := h.service.ListClassStudents(ctx, classID)
	if err != nil {
		handleError(w, err)
		return
	}

	response.JSON(w, http.StatusOK, students)
}

// BatchRecordAttendance handles POST /api/v1/classes/{id}/attendance
func (h *Handler) BatchRecordAttendance(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	classID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.BadRequest(w, "invalid class ID format")
		return
	}

	var req BatchAttendanceRequest
	if err := response.DecodeJSON(r, &req); err != nil {
		response.BadRequest(w, "invalid request body: "+err.Error())
		return
	}

	res, err := h.service.BatchRecordAttendance(ctx, classID, req)
	if err != nil {
		handleError(w, err)
		return
	}

	response.JSON(w, http.StatusOK, res)
}

// GetAttendanceRoster handles GET /api/v1/classes/{id}/attendance?date=YYYY-MM-DD
func (h *Handler) GetAttendanceRoster(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	classID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.BadRequest(w, "invalid class ID format")
		return
	}

	dateStr := strings.TrimSpace(r.URL.Query().Get("date"))
	if dateStr == "" {
		response.BadRequest(w, "missing required query parameter: date (format: YYYY-MM-DD)")
		return
	}

	roster, err := h.service.GetAttendanceRoster(ctx, classID, dateStr)
	if err != nil {
		handleError(w, err)
		return
	}

	response.JSON(w, http.StatusOK, roster)
}

// CreateAssignment handles POST /api/v1/classes/{id}/assignments
func (h *Handler) CreateAssignment(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	classID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.BadRequest(w, "invalid class ID format")
		return
	}

	var req CreateAssignmentRequest
	if err := response.DecodeJSON(r, &req); err != nil {
		response.BadRequest(w, "invalid request body: "+err.Error())
		return
	}

	assignment, err := h.service.CreateAssignment(ctx, classID, req)
	if err != nil {
		handleError(w, err)
		return
	}

	response.JSON(w, http.StatusCreated, assignment)
}

// ListAssignments handles GET /api/v1/classes/{id}/assignments
func (h *Handler) ListAssignments(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	classID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.BadRequest(w, "invalid class ID format")
		return
	}

	assignments, err := h.service.ListAssignments(ctx, classID)
	if err != nil {
		handleError(w, err)
		return
	}

	response.JSON(w, http.StatusOK, assignments)
}

// SubmitAssignment handles POST /api/v1/assignments/{id}/submissions
func (h *Handler) SubmitAssignment(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	user, ok := auth.UserFromContext(ctx)
	if !ok || user == nil {
		response.Unauthorized(w, "authentication required")
		return
	}

	assignmentID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.BadRequest(w, "invalid assignment ID format")
		return
	}

	var req SubmitAssignmentRequest
	_ = response.DecodeJSON(r, &req)

	if err := h.service.SubmitAssignment(ctx, assignmentID, user.UserID); err != nil {
		handleError(w, err)
		return
	}

	response.JSON(w, http.StatusOK, map[string]any{
		"message":       "assignment submitted successfully",
		"assignment_id": assignmentID,
		"student_id":    user.UserID,
	})
}

// GradeSubmission handles POST /api/v1/submissions/{id}/grade
func (h *Handler) GradeSubmission(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	submissionID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.BadRequest(w, "invalid submission ID format")
		return
	}

	var req GradeSubmissionRequest
	if err := response.DecodeJSON(r, &req); err != nil {
		response.BadRequest(w, "invalid request body: "+err.Error())
		return
	}

	if err := h.service.GradeSubmission(ctx, submissionID, req.Grade, req.Feedback); err != nil {
		handleError(w, err)
		return
	}

	response.JSON(w, http.StatusOK, map[string]any{
		"message":       "submission graded successfully",
		"submission_id": submissionID,
		"grade":         req.Grade,
		"feedback":      req.Feedback,
	})
}

// GetStudentOverview handles GET /api/v1/students/{id}/overview
func (h *Handler) GetStudentOverview(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	user, ok := auth.UserFromContext(ctx)
	if !ok || user == nil {
		response.Unauthorized(w, "authentication required")
		return
	}

	studentID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.BadRequest(w, "invalid student ID format")
		return
	}

	// RBAC rule: A student may only access their own overview
	if user.Role == "student" && user.UserID != studentID {
		response.Forbidden(w, "students may only view their own overview")
		return
	}

	overview, err := h.service.GetStudentOverview(ctx, studentID)
	if err != nil {
		handleError(w, err)
		return
	}

	response.JSON(w, http.StatusOK, overview)
}

func handleError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, ErrNotFound):
		response.NotFound(w, err.Error())
	case errors.Is(err, ErrBadRequest):
		response.BadRequest(w, err.Error())
	case errors.Is(err, ErrUnauthorized):
		response.Unauthorized(w, err.Error())
	case errors.Is(err, ErrForbidden):
		response.Forbidden(w, err.Error())
	case errors.Is(err, ErrConflict):
		response.Conflict(w, err.Error())
	default:
		response.InternalServerError(w, err.Error())
	}
}
