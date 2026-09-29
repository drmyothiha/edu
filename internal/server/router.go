package server

import (
	"net/http"
	"strings"
	"time"

	"edu-platform/internal/auth"
	"edu-platform/internal/copilot"
	"edu-platform/internal/notification"
	"edu-platform/internal/privacy"
	"edu-platform/internal/response"
	"edu-platform/internal/revocation"
	"edu-platform/internal/school"
	"edu-platform/internal/transcript"
	"edu-platform/internal/zkp"
	"github.com/go-chi/chi/v5"
	chimiddleware "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
)

// RouterConfig contains dependencies required to construct the HTTP router
type RouterConfig struct {
	AuthHandler         *auth.Handler
	AuthMiddleware      *auth.Middleware
	SchoolHandler       *school.Handler
	CopilotHandler      *copilot.Handler
	NotificationHandler *notification.Handler
	TranscriptHandler   *transcript.Handler
	PrivacyHandler      *privacy.Handler
	RevocationHandler   *revocation.Handler
	ZKPHandler          *zkp.Handler
}

// NewRouter constructs and configures the Chi router
func NewRouter(cfg RouterConfig) http.Handler {
	r := chi.NewRouter()

	// Base middlewares
	r.Use(chimiddleware.RequestID)
	r.Use(chimiddleware.RealIP)
	r.Use(chimiddleware.Logger)
	r.Use(chimiddleware.Recoverer)

	// Timeout middleware that skips SSE streaming endpoints
	r.Use(func(next http.Handler) http.Handler {
		timeoutHandler := chimiddleware.Timeout(60 * time.Second)(next)
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if strings.HasSuffix(r.URL.Path, "/notifications/stream") {
				next.ServeHTTP(w, r)
				return
			}
			timeoutHandler.ServeHTTP(w, r)
		})
	})

	// CORS configuration
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"https://*", "http://*"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token", "Cache-Control", "X-Requested-With"},
		ExposedHeaders:   []string{"Link", "Content-Type"},
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

	// Root service endpoint
	r.Get("/", func(w http.ResponseWriter, r *http.Request) {
		response.JSON(w, http.StatusOK, map[string]interface{}{
			"service":   "edu-platform-api",
			"status":    "running",
			"version":   "1.0.0",
			"time":      time.Now().UTC().Format(time.RFC3339),
			"endpoints": map[string]string{
				"health": "/health",
				"api_v1": "/api/v1",
			},
		})
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
		r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
			response.JSON(w, http.StatusOK, map[string]string{
				"status": "healthy",
				"time":   time.Now().UTC().Format(time.RFC3339),
			})
		})

		// Public Auth routes
		r.Route("/auth", func(r chi.Router) {
			r.Post("/login", cfg.AuthHandler.Login)
			r.Post("/register", cfg.AuthHandler.Register)

			// Authenticated auth routes
			r.Group(func(r chi.Router) {
				r.Use(cfg.AuthMiddleware.RequireAuth)
				r.Get("/me", cfg.AuthHandler.Me)
				r.Put("/profile", cfg.AuthHandler.UpdateProfile)
				r.Put("/password", cfg.AuthHandler.ChangePassword)
				r.Post("/avatar", cfg.AuthHandler.UploadAvatar)
			})
		})

		// Public Blockchain Verification Route (No authentication needed)
		r.Route("/blockchain", func(r chi.Router) {
			r.Get("/verify", cfg.SchoolHandler.VerifyStudentCredential)
		})

		// Public Transcript & Report Card Verification
		if cfg.TranscriptHandler != nil {
			r.Route("/transcripts", func(r chi.Router) {
				r.Get("/verify", cfg.TranscriptHandler.VerifyReportCard)
				r.Get("/report-cards/{id}", cfg.TranscriptHandler.GetReportCard)
			})
		}

		// Public W3C Credential Revocation Status & Status Lists
		if cfg.RevocationHandler != nil {
			r.Route("/credentials", func(r chi.Router) {
				r.Get("/revocation-status", cfg.RevocationHandler.CheckStatus)
				r.Get("/status-list", cfg.RevocationHandler.GetStatusListCredential)
			})
		}

		// Public Zero-Knowledge Proof (ZKP) Verifier Endpoints
		if cfg.ZKPHandler != nil {
			r.Route("/zkp", func(r chi.Router) {
				r.Post("/verify-disclosure", cfg.ZKPHandler.VerifyDisclosure)
				r.Post("/verify-predicate", cfg.ZKPHandler.VerifyPredicate)
			})
		}

		// Public Privacy & Retention Policies
		if cfg.PrivacyHandler != nil {
			r.Route("/privacy", func(r chi.Router) {
				r.Get("/policies", cfg.PrivacyHandler.GetPolicies)
			})
		}

		// Gate Kiosk Offline Roster & Attendance Sync (Edge kiosk accessible)
		r.Route("/gate", func(r chi.Router) {
			r.Get("/roster", cfg.SchoolHandler.GetGateRoster)
			r.Post("/sync-batch", cfg.SchoolHandler.SyncAttendanceBatch)
			r.Post("/pair/init", cfg.SchoolHandler.InitGatePairing)
			r.Get("/pair/status", cfg.SchoolHandler.GetGatePairingStatus)
		})
		r.Route("/attendance", func(r chi.Router) {
			r.Post("/sync-batch", cfg.SchoolHandler.SyncAttendanceBatch)
		})

		// Protected endpoints (RequireAuth)
		r.Group(func(r chi.Router) {
			r.Use(cfg.AuthMiddleware.RequireAuth)

			// Gate Kiosk Device Pairing confirmation (School Admin / Admin)
			r.Post("/gate/pair/confirm", cfg.SchoolHandler.ConfirmGatePairing)

			// SysAdmin Layer-2 Anchor Batch Trigger
			r.Group(func(adminOnly chi.Router) {
				adminOnly.Use(cfg.AuthMiddleware.RequireRoles("sysadmin", "admin"))
				adminOnly.Post("/blockchain/anchor-batch", cfg.SchoolHandler.BatchAnchorCredentials)
			})

			// Schools / Facilities (Multi-tenant management)
			r.Route("/schools", func(r chi.Router) {
				r.Group(func(adminOnly chi.Router) {
					adminOnly.Use(cfg.AuthMiddleware.RequireRoles("sysadmin", "school_admin", "admin"))
					adminOnly.Get("/", cfg.SchoolHandler.ListSchools)
					adminOnly.Get("/{id}", cfg.SchoolHandler.GetSchool)
					adminOnly.Get("/{id}/faculty", cfg.SchoolHandler.ListSchoolFaculty)
					adminOnly.Get("/{id}/teachers", cfg.SchoolHandler.ListSchoolFaculty)
					adminOnly.Post("/{id}/teachers", cfg.SchoolHandler.CreateTeacher)
					adminOnly.Put("/{id}/teachers/{teacherId}", cfg.SchoolHandler.UpdateTeacher)
					adminOnly.Delete("/{id}/teachers/{teacherId}", cfg.SchoolHandler.DeleteTeacher)
					adminOnly.Get("/{id}/students", cfg.SchoolHandler.ListSchoolStudents)
					adminOnly.Post("/{id}/students", cfg.SchoolHandler.CreateSchoolStudent)
					adminOnly.Delete("/{id}/students/{studentId}", cfg.SchoolHandler.DeleteStudent)
					adminOnly.Post("/{id}/seed-default-classes", cfg.SchoolHandler.SeedDefaultClasses)
					adminOnly.Post("/{id}/seed-sample-students", cfg.SchoolHandler.SeedSampleStudents)
					adminOnly.Get("/{id}/shift-config", cfg.SchoolHandler.GetSchoolShiftConfig)
					adminOnly.Put("/{id}/shift-config", cfg.SchoolHandler.SaveSchoolShiftConfig)
				})
				r.Group(func(sysOnly chi.Router) {
					sysOnly.Use(cfg.AuthMiddleware.RequireRoles("sysadmin", "admin"))
					sysOnly.Post("/", cfg.SchoolHandler.CreateSchool)
				})
			})

			// Direct Teacher CRUD endpoints
			r.Route("/teachers", func(r chi.Router) {
				r.Use(cfg.AuthMiddleware.RequireRoles("sysadmin", "school_admin", "admin"))
				r.Put("/{id}", cfg.SchoolHandler.UpdateTeacher)
				r.Delete("/{id}", cfg.SchoolHandler.DeleteTeacher)
			})

			// MIMU Place Codes (Administrative Divisions)
			r.Route("/pcodes", func(r chi.Router) {
				r.Get("/states", cfg.SchoolHandler.ListStateRegions)
				r.Get("/townships", cfg.SchoolHandler.ListTownships)
				r.Get("/wards", cfg.SchoolHandler.ListWards)
				r.Get("/search", cfg.SchoolHandler.SearchPCodes)
			})

			// Copilot routes (Teacher/Admin only)
			r.Route("/copilot", func(r chi.Router) {
				r.Use(cfg.AuthMiddleware.RequireRoles("teacher", "school_admin", "admin", "sysadmin"))
				r.Post("/lesson-plan", cfg.CopilotHandler.GenerateLessonPlan)
				r.Get("/lesson-plans", cfg.CopilotHandler.ListLessonPlans)
				r.Get("/lesson-plan/{id}", cfg.CopilotHandler.GetLessonPlan)
				r.Post("/lesson-plan/{id}/translate", cfg.CopilotHandler.TranslateLessonPlan)
				r.Post("/lesson-plans/{id}/translate", cfg.CopilotHandler.TranslateLessonPlan)
			})

			// Classes & Attendance & Assignments
			r.Route("/classes", func(r chi.Router) {
				// All authenticated users can list classes and get details
				r.Get("/", cfg.SchoolHandler.ListClasses)
				r.Get("/{id}", cfg.SchoolHandler.GetClass)
				r.Get("/{id}/students", cfg.SchoolHandler.ListStudents)
				r.Get("/{id}/assignments", cfg.SchoolHandler.ListAssignments)
				r.Get("/{id}/announcements", cfg.SchoolHandler.ListClassAnnouncements)
				r.Get("/{id}/timetable", cfg.SchoolHandler.GetClassTimetable)

				// Teacher/Admin actions
				r.Group(func(r chi.Router) {
					r.Use(cfg.AuthMiddleware.RequireRoles("teacher", "school_admin", "admin", "sysadmin"))
					r.Post("/", cfg.SchoolHandler.CreateClass)
					r.Post("/seed-default", cfg.SchoolHandler.SeedDefaultClasses)
					r.Delete("/{id}", cfg.SchoolHandler.DeleteClass)
					r.Post("/{id}/enroll", cfg.SchoolHandler.EnrollStudent)
					r.Post("/{id}/attendance", cfg.SchoolHandler.BatchRecordAttendance)
					r.Get("/{id}/attendance", cfg.SchoolHandler.GetAttendanceRoster)
					r.Post("/{id}/assignments", cfg.SchoolHandler.CreateAssignment)
					r.Post("/{id}/announcements", cfg.SchoolHandler.CreateAnnouncement)
					r.Get("/{id}/whole-child-profiles", cfg.SchoolHandler.ListClassWholeChildProfiles)
					r.Post("/{id}/whole-child-profiles", cfg.SchoolHandler.BatchSaveClassWholeChildProfiles)
					r.Get("/{id}/exam-marks", cfg.SchoolHandler.GetExamMarksRoster)
					r.Post("/{id}/exam-marks", cfg.SchoolHandler.BatchRecordExamMarks)
					r.Get("/{id}/exams", cfg.SchoolHandler.ListClassExams)
					r.Put("/{id}/timetable", cfg.SchoolHandler.UpdateClassTimetable)
					r.Post("/{id}/timetable/publish", cfg.SchoolHandler.PublishClassTimetable)
				})
			})

			// Direct Messaging & Conversations (Parent, Teacher, School Admin, Sysadmin)
			r.Route("/conversations", func(r chi.Router) {
				r.Use(cfg.AuthMiddleware.RequireRoles("teacher", "parent", "school_admin", "admin", "sysadmin"))
				r.Get("/", cfg.SchoolHandler.ListConversations)
				r.Post("/", cfg.SchoolHandler.CreateConversation)
				r.Get("/{id}", cfg.SchoolHandler.GetConversation)
				r.Get("/{id}/messages", cfg.SchoolHandler.ListMessages)
				r.Post("/{id}/messages", cfg.SchoolHandler.SendMessage)
			})

			// User Notifications Hub (All Authenticated Users)
			r.Route("/notifications", func(r chi.Router) {
				r.Get("/", cfg.SchoolHandler.ListNotifications)
				if cfg.NotificationHandler != nil {
					r.Get("/stream", cfg.NotificationHandler.Stream)
				}
				r.Post("/{id}/read", cfg.SchoolHandler.MarkNotificationRead)
				r.Post("/read-all", cfg.SchoolHandler.MarkAllNotificationsRead)
			})

			// Device Tokens for FCM Push Notifications
			if cfg.NotificationHandler != nil {
				r.Route("/devices", func(r chi.Router) {
					r.Post("/token", cfg.NotificationHandler.RegisterDeviceToken)
					r.Delete("/token", cfg.NotificationHandler.UnregisterDeviceToken)
				})
			}

			// Offline Batch Sync Routes (Teacher, School Admin, Sysadmin)
			r.Route("/sync", func(r chi.Router) {
				r.Use(cfg.AuthMiddleware.RequireRoles("teacher", "school_admin", "admin", "sysadmin"))
				r.Post("/whole-child-batch", cfg.SchoolHandler.IngestWholeChildBatch)
				r.Get("/batches", cfg.SchoolHandler.ListSyncBatches)
			})

			// Student overview & blockchain ID (Parent, Student, Teacher, School Admin, Sysadmin)
			r.Route("/students", func(r chi.Router) {
				r.Use(cfg.AuthMiddleware.RequireRoles("student", "parent", "teacher", "school_admin", "admin", "sysadmin"))
				r.Get("/me/timetable", cfg.SchoolHandler.GetStudentTimetable)
				r.Get("/{id}/timetable", cfg.SchoolHandler.GetStudentTimetable)
				r.Get("/{id}", cfg.SchoolHandler.GetStudentDetail)
				r.Get("/{id}/overview", cfg.SchoolHandler.GetStudentOverview)
				r.Get("/{id}/blockchain-id", cfg.SchoolHandler.GetStudentBlockchainID)
				r.Get("/{id}/whole-child-profile", cfg.SchoolHandler.GetStudentWholeChildProfile)
				r.Delete("/{id}", cfg.SchoolHandler.DeleteStudent)
			})

			// Parents & Children (Parent, Teacher, School Admin, Sysadmin)
			r.Route("/parents", func(r chi.Router) {
				r.Use(cfg.AuthMiddleware.RequireRoles("parent", "student", "teacher", "school_admin", "admin", "sysadmin"))
				r.Get("/my-children", cfg.SchoolHandler.ListParentChildren)
				r.Get("/announcements", cfg.SchoolHandler.ListParentAnnouncements)
				r.Get("/{id}/children", cfg.SchoolHandler.ListParentChildren)
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
					r.Use(cfg.AuthMiddleware.RequireRoles("teacher", "school_admin", "admin", "sysadmin"))
					r.Post("/{id}/grade", cfg.SchoolHandler.GradeSubmission)
				})
			})

			// Transcript & Report Card Compilation (Teacher, School Admin, Sysadmin)
			if cfg.TranscriptHandler != nil {
				r.Route("/transcripts/manage", func(r chi.Router) {
					r.Use(cfg.AuthMiddleware.RequireRoles("teacher", "school_admin", "admin", "sysadmin"))
					r.Post("/compile-sample", cfg.TranscriptHandler.CompileSampleReportCard)
				})
			}

			// Credential Revocation Operations (School Admin, Sysadmin)
			if cfg.RevocationHandler != nil {
				r.Route("/credentials/manage", func(r chi.Router) {
					r.Use(cfg.AuthMiddleware.RequireRoles("school_admin", "admin", "sysadmin"))
					r.Post("/revoke", cfg.RevocationHandler.Revoke)
				})
			}

			// Privacy & Right-to-be-Forgotten Operations
			if cfg.PrivacyHandler != nil {
				r.Route("/privacy/manage", func(r chi.Router) {
					// Students/Parents/Admins can request erasure
					r.Post("/erasure-requests", cfg.PrivacyHandler.RequestErasure)
					r.Get("/erasure-requests/{id}", cfg.PrivacyHandler.GetErasureRequest)

					// Only sysadmin/admin can audit logs
					r.Group(func(adminOnly chi.Router) {
						adminOnly.Use(cfg.AuthMiddleware.RequireRoles("sysadmin", "admin"))
						adminOnly.Get("/audit-logs", cfg.PrivacyHandler.GetAuditLogs)
					})
				})
			}
		})
	})

	return r
}
