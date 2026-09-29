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

func TestMockLLMClientGenerateLessonPlanBurmese(t *testing.T) {
	client := NewMockLLMClient()

	req := LessonPlanPromptRequest{
		Subject:         "Mathematics",
		GradeLevel:      "Grade 8",
		Topic:           "Pythagorean Theorem",
		DurationMinutes: 50,
	}

	markdown, err := client.GenerateLessonPlanBurmese(context.Background(), req, "")
	if err != nil {
		t.Fatalf("unexpected error generating burmese lesson plan: %v", err)
	}

	if len(markdown) == 0 {
		t.Fatalf("generated burmese markdown should not be empty")
	}

	expectedSubstrings := []string{
		"သင်ရိုးညွှန်းတမ်းနှင့် ကိုက်ညီသော သင်ခန်းစာ အစီအစဉ်",
		"ဘာသာရပ်",
		"အတန်း",
		"သင်ယူမှု ရည်မှန်းချက်များ",
		"အဓိက မေးခွန်းများ",
		"သင်ကြားရေး အဆင့်ဆင့်နှင့် အချိန်ဇယား",
		"အဆင့် ၁: နိဒါန်းပျိုးခြင်း",
		"အကဲဖြတ် စစ်ဆေးခြင်း",
	}

	for _, sub := range expectedSubstrings {
		if !strings.Contains(markdown, sub) {
			t.Errorf("expected generated burmese markdown to contain %q", sub)
		}
	}
}

func TestMockLLMClientFrameworks(t *testing.T) {
	client := NewMockLLMClient()

	frameworks := []struct {
		code             string
		expectedSubstring string
	}{
		{"ib_pyp_myp", "IB World School"},
		{"cambridge", "Cambridge Assessment International Education"},
		{"model_5e", "5E Instructional Model"},
		{"udl", "Universal Design for Learning"},
	}

	for _, f := range frameworks {
		req := LessonPlanPromptRequest{
			Subject:              "General Science",
			GradeLevel:           "Grade 9",
			Topic:                "Photosynthesis Mechanism",
			DurationMinutes:      50,
			PedagogicalFramework: f.code,
			BloomsLevel:          "Analyze",
		}

		plan, err := client.GenerateLessonPlan(context.Background(), req)
		if err != nil {
			t.Fatalf("unexpected error for framework %s: %v", f.code, err)
		}
		if !strings.Contains(plan, f.expectedSubstring) {
			t.Errorf("expected plan for %s to contain %q", f.code, f.expectedSubstring)
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

	// Test DeepSeek with key
	c5 := NewLLMClientFactory("deepseek", "sk-deepseek", "", "")
	if oClient, ok := c5.(*OpenAIClient); !ok {
		t.Errorf("expected OpenAIClient when deepseek api key is provided")
	} else if oClient.baseURL != "https://api.deepseek.com" || oClient.model != "deepseek-chat" {
		t.Errorf("expected deepseek default baseURL and model, got %s and %s", oClient.baseURL, oClient.model)
	}
}
