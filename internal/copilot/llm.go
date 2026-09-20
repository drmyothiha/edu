package copilot

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// LessonPlanPromptRequest contains the input parameters for lesson plan generation
type LessonPlanPromptRequest struct {
	Subject         string `json:"subject"`
	GradeLevel      string `json:"grade_level"`
	Topic           string `json:"topic"`
	DurationMinutes int    `json:"duration_minutes"`
}

// LLMClient is the pluggable interface for LLM providers (e.g. Mock, OpenAI, Anthropic)
type LLMClient interface {
	GenerateLessonPlan(ctx context.Context, req LessonPlanPromptRequest) (string, error)
}

// MockLLMClient generates high-quality deterministic lesson plans without external API dependencies
type MockLLMClient struct{}

// NewMockLLMClient creates an instance of MockLLMClient
func NewMockLLMClient() *MockLLMClient {
	return &MockLLMClient{}
}

// GenerateLessonPlan creates a comprehensive, curriculum-aligned lesson plan in Markdown
func (m *MockLLMClient) GenerateLessonPlan(ctx context.Context, req LessonPlanPromptRequest) (string, error) {
	duration := req.DurationMinutes
	if duration <= 0 {
		duration = 45
	}

	warmupTime := duration / 9
	if warmupTime < 5 {
		warmupTime = 5
	}
	instructionTime := duration / 3
	guidedTime := duration / 3
	independentTime := duration - warmupTime - instructionTime - guidedTime - 5
	if independentTime < 5 {
		independentTime = 5
	}
	closureTime := 5

	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("# Curriculum-Aligned Lesson Plan: %s\n\n", req.Topic))
	sb.WriteString(fmt.Sprintf("**Subject:** %s  \n", req.Subject))
	sb.WriteString(fmt.Sprintf("**Grade Level:** %s  \n", req.GradeLevel))
	sb.WriteString(fmt.Sprintf("**Total Duration:** %d minutes  \n", duration))
	sb.WriteString(fmt.Sprintf("**Alignment Standard:** National & State Common Core Framework (%s)\n\n", req.Subject))

	sb.WriteString("## 1. Learning Objectives\n")
	sb.WriteString("By the end of this lesson, students will be able to (SWBAT):\n")
	sb.WriteString(fmt.Sprintf("- Define the foundational terminology and principles governing **%s**.\n", req.Topic))
	sb.WriteString(fmt.Sprintf("- Apply analytical reasoning to solve real-world problems involving **%s** with at least 80%% accuracy.\n", req.Topic))
	sb.WriteString(fmt.Sprintf("- Collaborate with peers to explain the conceptual mechanics of **%s**.\n\n", req.Topic))

	sb.WriteString("## 2. Essential Questions\n")
	sb.WriteString(fmt.Sprintf("- Why is understanding **%s** essential in %s and daily problem solving?\n", req.Topic, req.Subject))
	sb.WriteString("- How can we model and test this concept through evidence and practice?\n\n")

	sb.WriteString("## 3. Materials & Resources\n")
	sb.WriteString("- Interactive whiteboard / projector\n")
	sb.WriteString(fmt.Sprintf("- Guided student inquiry worksheets on *%s*\n", req.Topic))
	sb.WriteString("- Digital graphing/reference tools and exit tickets\n")
	sb.WriteString("- Formative assessment rubric\n\n")

	sb.WriteString("## 4. Instructional Sequence & Timeline\n\n")
	sb.WriteString(fmt.Sprintf("### Phase 1: Warm-Up & Hook (%d mins)\n", warmupTime))
	sb.WriteString(fmt.Sprintf("- **Focus Activity:** Present a provocative inquiry challenge or puzzle illustrating %s.\n", req.Topic))
	sb.WriteString("- **Prior Knowledge Activation:** Quick think-pair-share reviewing prerequisites.\n\n")

	sb.WriteString(fmt.Sprintf("### Phase 2: Direct Instruction & Modeling (%d mins)\n", instructionTime))
	sb.WriteString(fmt.Sprintf("- **Teacher Modeling (I Do):** Deconstruct %s into core rules, step-by-step mechanisms, and common misconceptions.\n", req.Topic))
	sb.WriteString("- **Visual Mapping:** Draw annotated diagrams and explicit worked examples on the board.\n\n")

	sb.WriteString(fmt.Sprintf("### Phase 3: Guided Practice (%d mins)\n", guidedTime))
	sb.WriteString(fmt.Sprintf("- **Collaborative Work (We Do):** Pairs tackle scaffolded problems on %s.\n", req.Topic))
	sb.WriteString("- **Formative Check:** Teacher conducts targeted circulating checks, addressing misunderstandings immediately.\n\n")

	sb.WriteString(fmt.Sprintf("### Phase 4: Independent Application (%d mins)\n", independentTime))
	sb.WriteString(fmt.Sprintf("- **Individual Practice (You Do):** Students complete differentiated exercise sets reinforcing %s.\n", req.Topic))
	sb.WriteString("- **Peer Check:** Optional quick self-check against the rubric.\n\n")

	sb.WriteString(fmt.Sprintf("### Phase 5: Closure & Exit Ticket (%d mins)\n", closureTime))
	sb.WriteString("- **Debrief:** Revisit the essential question; 2 students volunteer summarizing takeaways.\n")
	sb.WriteString(fmt.Sprintf("- **Exit Slip:** 2-question pulse check evaluating core mastery of %s.\n\n", req.Topic))

	sb.WriteString("## 5. Differentiation Strategies\n")
	sb.WriteString("- **Support (Tier 2 / ELL / IEP):** Graphic organizers, formula reference cards, step-by-step problem checklists.\n")
	sb.WriteString("- **Extension (Gifted & Talented):** Advanced synthesis questions exploring multi-variable scenarios or historical context.\n\n")

	sb.WriteString("## 6. Assessment & Evaluation\n")
	sb.WriteString("- **Formative:** Guided practice observation and exit ticket score (>= 80% benchmark).\n")
	sb.WriteString(fmt.Sprintf("- **Summative Link:** Informs upcoming unit quiz and homework assignment for %s.\n", req.Subject))

	return sb.String(), nil
}

