package copilot

import (
	"context"
	"strings"
	"testing"

	"github.com/google/uuid"
)

// dummyQuerier implements database.Querier for tests
type dummyQuerier struct{}

func TestQueryEncoderAndCosineSimilarity(t *testing.T) {
	encoder := NewSemanticDenseEncoder("", "", "text-embedding-3-small")
	ctx := context.Background()

	vec1, err := encoder.Encode(ctx, "Grade 5 Math Fractions and Decimals addition")
	if err != nil {
		t.Fatalf("unexpected error encoding vec1: %v", err)
	}
	if len(vec1) != EmbeddingDimension {
		t.Fatalf("expected vector length %d, got %d", EmbeddingDimension, len(vec1))
	}

	vec2, err := encoder.Encode(ctx, "Fractions arithmetic unlike denominators addition and subtraction")
	if err != nil {
		t.Fatalf("unexpected error encoding vec2: %v", err)
	}

	vec3, err := encoder.Encode(ctx, "Photosynthesis chlorophyll plant biology cellular energy")
	if err != nil {
		t.Fatalf("unexpected error encoding vec3: %v", err)
	}

	simRelated := CosineSimilarity(vec1, vec2)
	simUnrelated := CosineSimilarity(vec1, vec3)

	if simRelated <= simUnrelated {
		t.Errorf("expected related similarity (%.3f) to be higher than unrelated similarity (%.3f)", simRelated, simUnrelated)
	}
}

func TestVectorStoreRetrieval(t *testing.T) {
	encoder := NewSemanticDenseEncoder("", "", "text-embedding-3-small")
	store := NewVectorStore(nil, nil, encoder)
	ctx := context.Background()

	queryVec, _ := encoder.Encode(ctx, "Grade 5 Math Fractions unlike denominators")

	// Top-K=5 curriculum chunks
	chunks, err := store.RetrieveCurriculumChunks(ctx, queryVec, "Mathematics", "Grade 5", 5)
	if err != nil {
		t.Fatalf("retrieval failed: %v", err)
	}
	if len(chunks) != 5 {
		t.Errorf("expected 5 curriculum chunks, got %d", len(chunks))
	}

	foundFraction := false
	for _, c := range chunks {
		if strings.Contains(strings.ToLower(c.Topic), "fraction") || strings.Contains(strings.ToLower(c.UnitTitle), "fraction") {
			foundFraction = true
			break
		}
	}
	if !foundFraction {
		t.Errorf("expected to find fractions curriculum chunk in top-5 retrieval")
	}

	// Top-K=3 prior lesson plans
	prior, err := store.RetrievePriorLessonPlans(ctx, uuid.New(), queryVec, "Mathematics", "Grade 5", 3)
	if err != nil {
		t.Fatalf("prior plans retrieval failed: %v", err)
	}
	if len(prior) != 3 {
		t.Errorf("expected 3 prior plans, got %d", len(prior))
	}

	// Top-K=3 student performance summaries
	perf, err := store.RetrieveStudentPerformance(ctx, uuid.New(), "Mathematics", "Grade 5", "Fractions", 3)
	if err != nil {
		t.Fatalf("performance retrieval failed: %v", err)
	}
	if len(perf) != 3 {
		t.Errorf("expected 3 student performance summaries, got %d", len(perf))
	}
}

