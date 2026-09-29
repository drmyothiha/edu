package copilot

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"edu-platform/internal/auth"
	"edu-platform/internal/response"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

// Handler handles HTTP and SSE requests for copilot endpoints
type Handler struct {
	service *Service
}

// NewHandler creates a new Copilot Handler
func NewHandler(service *Service) *Handler {
	return &Handler{
		service: service,
	}
}

// Routes sets up the routes for copilot endpoints
func (h *Handler) Routes(authMiddleware *auth.Middleware) http.Handler {
	r := chi.NewRouter()

	// All copilot routes require authentication and teacher/admin/sysadmin role
	r.Use(authMiddleware.RequireAuth)
	r.Use(authMiddleware.RequireRoles("teacher", "school_admin", "admin", "sysadmin"))

	// 1. RAG Generation endpoints (Sync & SSE Streaming)
	r.Post("/lesson-plan", h.GenerateLessonPlan)
	r.Post("/lesson-plan/stream", h.GenerateLessonPlanStream)
	r.Get("/lesson-plan/stream", h.GenerateLessonPlanStream)

	// 2. Curriculum Retrieval Inspection
	r.Get("/curriculum", h.ListCurriculum)

	// 3. Lesson Plans Library
	r.Get("/lesson-plans", h.ListLessonPlans)
	r.Get("/lesson-plans/{id}", h.GetLessonPlan)
	r.Get("/lesson-plan/{id}", h.GetLessonPlan)
	r.Delete("/lesson-plans/{id}", h.DeleteLessonPlan)
	r.Delete("/lesson-plan/{id}", h.DeleteLessonPlan)
	r.Post("/lesson-plans/{id}/translate", h.TranslateLessonPlan)
	r.Post("/lesson-plan/{id}/translate", h.TranslateLessonPlan)

	return r
}

// GenerateLessonPlan handles POST /api/v1/copilot/lesson-plan (Synchronous RAG execution)
func (h *Handler) GenerateLessonPlan(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	user, ok := auth.UserFromContext(ctx)
	if !ok || user == nil {
		response.Unauthorized(w, "authentication required")
		return
	}

	var req LessonPlanPromptRequest
	if err := response.DecodeJSON(r, &req); err != nil {
		response.BadRequest(w, "invalid request body: "+err.Error())
		return
	}

	plan, err := h.service.GenerateLessonPlan(ctx, user.UserID, req)
	if err != nil {
		response.InternalServerError(w, err.Error())
		return
	}

	response.JSON(w, http.StatusCreated, plan)
}

// GenerateLessonPlanStream handles SSE streaming for the 7-step RAG pipeline
// Supports POST with JSON body or GET with query params
func (h *Handler) GenerateLessonPlanStream(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	user, ok := auth.UserFromContext(ctx)
	if !ok || user == nil {
		response.Unauthorized(w, "authentication required")
		return
	}

	var req LessonPlanPromptRequest
	if r.Method == http.MethodPost {
		if err := response.DecodeJSON(r, &req); err != nil {
			response.BadRequest(w, "invalid request body: "+err.Error())
			return
		}
	} else {
		req.Subject = r.URL.Query().Get("subject")
		req.GradeLevel = r.URL.Query().Get("grade_level")
		req.Topic = r.URL.Query().Get("topic")
		durStr := r.URL.Query().Get("duration_minutes")
		if dur, err := strconv.Atoi(durStr); err == nil && dur > 0 {
			req.DurationMinutes = dur
		} else {
			req.DurationMinutes = 45
		}
	}

	flusher, ok := w.(http.Flusher)
	if !ok {
		response.InternalServerError(w, "streaming unsupported by server")
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache, no-transform")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")

	emit := func(eventType string, data any) error {
		b, err := json.Marshal(data)
		if err != nil {
			return err
		}
		_, writeErr := fmt.Fprintf(w, "event: %s\ndata: %s\n\n", eventType, string(b))
		if writeErr != nil {
			return writeErr
		}
		flusher.Flush()
		return nil
	}

	_, _ = h.service.GenerateLessonPlanStream(ctx, user.UserID, req, emit)
}

// ListCurriculum handles GET /api/v1/copilot/curriculum
func (h *Handler) ListCurriculum(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	subject := r.URL.Query().Get("subject")
	grade := r.URL.Query().Get("grade_level")

	if subject == "" {
		subject = "Mathematics"
	}
	if grade == "" {
		grade = "Grade 5"
	}

	chunks, err := h.service.ListCurriculumStandards(ctx, subject, grade)
	if err != nil {
		response.InternalServerError(w, err.Error())
		return
	}

	response.JSON(w, http.StatusOK, chunks)
}

// ListLessonPlans handles GET /api/v1/copilot/lesson-plans
func (h *Handler) ListLessonPlans(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	user, ok := auth.UserFromContext(ctx)
	if !ok || user == nil {
		response.Unauthorized(w, "authentication required")
		return
	}

	plans, err := h.service.ListLessonPlansByTeacher(ctx, user.UserID)
	if err != nil {
		response.InternalServerError(w, err.Error())
		return
	}

	response.JSON(w, http.StatusOK, plans)
}

// GetLessonPlan handles GET /api/v1/copilot/lesson-plans/{id}
func (h *Handler) GetLessonPlan(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		response.BadRequest(w, "invalid lesson plan ID format")
		return
	}

	plan, err := h.service.GetLessonPlan(ctx, id)
	if err != nil {
		if errors.Is(err, errors.New("lesson plan not found")) || strings.Contains(err.Error(), "not found") {
			response.NotFound(w, "lesson plan not found")
			return
		}
		response.InternalServerError(w, err.Error())
		return
	}

	user, _ := auth.UserFromContext(ctx)
	if user != nil && user.Role != "admin" && user.Role != "sysadmin" && user.UserID != plan.TeacherID {
		response.Forbidden(w, "access denied to this lesson plan")
		return
	}

	response.JSON(w, http.StatusOK, plan)
}

// TranslateLessonPlan handles POST /api/v1/copilot/lesson-plan/{id}/translate
func (h *Handler) TranslateLessonPlan(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	user, ok := auth.UserFromContext(ctx)
	if !ok || user == nil {
		response.Unauthorized(w, "authentication required")
		return
	}

	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		response.BadRequest(w, "invalid lesson plan ID format")
		return
	}

	plan, err := h.service.TranslateLessonPlan(ctx, id)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			response.NotFound(w, "lesson plan not found")
			return
		}
		response.InternalServerError(w, err.Error())
		return
	}

	response.JSON(w, http.StatusOK, plan)
}

// DeleteLessonPlan handles DELETE /api/v1/copilot/lesson-plans/{id}
func (h *Handler) DeleteLessonPlan(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	user, ok := auth.UserFromContext(ctx)
	if !ok || user == nil {
		response.Unauthorized(w, "authentication required")
		return
	}

	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		response.BadRequest(w, "invalid lesson plan ID format")
		return
	}

	if err := h.service.DeleteLessonPlan(ctx, id, user.UserID, user.Role); err != nil {
		if strings.Contains(err.Error(), "not found") {
			response.NotFound(w, "lesson plan not found")
			return
		}
		if strings.Contains(err.Error(), "access denied") {
			response.Forbidden(w, err.Error())
			return
		}
		response.InternalServerError(w, err.Error())
		return
	}

	response.JSON(w, http.StatusOK, map[string]string{
		"message": "Lesson plan deleted successfully",
		"id":      id.String(),
	})
}