// OpenAIClient implements LLMClient using standard OpenAI/compatible Chat Completions API
type OpenAIClient struct {
	apiKey     string
	baseURL    string
	model      string
	httpClient *http.Client
}

// NewOpenAIClient initializes an OpenAI-compatible client
func NewOpenAIClient(apiKey, baseURL, model string) *OpenAIClient {
	if baseURL == "" {
		baseURL = "https://api.openai.com/v1"
	}
	if model == "" {
		model = "gpt-4o-mini"
	}
	return &OpenAIClient{
		apiKey:  apiKey,
		baseURL: strings.TrimRight(baseURL, "/"),
		model:   model,
		httpClient: &http.Client{
			Timeout: 45 * time.Second,
		},
	}
}

type openAIChatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type openAIChatRequest struct {
	Model       string              `json:"model"`
	Messages    []openAIChatMessage `json:"messages"`
	Temperature float64             `json:"temperature"`
}

type openAIChatResponse struct {
	Choices []struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
	} `json:"choices"`
	Error *struct {
		Message string `json:"message"`
	} `json:"error,omitempty"`
}

// GenerateLessonPlan calls the OpenAI chat completion API
func (c *OpenAIClient) GenerateLessonPlan(ctx context.Context, req LessonPlanPromptRequest) (string, error) {
	if c.apiKey == "" {
		return "", fmt.Errorf("openai api key is not configured")
	}

	systemPrompt := "You are an elite master teacher and educational curriculum designer. " +
		"Create comprehensive, pedagogical, highly structured lesson plans formatted strictly in Markdown. " +
		"Include Learning Objectives (SWBAT), Essential Questions, Materials, Step-by-Step Timeline, Differentiation, and Assessment."

	userPrompt := fmt.Sprintf(
		"Generate a detailed, curriculum-aligned lesson plan for:\n"+
			"- Subject: %s\n"+
			"- Grade Level: %s\n"+
			"- Topic: %s\n"+
			"- Duration: %d minutes\n\n"+
			"Please output in clean Markdown with clear headings and formatting.",
		req.Subject, req.GradeLevel, req.Topic, req.DurationMinutes,
	)

	payload := openAIChatRequest{
		Model: c.model,
		Messages: []openAIChatMessage{
			{Role: "system", Content: systemPrompt},
			{Role: "user", Content: userPrompt},
		},
		Temperature: 0.7,
	}

	bodyBytes, err := json.Marshal(payload)
	if err != nil {
		return "", fmt.Errorf("failed to encode request: %w", err)
	}

	endpoint := fmt.Sprintf("%s/chat/completions", c.baseURL)
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(bodyBytes))
	if err != nil {
		return "", fmt.Errorf("failed to create http request: %w", err)
	}

	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+c.apiKey)

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return "", fmt.Errorf("http request failed: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read response body: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("llm provider returned status %d: %s", resp.StatusCode, string(respBody))
	}

	var parsed openAIChatResponse
	if err := json.Unmarshal(respBody, &parsed); err != nil {
		return "", fmt.Errorf("failed to parse llm response: %w", err)
	}

	if parsed.Error != nil {
		return "", fmt.Errorf("llm error: %s", parsed.Error.Message)
	}

	if len(parsed.Choices) == 0 {
		return "", fmt.Errorf("llm returned no choices")
	}

	return parsed.Choices[0].Message.Content, nil
}

