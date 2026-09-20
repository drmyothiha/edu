package copilot

import (
	"errors"
	"net/http"
	"strings"

	"edu-platform/internal/auth"
	"edu-platform/internal/response"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

// Handler handles HTTP requests for copilot endpoints
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

	// All copilot routes require authentication and teacher or admin role
	r.Use(authMiddleware.RequireAuth)
	r.Use(authMiddleware.RequireRoles("teacher", "admin"))

	r.Post("/lesson-plan", h.GenerateLessonPlan)
	r.Get("/lesson-plans", h.ListLessonPlans)
	r.Get("/lesson-plans/{id}", h.GetLessonPlan)

	return r
}

// GenerateLessonPlan handles POST /api/v1/copilot/lesson-plan
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

	req.Subject = strings.TrimSpace(req.Subject)
	req.GradeLevel = strings.TrimSpace(req.GradeLevel)
	req.Topic = strings.TrimSpace(req.Topic)

	if req.Subject == "" {
		response.BadRequest(w, "subject is required")
		return
	}
	if req.GradeLevel == "" {
		response.BadRequest(w, "grade_level is required")
		return
	}
	if req.Topic == "" {
		response.BadRequest(w, "topic is required")
		return
	}

	plan, err := h.service.GenerateLessonPlan(ctx, user.UserID, req)
	if err != nil {
		response.InternalServerError(w, err.Error())
		return
	}

	response.JSON(w, http.StatusCreated, plan)
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
	if user != nil && user.Role != "admin" && user.UserID != plan.TeacherID {
		response.Forbidden(w, "access denied to this lesson plan")
		return
	}

	response.JSON(w, http.StatusOK, plan)
}
