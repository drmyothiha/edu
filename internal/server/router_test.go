package server

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"edu-platform/internal/auth"
	"edu-platform/internal/copilot"
	"edu-platform/internal/database"
	"edu-platform/internal/response"
	"edu-platform/internal/school"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

// mockQuerier implements database.Querier for server-level router testing
type mockQuerier struct {
	database.Querier
	users   map[uuid.UUID]database.User
	classes map[uuid.UUID]database.Class
}

func newRouterMockQuerier() *mockQuerier {
	return &mockQuerier{
		users:   make(map[uuid.UUID]database.User),
		classes: make(map[uuid.UUID]database.Class),
	}
}

func (m *mockQuerier) CreateLessonPlan(ctx context.Context, arg database.CreateLessonPlanParams) (database.LessonPlan, error) {
	return database.LessonPlan{
		ID:                uuid.New(),
		TeacherID:         arg.TeacherID,
		Subject:           arg.Subject,
		GradeLevel:        arg.GradeLevel,
		Topic:             arg.Topic,
		DurationMinutes:   arg.DurationMinutes,
		GeneratedMarkdown: arg.GeneratedMarkdown,
		CreatedAt:         pgtype.Timestamptz{Time: time.Now().UTC(), Valid: true},
	}, nil
}

func (m *mockQuerier) ListLessonPlansByTeacherID(ctx context.Context, teacherID uuid.UUID) ([]database.LessonPlan, error) {
	return []database.LessonPlan{}, nil
}

func setupTestServer() (http.Handler, *auth.JWTManager) {
	mockQ := newRouterMockQuerier()
	jwtMgr := auth.NewJWTManager("test-jwt-secret-key-32-bytes-long!", 1*time.Hour, "edu-test")
	authMid := auth.NewMiddleware(jwtMgr)

	authSvc := auth.NewService(mockQ, jwtMgr)
	authHdl := auth.NewHandler(authSvc)

	llmClient := copilot.NewMockLLMClient()
	copilotSvc := copilot.NewService(mockQ, llmClient)
	copilotHdl := copilot.NewHandler(copilotSvc)

	schoolSvc := school.NewService(mockQ)
	schoolHdl := school.NewHandler(schoolSvc)

	r := NewRouter(RouterConfig{
		AuthHandler:    authHdl,
		AuthMiddleware: authMid,
		SchoolHandler:  schoolHdl,
		CopilotHandler: copilotHdl,
	})

	return r, jwtMgr
}

func TestHealthCheck(t *testing.T) {
	r, _ := setupTestServer()

	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d", rr.Code)
	}

	var res map[string]string
	if err := json.Unmarshal(rr.Body.Bytes(), &res); err != nil {
		t.Fatalf("failed to parse JSON: %v", err)
	}

	if res["status"] != "ok" {
		t.Errorf("expected status ok, got %s", res["status"])
	}
}

func TestNotFoundStandardFormat(t *testing.T) {
	r, _ := setupTestServer()

	req := httptest.NewRequest(http.MethodGet, "/non-existent-endpoint", nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	if rr.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", rr.Code)
	}

	var errResp response.ErrorResponse
	if err := json.Unmarshal(rr.Body.Bytes(), &errResp); err != nil {
		t.Fatalf("failed to parse error response: %v", err)
	}

	if errResp.Status != 404 {
		t.Errorf("expected status 404 in body, got %d", errResp.Status)
	}
	if errResp.Error == "" {
		t.Errorf("expected non-empty error message")
	}
}

func TestTeacherCopilotRBAC(t *testing.T) {
	r, jwtMgr := setupTestServer()

	teacherID := uuid.New()
	teacherToken, _, _ := jwtMgr.Generate(teacherID, "teacher@edu.local", "teacher")

	studentID := uuid.New()
	studentToken, _, _ := jwtMgr.Generate(studentID, "student@edu.local", "student")

	body := []byte(`{
		"subject": "Physics",
		"grade_level": "Grade 11",
		"topic": "Newtonian Gravity",
		"duration_minutes": 45
	}`)

	// 1. Unauthorized (no token)
	req1 := httptest.NewRequest(http.MethodPost, "/api/v1/copilot/lesson-plan", bytes.NewReader(body))
	req1.Header.Set("Content-Type", "application/json")
	rr1 := httptest.NewRecorder()
	r.ServeHTTP(rr1, req1)

	if rr1.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 for unauthenticated request, got %d", rr1.Code)
	}

	// 2. Forbidden (student token trying to access teacher-only copilot)
	req2 := httptest.NewRequest(http.MethodPost, "/api/v1/copilot/lesson-plan", bytes.NewReader(body))
	req2.Header.Set("Content-Type", "application/json")
	req2.Header.Set("Authorization", "Bearer "+studentToken)
	rr2 := httptest.NewRecorder()
	r.ServeHTTP(rr2, req2)

	if rr2.Code != http.StatusForbidden {
		t.Errorf("expected 403 for student accessing teacher copilot, got %d", rr2.Code)
	}

	// 3. Authorized (teacher token)
	req3 := httptest.NewRequest(http.MethodPost, "/api/v1/copilot/lesson-plan", bytes.NewReader(body))
	req3.Header.Set("Content-Type", "application/json")
	req3.Header.Set("Authorization", "Bearer "+teacherToken)
	rr3 := httptest.NewRecorder()
	r.ServeHTTP(rr3, req3)

	if rr3.Code != http.StatusOK && rr3.Code != http.StatusCreated {
		t.Fatalf("expected 200 OK or 201 Created for teacher, got %d: %s", rr3.Code, rr3.Body.String())
	}

	var plan copilot.LessonPlanResponse
	if err := json.Unmarshal(rr3.Body.Bytes(), &plan); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if plan.Subject != "Physics" || plan.Topic != "Newtonian Gravity" {
		t.Errorf("unexpected lesson plan payload: %+v", plan)
	}
	if plan.GeneratedMarkdown == "" {
		t.Errorf("expected non-empty generated Markdown")
	}
}
