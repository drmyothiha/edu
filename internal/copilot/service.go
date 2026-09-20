package copilot

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"edu-platform/internal/database"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// LessonPlanResponse represents the generated lesson plan payload
type LessonPlanResponse struct {
	ID                uuid.UUID `json:"id"`
	TeacherID         uuid.UUID `json:"teacher_id"`
	Subject           string    `json:"subject"`
	GradeLevel        string    `json:"grade_level"`
	Topic             string    `json:"topic"`
	DurationMinutes   int32     `json:"duration_minutes"`
	GeneratedMarkdown string    `json:"generated_markdown"`
	CreatedAt         time.Time `json:"created_at"`
}

// Service manages lesson plan generation and storage
type Service struct {
	querier   database.Querier
	llmClient LLMClient
}

// NewService creates a new copilot Service
func NewService(querier database.Querier, llmClient LLMClient) *Service {
	return &Service{
		querier:   querier,
		llmClient: llmClient,
	}
}

// GenerateLessonPlan validates input, calls LLM client, stores plan, and returns result
func (s *Service) GenerateLessonPlan(ctx context.Context, teacherID uuid.UUID, req LessonPlanPromptRequest) (*LessonPlanResponse, error) {
	req.Subject = strings.TrimSpace(req.Subject)
	req.GradeLevel = strings.TrimSpace(req.GradeLevel)
	req.Topic = strings.TrimSpace(req.Topic)

	if req.Subject == "" {
		return nil, errors.New("subject is required")
	}
	if req.GradeLevel == "" {
		return nil, errors.New("grade_level is required")
	}
	if req.Topic == "" {
		return nil, errors.New("topic is required")
	}
	if req.DurationMinutes <= 0 {
		req.DurationMinutes = 45
	}

	markdown, err := s.llmClient.GenerateLessonPlan(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("llm generation failed: %w", err)
	}

	plan, err := s.querier.CreateLessonPlan(ctx, database.CreateLessonPlanParams{
		TeacherID:         teacherID,
		Subject:           req.Subject,
		GradeLevel:        req.GradeLevel,
		Topic:             req.Topic,
		DurationMinutes:   int32(req.DurationMinutes),
		GeneratedMarkdown: markdown,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to persist lesson plan: %w", err)
	}

	return &LessonPlanResponse{
		ID:                plan.ID,
		TeacherID:         plan.TeacherID,
		Subject:           plan.Subject,
		GradeLevel:        plan.GradeLevel,
		Topic:             plan.Topic,
		DurationMinutes:   plan.DurationMinutes,
		GeneratedMarkdown: plan.GeneratedMarkdown,
		CreatedAt:         plan.CreatedAt.Time,
	}, nil
}

// GetLessonPlan retrieves a saved lesson plan by ID
func (s *Service) GetLessonPlan(ctx context.Context, id uuid.UUID) (*LessonPlanResponse, error) {
	plan, err := s.querier.GetLessonPlanByID(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, errors.New("lesson plan not found")
		}
		return nil, fmt.Errorf("failed to get lesson plan: %w", err)
	}

	return &LessonPlanResponse{
		ID:                plan.ID,
		TeacherID:         plan.TeacherID,
		Subject:           plan.Subject,
		GradeLevel:        plan.GradeLevel,
		Topic:             plan.Topic,
		DurationMinutes:   plan.DurationMinutes,
		GeneratedMarkdown: plan.GeneratedMarkdown,
		CreatedAt:         plan.CreatedAt.Time,
	}, nil
}

// ListLessonPlansByTeacher retrieves all lesson plans for a teacher
func (s *Service) ListLessonPlansByTeacher(ctx context.Context, teacherID uuid.UUID) ([]LessonPlanResponse, error) {
	plans, err := s.querier.ListLessonPlansByTeacherID(ctx, teacherID)
	if err != nil {
		return nil, fmt.Errorf("failed to list lesson plans: %w", err)
	}

	res := make([]LessonPlanResponse, len(plans))
	for i, plan := range plans {
		res[i] = LessonPlanResponse{
			ID:                plan.ID,
			TeacherID:         plan.TeacherID,
			Subject:           plan.Subject,
			GradeLevel:        plan.GradeLevel,
			Topic:             plan.Topic,
			DurationMinutes:   plan.DurationMinutes,
			GeneratedMarkdown: plan.GeneratedMarkdown,
			CreatedAt:         plan.CreatedAt.Time,
		}
	}
	return res, nil
}