// AnthropicClient implements LLMClient using Anthropic Messages API
type AnthropicClient struct {
	apiKey     string
	baseURL    string
	model      string
	httpClient *http.Client
}

// NewAnthropicClient initializes an Anthropic client
func NewAnthropicClient(apiKey, baseURL, model string) *AnthropicClient {
	if baseURL == "" {
		baseURL = "https://api.anthropic.com/v1"
	}
	if model == "" {
		model = "claude-3-5-sonnet-20241022"
	}
	return &AnthropicClient{
		apiKey:  apiKey,
		baseURL: strings.TrimRight(baseURL, "/"),
		model:   model,
		httpClient: &http.Client{
			Timeout: 45 * time.Second,
		},
	}
}

type anthropicMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type anthropicRequest struct {
	Model     string             `json:"model"`
	MaxTokens int                `json:"max_tokens"`
	System    string             `json:"system"`
	Messages  []anthropicMessage `json:"messages"`
}

type anthropicResponse struct {
	Content []struct {
		Type string `json:"type"`
		Text string `json:"text"`
	} `json:"content"`
	Error *struct {
		Type    string `json:"type"`
		Message string `json:"message"`
	} `json:"error,omitempty"`
}

// GenerateLessonPlan calls the Anthropic Messages API
func (a *AnthropicClient) GenerateLessonPlan(ctx context.Context, req LessonPlanPromptRequest) (string, error) {
	if a.apiKey == "" {
		return "", fmt.Errorf("anthropic api key is not configured")
	}

	systemPrompt := "You are an elite master teacher and educational curriculum designer. " +
		"Create comprehensive, pedagogical, highly structured lesson plans formatted strictly in Markdown. " +
		"Include Learning Objectives (SWBAT), Essential Questions, Materials, Step-by-Step Timeline, Differentiation, and Assessment."

	userPrompt := fmt.Sprintf(
		"Generate a detailed, curriculum-aligned lesson plan for:\n"+
			"- Subject: %s\n"+
			"- Grade Level: %s\n"+
			"- Topic: %s\n"+
			"- Duration: %d minutes\n\n"+
			"Please output in clean Markdown with clear headings and formatting.",
		req.Subject, req.GradeLevel, req.Topic, req.DurationMinutes,
	)

	payload := anthropicRequest{
		Model:     a.model,
		MaxTokens: 4096,
		System:    systemPrompt,
		Messages: []anthropicMessage{
			{Role: "user", Content: userPrompt},
		},
	}

	bodyBytes, err := json.Marshal(payload)
	if err != nil {
		return "", fmt.Errorf("failed to encode anthropic request: %w", err)
	}

	endpoint := fmt.Sprintf("%s/messages", a.baseURL)
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(bodyBytes))
	if err != nil {
		return "", fmt.Errorf("failed to create http request: %w", err)
	}

	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("x-api-key", a.apiKey)
	httpReq.Header.Set("anthropic-version", "2023-06-01")

	resp, err := a.httpClient.Do(httpReq)
	if err != nil {
		return "", fmt.Errorf("http request to anthropic failed: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read response body: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("anthropic returned status %d: %s", resp.StatusCode, string(respBody))
	}

	var parsed anthropicResponse
	if err := json.Unmarshal(respBody, &parsed); err != nil {
		return "", fmt.Errorf("failed to parse anthropic response: %w", err)
	}

	if parsed.Error != nil {
		return "", fmt.Errorf("anthropic error: %s", parsed.Error.Message)
	}

	var sb strings.Builder
	for _, c := range parsed.Content {
		if c.Type == "text" {
			sb.WriteString(c.Text)
		}
	}

	if sb.Len() == 0 {
		return "", fmt.Errorf("anthropic returned empty response")
	}

	return sb.String(), nil
}

// NewLLMClientFactory returns the configured LLMClient based on environment / provider name
func NewLLMClientFactory(provider, apiKey, baseURL, model string) LLMClient {
	switch strings.ToLower(provider) {
	case "openai":
		if apiKey != "" {
			return NewOpenAIClient(apiKey, baseURL, model)
		}
		return NewMockLLMClient()
	case "anthropic":
		if apiKey != "" {
			return NewAnthropicClient(apiKey, baseURL, model)
		}
		return NewMockLLMClient()
	default:
		return NewMockLLMClient()
	}
}
