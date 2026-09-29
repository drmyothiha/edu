package copilot

import (
	"context"
	"errors"
	"fmt"
	"time"

	"edu-platform/internal/database"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// LessonPlanResponse represents the generated lesson plan payload with RAG metadata
type LessonPlanResponse struct {
	ID                       uuid.UUID    `json:"id"`
	TeacherID                uuid.UUID    `json:"teacher_id"`
	Subject                  string       `json:"subject"`
	GradeLevel               string       `json:"grade_level"`
	Topic                    string       `json:"topic"`
	DurationMinutes          int32        `json:"duration_minutes"`
	GeneratedMarkdown        string       `json:"generated_markdown"`
	GeneratedMarkdownBurmese string       `json:"generated_markdown_burmese"`
	CreatedAt                time.Time    `json:"created_at"`
	RAGMetadata              *RAGMetadata `json:"rag_metadata,omitempty"`
}

// Service manages lesson plan generation, RAG retrieval pipeline, and storage
type Service struct {
	querier   database.Querier
	llmClient LLMClient
	pipeline  *RAGPipeline
	store     *VectorStore
	encoder   QueryEncoder
}

// NewService creates a new copilot Service with RAG Pipeline components
func NewService(querier database.Querier, llmClient LLMClient) *Service {
	encoder := NewSemanticDenseEncoder("", "", "text-embedding-3-small")
	store := NewVectorStore(nil, querier, encoder)
	pipeline := NewRAGPipeline(encoder, store, llmClient, querier, nil)

	return &Service{
		querier:   querier,
		llmClient: llmClient,
		pipeline:  pipeline,
		store:     store,
		encoder:   encoder,
	}
}

// InitRAG configures the complete RAG architecture with database connection pool and event bus publisher
func (s *Service) InitRAG(pool *pgxpool.Pool, encoder QueryEncoder, publisher EventPublisher) {
	if encoder != nil {
		s.encoder = encoder
	}
	s.store = NewVectorStore(pool, s.querier, s.encoder)
	s.pipeline = NewRAGPipeline(s.encoder, s.store, s.llmClient, s.querier, publisher)
}

// GenerateLessonPlan executes the 7-step RAG Pipeline
func (s *Service) GenerateLessonPlan(ctx context.Context, teacherID uuid.UUID, req LessonPlanPromptRequest) (*LessonPlanResponse, error) {
	result, err := s.pipeline.Execute(ctx, teacherID, req)
	if err != nil {
		return nil, err
	}

	return &LessonPlanResponse{
		ID:                       result.ID,
		TeacherID:                result.TeacherID,
		Subject:                  result.Subject,
		GradeLevel:               result.GradeLevel,
		Topic:                    result.Topic,
		DurationMinutes:          result.DurationMinutes,
		GeneratedMarkdown:        result.GeneratedMarkdown,
		GeneratedMarkdownBurmese: result.GeneratedMarkdownBurmese,
		CreatedAt:                result.CreatedAt,
		RAGMetadata:              result.RAGMetadata,
	}, nil
}

// GenerateLessonPlanStream executes the 7-step RAG pipeline streaming real-time SSE events
func (s *Service) GenerateLessonPlanStream(ctx context.Context, teacherID uuid.UUID, req LessonPlanPromptRequest, emit SSEEventWriter) (*LessonPlanResponse, error) {
	result, err := s.pipeline.ExecuteStream(ctx, teacherID, req, emit)
	if err != nil {
		return nil, err
	}

	return &LessonPlanResponse{
		ID:                       result.ID,
		TeacherID:                result.TeacherID,
		Subject:                  result.Subject,
		GradeLevel:               result.GradeLevel,
		Topic:                    result.Topic,
		DurationMinutes:          result.DurationMinutes,
		GeneratedMarkdown:        result.GeneratedMarkdown,
		GeneratedMarkdownBurmese: result.GeneratedMarkdownBurmese,
		CreatedAt:                result.CreatedAt,
		RAGMetadata:              result.RAGMetadata,
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

	queryVec, _ := s.encoder.Encode(ctx, plan.Subject+" "+plan.GradeLevel+" "+plan.Topic)
	chunks, _ := s.store.RetrieveCurriculumChunks(ctx, queryVec, plan.Subject, plan.GradeLevel, 5)
	prior, _ := s.store.RetrievePriorLessonPlans(ctx, plan.TeacherID, queryVec, plan.Subject, plan.GradeLevel, 3)
	perf, _ := s.store.RetrieveStudentPerformance(ctx, plan.TeacherID, plan.Subject, plan.GradeLevel, plan.Topic, 3)
	valReport := s.pipeline.validator.Validate(plan.GeneratedMarkdown, plan.GeneratedMarkdownBurmese, plan.GradeLevel, chunks)

	meta := &RAGMetadata{
		QueryEmbeddingDimension:     s.encoder.Dimension(),
		EncoderModel:                s.encoder.ModelName(),
		RetrievedCurriculumChunks:   chunks,
		RetrievedPriorPlans:         prior,
		RetrievedStudentPerformance: perf,
		ValidationReport:            valReport,
		GroundingConfidenceScore:    calculateGroundingConfidence(chunks),
		BloomTaxonomyTarget:         "Apply / Understand (Myanmar MoE)",
		EventPublished:              true,
	}

	return &LessonPlanResponse{
		ID:                       plan.ID,
		TeacherID:                plan.TeacherID,
		Subject:                  plan.Subject,
		GradeLevel:               plan.GradeLevel,
		Topic:                    plan.Topic,
		DurationMinutes:          plan.DurationMinutes,
		GeneratedMarkdown:        plan.GeneratedMarkdown,
		GeneratedMarkdownBurmese: plan.GeneratedMarkdownBurmese,
		CreatedAt:                plan.CreatedAt.Time,
		RAGMetadata:              meta,
	}, nil
}

// TranslateLessonPlan ensures a Burmese translation exists for a lesson plan
func (s *Service) TranslateLessonPlan(ctx context.Context, id uuid.UUID) (*LessonPlanResponse, error) {
	plan, err := s.querier.GetLessonPlanByID(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, errors.New("lesson plan not found")
		}
		return nil, fmt.Errorf("failed to get lesson plan: %w", err)
	}

	if plan.GeneratedMarkdownBurmese != "" {
		return &LessonPlanResponse{
			ID:                       plan.ID,
			TeacherID:                plan.TeacherID,
			Subject:                  plan.Subject,
			GradeLevel:               plan.GradeLevel,
			Topic:                    plan.Topic,
			DurationMinutes:          plan.DurationMinutes,
			GeneratedMarkdown:        plan.GeneratedMarkdown,
			GeneratedMarkdownBurmese: plan.GeneratedMarkdownBurmese,
			CreatedAt:                plan.CreatedAt.Time,
		}, nil
	}

	req := LessonPlanPromptRequest{
		Subject:         plan.Subject,
		GradeLevel:      plan.GradeLevel,
		Topic:           plan.Topic,
		DurationMinutes: int(plan.DurationMinutes),
	}

	burmeseMarkdown, err := s.llmClient.GenerateLessonPlanBurmese(ctx, req, plan.GeneratedMarkdown)
	if err != nil {
		return nil, fmt.Errorf("failed to generate burmese translation: %w", err)
	}

	updated, err := s.querier.UpdateLessonPlanBurmese(ctx, database.UpdateLessonPlanBurmeseParams{
		ID:                       plan.ID,
		GeneratedMarkdownBurmese: burmeseMarkdown,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to update lesson plan burmese translation: %w", err)
	}

	return &LessonPlanResponse{
		ID:                       updated.ID,
		TeacherID:                updated.TeacherID,
		Subject:                  updated.Subject,
		GradeLevel:               updated.GradeLevel,
		Topic:                    updated.Topic,
		DurationMinutes:          updated.DurationMinutes,
		GeneratedMarkdown:        updated.GeneratedMarkdown,
		GeneratedMarkdownBurmese: updated.GeneratedMarkdownBurmese,
		CreatedAt:                updated.CreatedAt.Time,
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
			ID:                       plan.ID,
			TeacherID:                plan.TeacherID,
			Subject:                  plan.Subject,
			GradeLevel:               plan.GradeLevel,
			Topic:                    plan.Topic,
			DurationMinutes:          plan.DurationMinutes,
			GeneratedMarkdown:        plan.GeneratedMarkdown,
			GeneratedMarkdownBurmese: plan.GeneratedMarkdownBurmese,
			CreatedAt:                plan.CreatedAt.Time,
		}
	}
	return res, nil
}

// ListCurriculumStandards retrieves available Myanmar MoE curriculum standards
func (s *Service) ListCurriculumStandards(ctx context.Context, subject, grade string) ([]CurriculumChunk, error) {
	queryVec, _ := s.encoder.Encode(ctx, subject+" "+grade)
	return s.store.RetrieveCurriculumChunks(ctx, queryVec, subject, grade, 10)
}

// DeleteLessonPlan removes a lesson plan if requested by the creator teacher or an administrator
func (s *Service) DeleteLessonPlan(ctx context.Context, id uuid.UUID, userID uuid.UUID, role string) error {
	plan, err := s.querier.GetLessonPlanByID(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return errors.New("lesson plan not found")
		}
		return fmt.Errorf("failed to get lesson plan: %w", err)
	}

	if role != "admin" && role != "sysadmin" && plan.TeacherID != userID {
		return errors.New("access denied: only author or administrator can delete this lesson plan")
	}

	return s.querier.DeleteLessonPlan(ctx, id)
}
