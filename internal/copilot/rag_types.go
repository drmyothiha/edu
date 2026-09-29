package copilot

import (
	"time"

	"github.com/google/uuid"
)

// CurriculumChunk represents a standard Myanmar Ministry of Education curriculum unit
type CurriculumChunk struct {
	ID                    uuid.UUID `json:"id"`
	StandardCode          string    `json:"standard_code"`
	Framework             string    `json:"framework"`
	Subject               string    `json:"subject"`
	GradeLevel            string    `json:"grade_level"`
	UnitTitle             string    `json:"unit_title"`
	Topic                 string    `json:"topic"`
	Competency            string    `json:"competency"`
	LearningOutcomes      string    `json:"learning_outcomes"`
	PedagogicalActivities string    `json:"pedagogical_activities"`
	BloomsLevel           string    `json:"blooms_level"`
	ContentBurmese        string    `json:"content_burmese"`
	Keywords              []string  `json:"keywords"`
	Embedding             []float64 `json:"-"`
	SimilarityScore       float64   `json:"similarity_score"`
}

// PriorLessonPlanSummary captures past pedagogical attempts and outcomes
type PriorLessonPlanSummary struct {
	ID              uuid.UUID `json:"id"`
	Topic           string    `json:"topic"`
	Subject         string    `json:"subject"`
	GradeLevel      string    `json:"grade_level"`
	DurationMinutes int32     `json:"duration_minutes"`
	KeyLearnings    string    `json:"key_learnings"`
	SimilarityScore float64   `json:"similarity_score"`
	CreatedAt       time.Time `json:"created_at"`
}

// StudentPerformanceSummary holds competency mastery data for targeted differentiation
type StudentPerformanceSummary struct {
	Competency      string  `json:"competency"`
	BenchmarkScore  float64 `json:"benchmark_score"`
	MasteryStatus   string  `json:"mastery_status"` // "Needs Reinforcement", "Proficient", "Mastered"
	ClassAverage    float64 `json:"class_average"`
	AtRiskCount     int     `json:"at_risk_count"`
	PedagogicalNeed string  `json:"pedagogical_need"`
	RelevanceScore  float64 `json:"relevance_score"`
}

// ValidationCheck represents an individual quality/safety check in the RAG pipeline
type ValidationCheck struct {
	Name    string  `json:"name"`
	Status  string  `json:"status"` // "PASSED", "WARNING", "FAILED"
	Score   float64 `json:"score"`  // 0 - 100
	Details string  `json:"details"`
}

// ValidationReport summarizes the rule-based, regex, and readability checks
type ValidationReport struct {
	CurriculumAlignment  ValidationCheck `json:"curriculum_alignment"`
	ReadabilityScore     ValidationCheck `json:"readability_score"`
	LanguageSafetyFilter ValidationCheck `json:"language_safety_filter"`
	OverallStatus        string          `json:"overall_status"` // "PASSED", "PASS_WITH_WARNINGS", "FAILED"
	OverallScore         float64         `json:"overall_score"`
	Timestamp            time.Time       `json:"timestamp"`
}

// RAGMetadata stores the full retrieval, prompt assembly, and validation telemetry
type RAGMetadata struct {
	QueryEmbeddingDimension     int                          `json:"query_embedding_dimension"`
	EncoderModel                string                       `json:"encoder_model"`
	RetrievedCurriculumChunks   []CurriculumChunk            `json:"retrieved_curriculum_chunks"`
	RetrievedPriorPlans         []PriorLessonPlanSummary     `json:"retrieved_prior_plans"`
	RetrievedStudentPerformance []StudentPerformanceSummary `json:"retrieved_student_performance"`
	ValidationReport            ValidationReport             `json:"validation_report"`
	SystemPromptTokensEstimate  int                          `json:"system_prompt_tokens_estimate"`
	ContextTokensEstimate       int                          `json:"context_tokens_estimate"`
	GroundingConfidenceScore    float64                      `json:"grounding_confidence_score"`
	BloomTaxonomyTarget         string                       `json:"bloom_taxonomy_target"`
	EventPublished              bool                         `json:"event_published"`
	EventID                     string                       `json:"event_id,omitempty"`
}

// RAGPipelineStepEvent is emitted progressively over SSE during generation
type RAGPipelineStepEvent struct {
	Step      int       `json:"step"`
	StepName  string    `json:"step_name"`
	Status    string    `json:"status"` // "started", "in_progress", "completed", "failed"
	Message   string    `json:"message"`
	Data      any       `json:"data,omitempty"`
	Timestamp time.Time `json:"timestamp"`
}