func TestPromptAssembly(t *testing.T) {
	encoder := NewSemanticDenseEncoder("", "", "text-embedding-3-small")
	store := NewVectorStore(nil, nil, encoder)
	assembler := NewPromptAssembler()
	ctx := context.Background()

	req := LessonPlanPromptRequest{
		Subject:         "Mathematics",
		GradeLevel:      "Grade 5",
		Topic:           "Fractions, 45-min lesson",
		DurationMinutes: 45,
	}

	queryVec, _ := encoder.Encode(ctx, req.Subject+" "+req.GradeLevel+" "+req.Topic)
	chunks, _ := store.RetrieveCurriculumChunks(ctx, queryVec, req.Subject, req.GradeLevel, 5)
	prior, _ := store.RetrievePriorLessonPlans(ctx, uuid.New(), queryVec, req.Subject, req.GradeLevel, 3)
	perf, _ := store.RetrieveStudentPerformance(ctx, uuid.New(), req.Subject, req.GradeLevel, req.Topic, 3)

	prompt := assembler.Assemble(req, chunks, prior, perf)

	if !strings.Contains(prompt.SystemPrompt, "Myanmar Ministry of Education") {
		t.Errorf("expected system prompt to reference Myanmar MoE")
	}
	if !strings.Contains(prompt.UserPrompt, chunks[0].StandardCode) {
		t.Errorf("expected user prompt to cite primary standard code %s", chunks[0].StandardCode)
	}
	if !strings.Contains(prompt.RetrievedContext, "MM-MOE-G5-M-01") {
		t.Errorf("expected retrieved context to contain MM-MOE-G5-M-01")
	}
}

func TestOutputValidation(t *testing.T) {
	validator := NewOutputValidator()
	chunks := getBaselineCurriculumSeeds()[:5]

	mockPlan := `# Curriculum-Aligned Lesson Plan: Fractions
**Official MoE Curriculum Grounding:** [MM-MOE-G5-M-01] Unit 4: Fractions and Operations
**Subject:** Mathematics | **Grade Level:** Grade 5 | **Total Duration:** 45 minutes

## 1. Learning Objectives
Students will be able to:
- Identify and define common denominators for unlike fractions.
- Calculate and solve addition of unlike fractions with 85% accuracy.
- Demonstrate problem solving with visual fraction strips.

## 4. Instructional Sequence & Timeline
### Phase 1: Warm-Up & Hook (5 mins)
Focus on interactive fraction pizza puzzle.

### Phase 2: Direct Instruction (15 mins)
Teacher modeling LCM method on board.

### Phase 3: Guided Practice (15 mins)
Collaborative pairs solve scaffolded problems.

### Phase 4: Independent Application (5 mins)
Individual practice worksheets.

### Phase 5: Closure & Exit Ticket (5 mins)
Exit slip checking numerator and denominator mastery.
`

	burmesePlan := `# သင်ရိုးညွှန်းတမ်းနှင့် ကိုက်ညီသော သင်ခန်းစာ အစီအစဉ်: အပိုင်းကိန်းများ
**နိုင်ငံတော် ပညာရေးဝန်ကြီးဌာန သင်ရိုးစံနှုန်း ကိုက်ညီမှု:** [MM-MOE-G5-M-01] အပိုင်းကိန်းများနှင့် တွက်ချက်မှုများ
နိဒါန်းပျိုးခြင်း၊ တိုက်ရိုက်ရှင်းလင်းသင်ကြားခြင်း၊ အဖွဲ့လိုက် ပူးပေါင်းလေ့ကျင့်ခြင်း၊ တစ်ဦးချင်း လွတ်လပ်စွာ ဆောင်ရွက်ခြင်း၊ လက်မှတ်စစ်ဆေးခြင်း။`

	report := validator.Validate(mockPlan, burmesePlan, "Grade 5", chunks)

	if report.CurriculumAlignment.Status != "PASSED" {
		t.Errorf("expected alignment status PASSED, got %s (Score: %.1f)", report.CurriculumAlignment.Status, report.CurriculumAlignment.Score)
	}
	if report.LanguageSafetyFilter.Status != "PASSED" {
		t.Errorf("expected safety status PASSED, got %s", report.LanguageSafetyFilter.Status)
	}
	if report.OverallScore < 80.0 {
		t.Errorf("expected overall score >= 80.0, got %.1f", report.OverallScore)
	}
}

