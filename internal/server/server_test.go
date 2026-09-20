package server_test

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"edu-platform/internal/auth"
	"edu-platform/internal/copilot"
	"edu-platform/internal/database"
	"edu-platform/internal/response"
	"edu-platform/internal/school"
	"edu-platform/internal/server"

	"github.com/google/uuid"
)

func setupTestApp(t *testing.T) (http.Handler, *database.Queries, string, string, string, string, uuid.UUID, uuid.UUID, uuid.UUID) {
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		dbURL = "postgres://postgres:postgres@localhost:5432/edu_db?sslmode=disable"
	}

	ctx := context.Background()
	pool, err := database.NewPool(ctx, dbURL)
	if err != nil {
		t.Skipf("skipping integration tests; postgres unavailable: %v", err)
	}

	// Apply migrations
	_ = database.RunMigrations(ctx, pool, "../../db/migrations")

	queries := database.New(pool)
	jwtManager := auth.NewJWTManager("test-secret-key-at-least-32-chars-long!", 24*time.Hour, "edu-test")
	authMiddleware := auth.NewMiddleware(jwtManager)

	authService := auth.NewService(queries, jwtManager)
	authHandler := auth.NewHandler(authService)

	llmClient := copilot.NewMockLLMClient()
	copilotService := copilot.NewService(queries, llmClient)
	copilotHandler := copilot.NewHandler(copilotService)

	schoolService := school.NewService(queries)
	schoolHandler := school.NewHandler(schoolService)

	router := server.NewRouter(server.RouterConfig{
		AuthHandler:    authHandler,
		AuthMiddleware: authMiddleware,
		SchoolHandler:  schoolHandler,
		CopilotHandler: copilotHandler,
	})

	// Create unique users for test
	unique := uuid.New().String()[:8]
	passHash, _ := auth.HashPassword("TestPass123!")

	teacher, err := queries.CreateUser(ctx, database.CreateUserParams{
		Email:        fmt.Sprintf("teacher_%s@edu.local", unique),
		PasswordHash: passHash,
		FullName:     "Test Teacher",
		Role:         "teacher",
	})
	if err != nil {
		t.Fatalf("failed to create test teacher: %v", err)
	}

	student1, err := queries.CreateUser(ctx, database.CreateUserParams{
		Email:        fmt.Sprintf("student1_%s@edu.local", unique),
		PasswordHash: passHash,
		FullName:     "Test Student 1",
		Role:         "student",
	})
	if err != nil {
		t.Fatalf("failed to create test student 1: %v", err)
	}

	student2, err := queries.CreateUser(ctx, database.CreateUserParams{
		Email:        fmt.Sprintf("student2_%s@edu.local", unique),
		PasswordHash: passHash,
		FullName:     "Test Student 2",
		Role:         "student",
	})
	if err != nil {
		t.Fatalf("failed to create test student 2: %v", err)
	}

	parent, err := queries.CreateUser(ctx, database.CreateUserParams{
		Email:        fmt.Sprintf("parent_%s@edu.local", unique),
		PasswordHash: passHash,
		FullName:     "Test Parent",
		Role:         "parent",
	})
	if err != nil {
		t.Fatalf("failed to create test parent: %v", err)
	}

	teacherToken, _, _ := jwtManager.Generate(teacher.ID, teacher.Email, teacher.Role)
	student1Token, _, _ := jwtManager.Generate(student1.ID, student1.Email, student1.Role)
	student2Token, _, _ := jwtManager.Generate(student2.ID, student2.Email, student2.Role)
	parentToken, _, _ := jwtManager.Generate(parent.ID, parent.Email, parent.Role)

	return router, queries, teacherToken, student1Token, student2Token, parentToken, teacher.ID, student1.ID, student2.ID
}

func doRequest(handler http.Handler, method, target string, body any, token string) *httptest.ResponseRecorder {
	var bodyBuf bytes.Buffer
	if body != nil {
		_ = json.NewEncoder(&bodyBuf).Encode(body)
	}

	req := httptest.NewRequest(method, target, &bodyBuf)
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}

	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)
	return rr
}

func TestHealthCheck(t *testing.T) {
	router, _, _, _, _, _, _, _, _ := setupTestApp(t)

	rr := doRequest(router, http.MethodGet, "/health", nil, "")
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rr.Code)
	}

	var resp map[string]string
	_ = json.Unmarshal(rr.Body.Bytes(), &resp)
	if resp["status"] != "ok" {
		t.Errorf("expected status 'ok', got %s", resp["status"])
	}
}

