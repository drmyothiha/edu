package copilot

import (
	"fmt"
	"strings"
)

// AssembledRAGPrompt contains the prompt components ready for LLM generation
type AssembledRAGPrompt struct {
	SystemPrompt        string
	UserPrompt          string
	RetrievedContext    string
	EstimatedTokensSys  int
	EstimatedTokensUser int
	BloomsTarget        string
}

// PromptAssembler builds grounded, safety-bounded prompts for the LLM
type PromptAssembler struct{}

// NewPromptAssembler initializes the assembler
func NewPromptAssembler() *PromptAssembler {
	return &PromptAssembler{}
}

// Assemble creates the grounded prompt according to the Myanmar MoE schema
func (pa *PromptAssembler) Assemble(
	req LessonPlanPromptRequest,
	chunks []CurriculumChunk,
	priorPlans []PriorLessonPlanSummary,
	performance []StudentPerformanceSummary,
) AssembledRAGPrompt {
	// Determine target Bloom's taxonomy level from chunks or topic
	bloomsLevel := "Apply (လက်တွေ့ အသုံးချမှု အဆင့်)"
	if len(chunks) > 0 && chunks[0].BloomsLevel != "" {
		bloomsLevel = fmt.Sprintf("%s (Bloom's Taxonomy Level)", chunks[0].BloomsLevel)
	}

	// 1. System Prompt (Role, Safety, Curriculum Constraints, Bloom's Level)
	systemPrompt := strings.TrimSpace(fmt.Sprintf(`You are the official Myanmar National AI Teaching Copilot, an elite pedagogical curriculum designer grounded strictly in the Myanmar Ministry of Education (MoE) Basic Education Curriculum Framework (KG+12).

PEDAGOGICAL ROLE & RESPONSIBILITIES:
- Generate highly structured, comprehensive, time-accurate lesson plans strictly aligned with the official Myanmar MoE standards.
- Ground all learning outcomes and activities directly in the provided retrieved curriculum chunks and class competencies.
- Never output ungrounded assertions or generic content that ignores the retrieved MoE curriculum standard codes.

CURRICULUM CONSTRAINTS & CODING:
- You MUST cite and incorporate the official Myanmar MoE Curriculum Codes in the header and objectives (e.g., [%s]).
- Target Cognitive Depth: %s.
- Strictly adhere to the requested total duration of %d minutes, apportioning minutes across the required 5-phase sequence:
  Phase 1: Warm-Up & Hook (နိဒါန်းပျိုးခြင်းနှင့် စိတ်ဝင်စားမှု နှိုးဆွခြင်း)
  Phase 2: Direct Instruction & Teacher Modeling - "I Do" (ဆရာမှ တိုက်ရိုက်ရှင်းလင်းသင်ကြားခြင်း)
  Phase 3: Guided Practice - "We Do" (အဖွဲ့လိုက် ပူးပေါင်းလေ့ကျင့်ခြင်း)
  Phase 4: Independent Application - "You Do" (တစ်ဦးချင်း လွတ်လပ်စွာ လေ့ကျင့်ဆောင်ရွက်ခြင်း)
  Phase 5: Closure & Exit Ticket (သင်ခန်းစာ သုံးသပ်အကျဉ်းချုပ်နှင့် လက်မှတ်စစ်ဆေးခြင်း)

SAFETY & CULTURAL CONSTRAINTS:
- Child-Safe & Age-Appropriate: Maintain strict child safeguarding standards.
- Myanmar Cultural Inclusivity: Use culturally respectful, positive real-world examples reflecting Myanmar daily life, geography, and values.
- Formative Differentiation: Explicitly address the retrieved student performance gaps for tier-2 struggling learners and high-achievers.

STRICT FORMATTING RULES:
- Output in clean, beautiful Markdown with clear headings and bullet lists.
- NEVER use markdown tables (| ... |) or blockquotes (>). Use clear bold titles, bullet points, and numbered lists instead.
- Ensure the output completes all 6 core sections thoroughly without cutting off.`,
		getPrimaryCode(chunks), bloomsLevel, req.DurationMinutes,
	))

	// 2. Retrieved Context Assembly
	var ctxBuilder strings.Builder
	ctxBuilder.WriteString("=== RETRIEVED GROUNDING CONTEXT (VECTOR STORE TOP-K RETRIEVAL) ===\n\n")

	// 2a. Top-K=5 Curriculum Chunks
	ctxBuilder.WriteString("### [GROUNDING SOURCE 1]: Official Myanmar MoE Curriculum Standards (Top-5 Retrieved)\n")
	for i, chunk := range chunks {
		ctxBuilder.WriteString(fmt.Sprintf("%d. Standard Code: [%s]\n", i+1, chunk.StandardCode))
		ctxBuilder.WriteString(fmt.Sprintf("   Framework: %s\n", chunk.Framework))
		ctxBuilder.WriteString(fmt.Sprintf("   Unit & Topic: %s - %s\n", chunk.UnitTitle, chunk.Topic))
		ctxBuilder.WriteString(fmt.Sprintf("   Competency: %s\n", chunk.Competency))
		ctxBuilder.WriteString(fmt.Sprintf("   Learning Outcomes: %s\n", chunk.LearningOutcomes))
		ctxBuilder.WriteString(fmt.Sprintf("   Pedagogical Activities: %s\n", chunk.PedagogicalActivities))
		ctxBuilder.WriteString(fmt.Sprintf("   Burmese Content (မြန်မာမူ စံနှုန်း): %s\n", chunk.ContentBurmese))
		ctxBuilder.WriteString(fmt.Sprintf("   Similarity Match Score: %.2f%%\n\n", chunk.SimilarityScore*100))
	}

	// 2b. Top-K=3 Prior Lesson Plans
	ctxBuilder.WriteString("### [GROUNDING SOURCE 2]: Teacher's Prior Lesson Plans & Historical Reflections (Top-3 Retrieved)\n")
	for i, plan := range priorPlans {
		ctxBuilder.WriteString(fmt.Sprintf("%d. Prior Topic: %s (%s, %s)\n", i+1, plan.Topic, plan.Subject, plan.GradeLevel))
		ctxBuilder.WriteString(fmt.Sprintf("   Key Takeaways/Learnings: %s\n", plan.KeyLearnings))
		ctxBuilder.WriteString(fmt.Sprintf("   Similarity Match Score: %.2f%%\n\n", plan.SimilarityScore*100))
	}

	// 2c. Top-K=3 Student Performance Summaries
	ctxBuilder.WriteString("### [GROUNDING SOURCE 3]: Student Performance Summaries & Competency Gaps (Top-3 Retrieved)\n")
	for i, perf := range performance {
		ctxBuilder.WriteString(fmt.Sprintf("%d. Competency Domain: %s\n", i+1, perf.Competency))
		ctxBuilder.WriteString(fmt.Sprintf("   Class Benchmark Score: %.1f%% (%s)\n", perf.BenchmarkScore, perf.MasteryStatus))
		ctxBuilder.WriteString(fmt.Sprintf("   At-Risk Students Identified: %d\n", perf.AtRiskCount))
		ctxBuilder.WriteString(fmt.Sprintf("   Instructional Action Needed: %s\n", perf.PedagogicalNeed))
		ctxBuilder.WriteString(fmt.Sprintf("   Relevance Match Score: %.2f%%\n\n", perf.RelevanceScore*100))
	}

	retrievedContext := ctxBuilder.String()

	// 3. User Prompt Assembly (Teacher Intent + Class Profile)
	userPrompt := fmt.Sprintf(`%s

=== TEACHER INSTRUCTIONAL INTENT & CLASS PROFILE ===
- Subject: %s
- Target Grade Level: %s
- Core Topic: %s
- Allocated Duration: %d minutes
- Cognitive Taxonomy Target: %s
- Class Profile: Diverse classroom requiring visual manipulatives, bilingual keyword support, and tiered differentiation.

INSTRUCTIONS FOR GENERATION:
Using the Grounding Context above, construct an exemplary lesson plan strictly structured into:
1. Lesson Plan Header & MoE Alignment Standards (cite [%s])
2. Learning Objectives (SWBAT - Measurable with action verbs)
3. Essential Questions (High-order thinking inquiry)
4. Materials & Pedagogical Resources (including visual/concrete tools)
5. 5-Phase Instructional Sequence & Exact Time Breakdown (totaling %d mins)
6. Differentiation Strategies (directly addressing the 3 student competency gaps above)
7. Assessment & Evaluation (Formative exit ticket + summative rubric criteria)

Generate the full lesson plan in pristine Markdown now.`,
		retrievedContext,
		req.Subject, req.GradeLevel, req.Topic, req.DurationMinutes, bloomsLevel,
		getPrimaryCode(chunks), req.DurationMinutes,
	)

	return AssembledRAGPrompt{
		SystemPrompt:        systemPrompt,
		UserPrompt:          userPrompt,
		RetrievedContext:    retrievedContext,
		EstimatedTokensSys:  estimateTokens(systemPrompt),
		EstimatedTokensUser: estimateTokens(userPrompt),
		BloomsTarget:        bloomsLevel,
	}
}

func getPrimaryCode(chunks []CurriculumChunk) string {
	if len(chunks) > 0 {
		return chunks[0].StandardCode
	}
	return "MM-MOE-CURRICULUM-STD"
}

func estimateTokens(text string) int {
	// Rough heuristic: ~4 characters per token
	return len(text) / 4
}
