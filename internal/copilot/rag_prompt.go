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
	bloomsLevel := req.BloomsLevel
	if bloomsLevel == "" {
		if len(chunks) > 0 && chunks[0].BloomsLevel != "" {
			bloomsLevel = fmt.Sprintf("%s (Bloom's Taxonomy Level)", chunks[0].BloomsLevel)
		} else {
			bloomsLevel = "Apply (လက်တွေ့ အသုံးချမှု အဆင့်)"
		}
	}

	framework := strings.ToLower(req.PedagogicalFramework)
	frameworkTitle := "Myanmar MoE Curriculum Framework (KG+12)"
	switch framework {
	case "ib_pyp_myp":
		frameworkTitle = "International Baccalaureate (IB PYP/MYP Inquiry Cycle)"
	case "cambridge":
		frameworkTitle = "Cambridge Assessment International Education (CAIE Active Learning)"
	case "model_5e":
		frameworkTitle = "5E Instructional Model (Engage, Explore, Explain, Elaborate, Evaluate)"
	case "udl":
		frameworkTitle = "Universal Design for Learning (UDL Guidelines 2.2)"
	}

	// 1. System Prompt (Role, Safety, Curriculum & Framework Constraints, Bloom's Level)
	systemPrompt := strings.TrimSpace(fmt.Sprintf(`You are the official Global AI Teaching Copilot, an elite pedagogical curriculum designer grounded in both international school standards (%s) and national frameworks (including the Myanmar Ministry of Education MoE Basic Education Curriculum Framework KG+12).

PEDAGOGICAL ROLE & RESPONSIBILITIES:
- Generate highly structured, comprehensive, time-accurate lesson plans strictly aligned with the requested pedagogical framework: %s.
- Ground all learning outcomes and activities directly in the provided retrieved curriculum chunks, class competencies, and global inquiry standards.
- Never output ungrounded assertions or generic content that ignores standard competency codes.

CURRICULUM CONSTRAINTS & CODING:
- You MUST cite and incorporate standard curriculum codes in the header and objectives (e.g., [%s]).
- Target Cognitive Depth: %s.
- Pedagogical Framework Requested: %s.
- Strictly adhere to the requested total duration of %d minutes, apportioning minutes across the required framework sequence.

SAFETY & CULTURAL CONSTRAINTS:
- Child-Safe & Age-Appropriate: Maintain strict child safeguarding standards.
- Inclusivity & Equity: Use culturally respectful, positive real-world examples reflecting local and global contexts.
- Formative Differentiation & Universal Design: Address retrieved student performance gaps for tier-2 struggling learners, ELLs, and high-achievers.

STRICT FORMATTING RULES:
- Output in clean, beautiful Markdown with clear headings and bullet lists.
- NEVER use markdown tables (| ... |) or blockquotes (>). Use clear bold titles, bullet points, and numbered lists instead.
- Ensure the output completes all core sections thoroughly without cutting off.`,
		frameworkTitle, frameworkTitle, getPrimaryCode(chunks), bloomsLevel, frameworkTitle, req.DurationMinutes,
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