func TestAuthLogin(t *testing.T) {
	router, _, _, _, _, _, _, _, _ := setupTestApp(t)

	// Seed user was created in make seed or test app
	// Test login with valid credentials
	loginBody := map[string]string{
		"email":    "teacher.smith@edu.local",
		"password": "Teacher123!",
	}
	rr := doRequest(router, http.MethodPost, "/api/v1/auth/login", loginBody, "")
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200 OK on login, got %d: %s", rr.Code, rr.Body.String())
	}

	var authResp auth.AuthResponse
	if err := json.Unmarshal(rr.Body.Bytes(), &authResp); err != nil {
		t.Fatalf("failed to decode login response: %v", err)
	}
	if authResp.Token == "" {
		t.Errorf("expected non-empty token")
	}
	if authResp.User.Role != "teacher" {
		t.Errorf("expected role 'teacher', got %s", authResp.User.Role)
	}

	// Test login with invalid password -> 401 Unauthorized
	badLogin := map[string]string{
		"email":    "teacher.smith@edu.local",
		"password": "WrongPassword!",
	}
	rr = doRequest(router, http.MethodPost, "/api/v1/auth/login", badLogin, "")
	if rr.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 Unauthorized, got %d", rr.Code)
	}

	var errResp response.ErrorResponse
	_ = json.Unmarshal(rr.Body.Bytes(), &errResp)
	if errResp.Status != http.StatusUnauthorized {
		t.Errorf("expected error response status 401, got %d", errResp.Status)
	}
}

func TestCopilotLessonPlanRBACAndGeneration(t *testing.T) {
	router, _, teacherToken, studentToken, _, _, _, _, _ := setupTestApp(t)

	lessonReq := map[string]any{
		"subject":          "Mathematics",
		"grade_level":      "Grade 8",
		"topic":            "Quadratic Equations",
		"duration_minutes": 60,
	}

	// 1. Unauthenticated -> 401
	rr := doRequest(router, http.MethodPost, "/api/v1/copilot/lesson-plan", lessonReq, "")
	if rr.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 Unauthorized, got %d: %s", rr.Code, rr.Body.String())
	}

	// 2. Student token (Forbidden) -> 403
	rr = doRequest(router, http.MethodPost, "/api/v1/copilot/lesson-plan", lessonReq, studentToken)
	if rr.Code != http.StatusForbidden {
		t.Fatalf("expected 403 Forbidden for student, got %d: %s", rr.Code, rr.Body.String())
	}

	// 3. Teacher token -> 201 Created
	rr = doRequest(router, http.MethodPost, "/api/v1/copilot/lesson-plan", lessonReq, teacherToken)
	if rr.Code != http.StatusCreated {
		t.Fatalf("expected 201 Created for teacher, got %d: %s", rr.Code, rr.Body.String())
	}

	var plan copilot.LessonPlanResponse
	if err := json.Unmarshal(rr.Body.Bytes(), &plan); err != nil {
		t.Fatalf("failed to decode lesson plan: %v", err)
	}
	if plan.Subject != "Mathematics" || plan.Topic != "Quadratic Equations" {
		t.Errorf("unexpected subject/topic: %+v", plan)
	}
	if len(plan.GeneratedMarkdown) == 0 {
		t.Errorf("expected generated markdown to be non-empty")
	}

	// 4. Teacher listing lesson plans -> 200 OK
	rr = doRequest(router, http.MethodGet, "/api/v1/copilot/lesson-plans", nil, teacherToken)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200 OK listing lesson plans, got %d: %s", rr.Code, rr.Body.String())
	}
}