func TestFullRAGPipelineExecution(t *testing.T) {
	encoder := NewSemanticDenseEncoder("", "", "text-embedding-3-small")
	store := NewVectorStore(nil, nil, encoder)
	llmClient := NewMockLLMClient()
	pipeline := NewRAGPipeline(encoder, store, llmClient, nil, nil)
	ctx := context.Background()

	req := LessonPlanPromptRequest{
		Subject:         "Mathematics",
		GradeLevel:      "Grade 5",
		Topic:           "Fractions, 45-min lesson",
		DurationMinutes: 45,
	}

	result, err := pipeline.Execute(ctx, uuid.New(), nil, req)
	if err != nil {
		t.Fatalf("pipeline execution failed: %v", err)
	}

	if result.RAGMetadata == nil {
		t.Fatalf("expected RAGMetadata to be populated")
	}

	if len(result.RAGMetadata.RetrievedCurriculumChunks) != 5 {
		t.Errorf("expected 5 retrieved curriculum chunks, got %d", len(result.RAGMetadata.RetrievedCurriculumChunks))
	}

	if len(result.RAGMetadata.RetrievedPriorPlans) != 3 {
		t.Errorf("expected 3 retrieved prior plans, got %d", len(result.RAGMetadata.RetrievedPriorPlans))
	}

	if len(result.RAGMetadata.RetrievedStudentPerformance) != 3 {
		t.Errorf("expected 3 retrieved student performance summaries, got %d", len(result.RAGMetadata.RetrievedStudentPerformance))
	}

	if result.RAGMetadata.ValidationReport.OverallScore <= 0 {
		t.Errorf("expected positive validation score, got %.1f", result.RAGMetadata.ValidationReport.OverallScore)
	}

	primaryCode := result.RAGMetadata.RetrievedCurriculumChunks[0].StandardCode
	if !strings.Contains(result.GeneratedMarkdown, primaryCode) {
		t.Errorf("expected generated plan to contain primary MoE code %s", primaryCode)
	}
}

func TestRAGPipelineStreaming(t *testing.T) {
	encoder := NewSemanticDenseEncoder("", "", "text-embedding-3-small")
	store := NewVectorStore(nil, nil, encoder)
	llmClient := NewMockLLMClient()
	pipeline := NewRAGPipeline(encoder, store, llmClient, nil, nil)
	ctx := context.Background()

	req := LessonPlanPromptRequest{
		Subject:         "Mathematics",
		GradeLevel:      "Grade 5",
		Topic:           "Fractions, 45-min lesson",
		DurationMinutes: 45,
	}

	var emittedSteps []int
	var gotRetrievalData bool
	var gotValidationData bool
	var gotTextChunk bool

	emitter := func(eventType string, data any) error {
		switch eventType {
		case "pipeline_step":
			if stepEv, ok := data.(RAGPipelineStepEvent); ok {
				emittedSteps = append(emittedSteps, stepEv.Step)
			}
		case "retrieval_data":
			gotRetrievalData = true
		case "validation_data":
			gotValidationData = true
		case "text_chunk":
			gotTextChunk = true
		}
		return nil
	}

	result, err := pipeline.ExecuteStream(ctx, uuid.New(), nil, req, emitter)
	if err != nil {
		t.Fatalf("pipeline stream execution failed: %v", err)
	}

	if result == nil {
		t.Fatalf("expected non-nil stream result")
	}

	if !gotRetrievalData {
		t.Errorf("expected retrieval_data event during stream")
	}
	if !gotValidationData {
		t.Errorf("expected validation_data event during stream")
	}
	if !gotTextChunk {
		t.Errorf("expected text_chunk event during stream")
	}
	if len(emittedSteps) < 7 {
		t.Errorf("expected at least 7 pipeline steps emitted, got %d", len(emittedSteps))
	}
}

func BenchmarkGenerateDenseVector(b *testing.B) {
	encoder := NewSemanticDenseEncoder("", "", "text-embedding-3-small")
	text := "Unit 4: Fractions and Operations (အပိုင်းကိန်းများနှင့် တွက်ချက်မှုများ) Addition and Subtraction of Unlike Fractions (ပိုင်းခြေမတူသော အပိုင်းကိန်းများ)"
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = encoder.generateDenseVector(text)
	}
}
