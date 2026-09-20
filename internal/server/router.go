package server

import (
	"net/http"
	"time"

	"edu-platform/internal/auth"
	"edu-platform/internal/copilot"
	"edu-platform/internal/response"
	"edu-platform/internal/school"
	"github.com/go-chi/chi/v5"
	chimiddleware "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
)

// RouterConfig contains dependencies required to construct the HTTP router
type RouterConfig struct {
	AuthHandler    *auth.Handler
	AuthMiddleware *auth.Middleware
	SchoolHandler  *school.Handler
	CopilotHandler *copilot.Handler
}

// NewRouter constructs and configures the Chi router
func NewRouter(cfg RouterConfig) http.Handler {
	r := chi.NewRouter()

	// Base middlewares
	r.Use(chimiddleware.RequestID)
	r.Use(chimiddleware.RealIP)
	r.Use(chimiddleware.Logger)
	r.Use(chimiddleware.Recoverer)
	r.Use(chimiddleware.Timeout(60 * time.Second))

	// CORS configuration
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"https://*", "http://*"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	// Standard error formatting for 404 & 405
	r.NotFound(func(w http.ResponseWriter, r *http.Request) {
		response.NotFound(w, "resource not found")
	})
	r.MethodNotAllowed(func(w http.ResponseWriter, r *http.Request) {
		response.Error(w, http.StatusMethodNotAllowed, "method not allowed")
	})

	// Health check endpoint
	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		response.JSON(w, http.StatusOK, map[string]string{
			"status": "ok",
			"time":   time.Now().UTC().Format(time.RFC3339),
		})
	})

	// API v1 routes
	r.Route("/api/v1", func(r chi.Router) {
		// Public Auth routes
		r.Route("/auth", func(r chi.Router) {
			r.Post("/login", cfg.AuthHandler.Login)
			r.Post("/register", cfg.AuthHandler.Register)

			// Authenticated auth routes
			r.Group(func(r chi.Router) {
				r.Use(cfg.AuthMiddleware.RequireAuth)
				r.Get("/me", cfg.AuthHandler.Me)
			})
		})

		// Protected endpoints (RequireAuth)
		r.Group(func(r chi.Router) {
			r.Use(cfg.AuthMiddleware.RequireAuth)

			// Copilot routes (Teacher/Admin only)
			r.Route("/copilot", func(r chi.Router) {
				r.Use(cfg.AuthMiddleware.RequireRoles("teacher", "admin"))
				r.Post("/lesson-plan", cfg.CopilotHandler.GenerateLessonPlan)
				r.Get("/lesson-plans", cfg.CopilotHandler.ListLessonPlans)
				r.Get("/lesson-plan/{id}", cfg.CopilotHandler.GetLessonPlan)
			})

			// Classes & Attendance & Assignments
			r.Route("/classes", func(r chi.Router) {
				// All authenticated users can list classes and get details
				r.Get("/", cfg.SchoolHandler.ListClasses)
				r.Get("/{id}", cfg.SchoolHandler.GetClass)
				r.Get("/{id}/students", cfg.SchoolHandler.ListStudents)
				r.Get("/{id}/assignments", cfg.SchoolHandler.ListAssignments)

				// Teacher/Admin actions
				r.Group(func(r chi.Router) {
					r.Use(cfg.AuthMiddleware.RequireRoles("teacher", "admin"))
					r.Post("/", cfg.SchoolHandler.CreateClass)
					r.Post("/{id}/enroll", cfg.SchoolHandler.EnrollStudent)
					r.Post("/{id}/attendance", cfg.SchoolHandler.BatchRecordAttendance)
					r.Get("/{id}/attendance", cfg.SchoolHandler.GetAttendanceRoster)
					r.Post("/{id}/assignments", cfg.SchoolHandler.CreateAssignment)
				})
			})

			// Student overview (Parent, Student, Teacher, Admin)
			r.Route("/students", func(r chi.Router) {
				r.Use(cfg.AuthMiddleware.RequireRoles("student", "parent", "teacher", "admin"))
				r.Get("/{id}/overview", cfg.SchoolHandler.GetStudentOverview)
			})

			// Assignment submissions (Student)
			r.Route("/assignments", func(r chi.Router) {
				r.Group(func(r chi.Router) {
					r.Use(cfg.AuthMiddleware.RequireRoles("student"))
					r.Post("/{id}/submit", cfg.SchoolHandler.SubmitAssignment)
				})
			})

			// Submission grading (Teacher, Admin)
			r.Route("/submissions", func(r chi.Router) {
				r.Group(func(r chi.Router) {
					r.Use(cfg.AuthMiddleware.RequireRoles("teacher", "admin"))
					r.Post("/{id}/grade", cfg.SchoolHandler.GradeSubmission)
				})
			})
		})
	})

	return r
}
