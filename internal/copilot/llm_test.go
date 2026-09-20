package copilot

import (
	"context"
	"strings"
	"testing"
)

func TestMockLLMClientGenerateLessonPlan(t *testing.T) {
	client := NewMockLLMClient()

	req := LessonPlanPromptRequest{
		Subject:         "Mathematics",
		GradeLevel:      "Grade 8",
		Topic:           "Pythagorean Theorem",
		DurationMinutes: 50,
	}

	markdown, err := client.GenerateLessonPlan(context.Background(), req)
	if err != nil {
		t.Fatalf("unexpected error generating lesson plan: %v", err)
	}

	if len(markdown) == 0 {
		t.Fatalf("generated markdown should not be empty")
	}

	expectedSubstrings := []string{
		"Pythagorean Theorem",
		"Mathematics",
		"Grade 8",
		"Learning Objectives",
		"Instructional Sequence & Timeline",
		"Phase 1: Warm-Up",
		"Phase 2: Direct Instruction",
		"Differentiation Strategies",
		"Assessment & Evaluation",
	}

	for _, sub := range expectedSubstrings {
		if !strings.Contains(markdown, sub) {
			t.Errorf("expected generated markdown to contain %q", sub)
		}
	}
}

func TestLLMClientFactory(t *testing.T) {
	// Test mock fallback
	c1 := NewLLMClientFactory("unknown", "", "", "")
	if _, ok := c1.(*MockLLMClient); !ok {
		t.Errorf("expected MockLLMClient for unknown provider")
	}

	// Test OpenAI with empty key falls back to mock
	c2 := NewLLMClientFactory("openai", "", "", "")
	if _, ok := c2.(*MockLLMClient); !ok {
		t.Errorf("expected MockLLMClient when openai api key is empty")
	}

	// Test OpenAI with key
	c3 := NewLLMClientFactory("openai", "sk-test", "", "")
	if _, ok := c3.(*OpenAIClient); !ok {
		t.Errorf("expected OpenAIClient when openai api key is provided")
	}

	// Test Anthropic with key
	c4 := NewLLMClientFactory("anthropic", "ant-key", "", "")
	if _, ok := c4.(*AnthropicClient); !ok {
		t.Errorf("expected AnthropicClient when anthropic api key is provided")
	}
}