func TestClassAttendanceAndAssignmentsFlow(t *testing.T) {
	router, _, teacherToken, student1Token, _, parentToken, _, student1ID, student2ID := setupTestApp(t)

	// 1. Teacher creates a class
	createClassReq := school.CreateClassRequest{
		Name:         "Biology 101",
		GradeLevel:   "Grade 9",
		AcademicYear: "2026-2027",
	}
	rr := doRequest(router, http.MethodPost, "/api/v1/classes/", createClassReq, teacherToken)
	if rr.Code != http.StatusCreated {
		t.Fatalf("expected 201 Created for class, got %d: %s", rr.Code, rr.Body.String())
	}
	var class school.ClassDTO
	_ = json.Unmarshal(rr.Body.Bytes(), &class)

	// 2. Enroll student 1 and student 2
	rr = doRequest(router, http.MethodPost, fmt.Sprintf("/api/v1/classes/%s/enroll", class.ID), map[string]any{"student_id": student1ID}, teacherToken)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200 enrolling student 1, got %d: %s", rr.Code, rr.Body.String())
	}
	rr = doRequest(router, http.MethodPost, fmt.Sprintf("/api/v1/classes/%s/enroll", class.ID), map[string]any{"student_id": student2ID}, teacherToken)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200 enrolling student 2, got %d: %s", rr.Code, rr.Body.String())
	}

	// 3. Batch record attendance for today
	today := time.Now().Format("2006-01-02")
	batchReq := school.BatchAttendanceRequest{
		Date: today,
		Records: []school.AttendanceItem{
			{StudentID: student1ID, Status: "present", Notes: "On time and engaged"},
			{StudentID: student2ID, Status: "absent", Notes: "Excused illness"},
		},
	}
	rr = doRequest(router, http.MethodPost, fmt.Sprintf("/api/v1/classes/%s/attendance", class.ID), batchReq, teacherToken)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200 recording attendance, got %d: %s", rr.Code, rr.Body.String())
	}

	var batchResp school.BatchAttendanceResponse
	_ = json.Unmarshal(rr.Body.Bytes(), &batchResp)
	if batchResp.RecordedCount != 2 {
		t.Errorf("expected recorded count 2, got %d", batchResp.RecordedCount)
	}

	// 4. Fetch attendance roster
	rr = doRequest(router, http.MethodGet, fmt.Sprintf("/api/v1/classes/%s/attendance?date=%s", class.ID, today), nil, teacherToken)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200 fetching attendance roster, got %d: %s", rr.Code, rr.Body.String())
	}
	var roster school.AttendanceRosterResponse
	_ = json.Unmarshal(rr.Body.Bytes(), &roster)
	if roster.Total != 2 {
		t.Errorf("expected 2 students in roster, got %d", roster.Total)
	}

	// 5. Create an assignment
	assignmentReq := school.CreateAssignmentRequest{
		Title:       "Photosynthesis Lab Report",
		Description: "Explain the light-dependent reactions in chloroplasts.",
		DueDate:     time.Now().Add(48 * time.Hour),
		MaxScore:    100,
	}
	rr = doRequest(router, http.MethodPost, fmt.Sprintf("/api/v1/classes/%s/assignments", class.ID), assignmentReq, teacherToken)
	if rr.Code != http.StatusCreated {
		t.Fatalf("expected 201 creating assignment, got %d: %s", rr.Code, rr.Body.String())
	}
	var assignment school.AssignmentDTO
	_ = json.Unmarshal(rr.Body.Bytes(), &assignment)

	// 6. Student 1 submits the assignment
	rr = doRequest(router, http.MethodPost, fmt.Sprintf("/api/v1/assignments/%s/submit", assignment.ID), nil, student1Token)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200 submitting assignment, got %d: %s", rr.Code, rr.Body.String())
	}

	// 7. Check student overview for student 1 (Has submitted -> pending assignments = 0)
	rr = doRequest(router, http.MethodGet, fmt.Sprintf("/api/v1/students/%s/overview", student1ID), nil, student1Token)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200 student overview for student 1, got %d: %s", rr.Code, rr.Body.String())
	}
	var overview1 school.StudentOverviewResponse
	_ = json.Unmarshal(rr.Body.Bytes(), &overview1)
	if overview1.AttendanceSummary.Present < 1 {
		t.Errorf("expected present >= 1, got %d", overview1.AttendanceSummary.Present)
	}
	if len(overview1.PendingAssignments) != 0 {
		t.Errorf("expected 0 pending assignments for student 1, got %d", len(overview1.PendingAssignments))
	}

	// 8. Check student overview for student 2 (Has NOT submitted -> pending assignments = 1)
	// Accessed by parent
	rr = doRequest(router, http.MethodGet, fmt.Sprintf("/api/v1/students/%s/overview", student2ID), nil, parentToken)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200 student overview by parent, got %d: %s", rr.Code, rr.Body.String())
	}
	var overview2 school.StudentOverviewResponse
	_ = json.Unmarshal(rr.Body.Bytes(), &overview2)
	if overview2.AttendanceSummary.Absent < 1 {
		t.Errorf("expected absent >= 1, got %d", overview2.AttendanceSummary.Absent)
	}
	if len(overview2.PendingAssignments) < 1 {
		t.Errorf("expected at least 1 pending assignment for student 2, got %d", len(overview2.PendingAssignments))
	}

	// 9. Student 1 tries to access student 2's overview -> 403 Forbidden
	rr = doRequest(router, http.MethodGet, fmt.Sprintf("/api/v1/students/%s/overview", student2ID), nil, student1Token)
	if rr.Code != http.StatusForbidden {
		t.Fatalf("expected 403 Forbidden for student accessing peer overview, got %d: %s", rr.Code, rr.Body.String())
	}
}

func TestStandardErrorFormatting(t *testing.T) {
	router, _, teacherToken, _, _, _, _, _, _ := setupTestApp(t)

	// Trigger 400 Bad Request
	badClassReq := map[string]any{
		"name": "", // empty name
	}
	rr := doRequest(router, http.MethodPost, "/api/v1/classes/", badClassReq, teacherToken)
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 Bad Request, got %d: %s", rr.Code, rr.Body.String())
	}

	var errResp response.ErrorResponse
	if err := json.Unmarshal(rr.Body.Bytes(), &errResp); err != nil {
		t.Fatalf("failed to decode error response: %v", err)
	}
	if errResp.Error == "" || errResp.Status != 400 {
		t.Errorf("unexpected error format: %+v", errResp)
	}
}
