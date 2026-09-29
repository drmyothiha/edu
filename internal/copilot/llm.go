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
	GenerateLessonPlanBurmese(ctx context.Context, req LessonPlanPromptRequest, englishMarkdown string) (string, error)
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

// GenerateLessonPlanBurmese creates a comprehensive, Myanmar curriculum-aligned lesson plan in Burmese
func (m *MockLLMClient) GenerateLessonPlanBurmese(ctx context.Context, req LessonPlanPromptRequest, englishMarkdown string) (string, error) {
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
	sb.WriteString(fmt.Sprintf("# သင်ရိုးညွှန်းတမ်းနှင့် ကိုက်ညီသော သင်ခန်းစာ အစီအစဉ်: %s\n\n", req.Topic))
	sb.WriteString(fmt.Sprintf("**ဘာသာရပ် (Subject):** %s  \n", req.Subject))
	sb.WriteString(fmt.Sprintf("**အတန်း (Grade Level):** %s  \n", req.GradeLevel))
	sb.WriteString(fmt.Sprintf("**ကြာချိန် (Total Duration):** %d မိနစ်  \n", duration))
	sb.WriteString(fmt.Sprintf("**ကိုက်ညီမှု စံနှုန်း (Alignment Standard):** နိုင်ငံတော် အခြေခံပညာ သင်ရိုးညွှန်းတမ်း မူဘောင် (%s)\n\n", req.Subject))

	sb.WriteString("## ၁။ သင်ယူမှု ရည်မှန်းချက်များ (Learning Objectives)\n")
	sb.WriteString("ဤသင်ခန်းစာ ပြီးဆုံးချိန်တွင် ကျောင်းသား/သူများသည် (SWBAT):\n")
	sb.WriteString(fmt.Sprintf("- **%s** နှင့် သက်ဆိုင်သော အခြေခံ ဝေါဟာရများ၊ အဓိပ္ပာယ်ဖွင့်ဆိုချက်များနှင့် စည်းမျဉ်းများကို ရှင်းလင်းစွာ ဖော်ပြနိုင်မည်။\n", req.Topic))
	sb.WriteString(fmt.Sprintf("- လက်တွေ့ပြဿနာ ဖြေရှင်းမှုများတွင် **%s** ကို အသုံးချ၍ အနည်းဆုံး ၈၀%% တိကျစွာ တွက်ချက်/ခွဲခြမ်းစိတ်ဖြာနိုင်မည်။\n", req.Topic))
	sb.WriteString(fmt.Sprintf("- အတန်းဖော်များနှင့် ပူးပေါင်းဆွေးနွေးပြီး **%s** ၏ အဓိက ယန္တရားများကို အပြန်အလှန် ရှင်းပြနိုင်မည်။\n\n", req.Topic))

	sb.WriteString("## ၂။ အဓိက မေးခွန်းများ (Essential Questions)\n")
	sb.WriteString(fmt.Sprintf("- နေ့စဉ် လူနေမှုဘဝနှင့် %s ဘာသာရပ်တွင် **%s** ကို နားလည်သဘောပေါက်ရန် အဘယ်ကြောင့် အရေးကြီးသနည်း?\n", req.Subject, req.Topic))
	sb.WriteString("- ဤသဘောတရားကို သက်သေအထောက်အထားများနှင့် လက်တွေ့လေ့ကျင့်မှုများမှတစ်ဆင့် မည်သို့ စမ်းသပ်လေ့လာနိုင်သနည်း?\n\n")

	sb.WriteString("## ၃။ သင်ထောက်ကူ ပစ္စည်းများနှင့် အရင်းအမြစ်များ (Materials & Resources)\n")
	sb.WriteString("- သင်ပုန်းကြီး / ပရိုဂျက်တာ (Interactive Whiteboard / Projector)\n")
	sb.WriteString(fmt.Sprintf("- *%s* ဆိုင်ရာ လမ်းညွှန် လေ့ကျင့်ခန်း စာရွက်များ (Guided Inquiry Worksheets)\n", req.Topic))
	sb.WriteString("- ဒစ်ဂျစ်တယ် ကိုးကားချက် ကိရိယာများနှင့် သင်ခန်းစာပြီးမြောက်မှု ထွက်ခွာလက်မှတ်စစ်ကတ်များ (Exit Tickets)\n")
	sb.WriteString("- ပုံစံတကျ အကဲဖြတ်မှု စံနှုန်းသတ်မှတ်ချက် ရူဘရစ် (Formative Assessment Rubric)\n\n")

	sb.WriteString("## ၄။ သင်ကြားရေး အဆင့်ဆင့်နှင့် အချိန်ဇယား (Instructional Sequence & Timeline)\n\n")
	sb.WriteString(fmt.Sprintf("### အဆင့် ၁: နိဒါန်းပျိုးခြင်းနှင့် စိတ်ဝင်စားမှု နှိုးဆွခြင်း (Warm-Up & Hook) (%d မိနစ်)\n", warmupTime))
	sb.WriteString(fmt.Sprintf("- **အာရုံစူးစိုက်မှု လှုပ်ရှားမှု:** %s ကို စတင်ချဉ်းကပ်နိုင်ရန် စိတ်ဝင်စားဖွယ် စိန်ခေါ်မှု ပုစ္ဆာ သို့မဟုတ် မေးခွန်းတိုဖြင့် စတင်ခြင်း။\n", req.Topic))
	sb.WriteString("- **ယခင် ဗဟုသုတ နိုးကြားစေခြင်း:** မိတ်ဖက်သူငယ်ချင်းနှင့် ယခင် သင်ခန်းစာ အခြေခံများကို ပြန်လည် ဆွေးနွေးခြင်း (Think-Pair-Share)။\n\n")

	sb.WriteString(fmt.Sprintf("### အဆင့် ၂: ဆရာမှ တိုက်ရိုက်ရှင်းလင်းသင်ကြားခြင်း (Direct Instruction & Modeling - I Do) (%d မိနစ်)\n", instructionTime))
	sb.WriteString(fmt.Sprintf("- **ဆရာ၏ သရုပ်ပြရှင်းလင်းမှု:** %s ၏ အဓိက သဘောတရား၊ အဆင့်ဆင့် တွက်ချက်ပုံနှင့် အဖြစ်များသော အလွဲအမှားများကို စနစ်တကျ ရှင်းပြခြင်း။\n", req.Topic))
	sb.WriteString("- **ပုံကြမ်းနှင့် သရုပ်ပြ ပုံဆွဲခြင်း:** သင်ပုန်းပေါ်တွင် ရှင်းလင်းသော ပုံကြမ်းများနှင့် တွက်နည်း ဥပမာများကို အဆင့်ဆင့် ရေးဆွဲပြသခြင်း။\n\n")

	sb.WriteString(fmt.Sprintf("### အဆင့် ၃: အဖွဲ့လိုက် ပူးပေါင်းလေ့ကျင့်ခြင်း (Guided Practice - We Do) (%d မိနစ်)\n", guidedTime))
	sb.WriteString(fmt.Sprintf("- **ပူးပေါင်း ဆောင်ရွက်ခြင်း:** ကျောင်းသားများ နှစ်ဦးတွဲ (Pairs) သို့မဟုတ် အဖွဲ့ငယ်ဖွဲ့၍ %s ဆိုင်ရာ ပုစ္ဆာများကို အတူတကွ ဖြေရှင်းခြင်း။\n", req.Topic))
	sb.WriteString("- **ဆရာ၏ စောင့်ကြည့်ကူညီမှု:** ဆရာမှ အတန်းအတွင်း လှည့်လည်စစ်ဆေးပြီး လိုအပ်သော ရှင်းလင်းချက်များကို အချိန်နှင့်တစ်ပြေးညီ ပံ့ပိုးပေးခြင်း။\n\n")

	sb.WriteString(fmt.Sprintf("### အဆင့် ၄: တစ်ဦးချင်း လွတ်လပ်စွာ လေ့ကျင့်ဆောင်ရွက်ခြင်း (Independent Application - You Do) (%d မိနစ်)\n", independentTime))
	sb.WriteString(fmt.Sprintf("- **တစ်ဦးချင်း လေ့ကျင့်ခြင်း:** ကျောင်းသားတစ်ဦးချင်းစီမှ %s ဆိုင်ရာ ကွဲပြားသော လေ့ကျင့်ခန်းအတွဲများကို ကိုယ်တိုင် ဖြေဆိုဆောင်ရွက်ခြင်း။\n", req.Topic))
	sb.WriteString("- **အပြန်အလှန် စစ်ဆေးခြင်း:** မိတ်ဖက်သူငယ်ချင်းနှင့် ရူဘရစ်စံနှုန်းအတိုင်း အဖြေတိုက်ဆိုင် စစ်ဆေးခြင်း။\n\n")

	sb.WriteString(fmt.Sprintf("### အဆင့် ၅: သင်ခန်းစာ သုံးသပ်အကျဉ်းချုပ်နှင့် လက်မှတ်စစ်ဆေးခြင်း (Closure & Exit Ticket) (%d မိနစ်)\n", closureTime))
	sb.WriteString("- **အနှစ်ချုပ် ဆွေးနွေးခြင်း:** အဓိက မေးခွန်းကို ပြန်လည်မေးမြန်းပြီး ကျောင်းသား ၂ ဦးအား သင်ယူရရှိချက် အကျဉ်းချုပ်ကို ပြောကြားစေခြင်း။\n")
	sb.WriteString(fmt.Sprintf("- **ထွက်ခွာလက်မှတ် (Exit Slip):** %s ၏ အဓိက တတ်မြောက်မှုကို အကဲဖြတ်စစ်ဆေးသည့် မေးခွန်းတို ၂ ခုကို ဖြေဆိုစေခြင်း။\n\n", req.Topic))

	sb.WriteString("## ၅။ ကွဲပြားသော သင်ယူမှု လိုအပ်ချက်များအလိုက် ပံ့ပိုးမှု (Differentiation Strategies)\n")
	sb.WriteString("- **အကူအညီ လိုအပ်သော ကျောင်းသားများအတွက် (Tier 2 / Remedial Support):** ဇယားများ၊ ဖော်မြူလာ ကိုးကားကတ်များနှင့် အဆင့်ဆင့် ဖြေရှင်းနည်း လမ်းညွှန်များ ပံ့ပိုးပေးခြင်း။\n")
	sb.WriteString("- **ထူးချွန်ကျောင်းသားများအတွက် (Gifted & Talented Extension):** ပိုမိုနက်နဲသော စဉ်းစားတွေးခေါ်မှု ပုစ္ဆာများနှင့် လက်တွေ့ ကိန်းဂဏန်း ဆန်းစစ်မှုများကို စူးစမ်းခိုင်းခြင်း။\n\n")

	sb.WriteString("## ၆။ အကဲဖြတ် စစ်ဆေးခြင်း (Assessment & Evaluation)\n")
	sb.WriteString("- **စဉ်ဆက်မပြတ် အကဲဖြတ်ခြင်း (Formative):** အဖွဲ့လိုက် ပူးပေါင်းဆောင်ရွက်မှု စောင့်ကြည့်မှတ်တမ်းနှင့် ထွက်ခွာလက်မှတ် ရမှတ် (အနည်းဆုံး ၈၀% စံသတ်မှတ်ချက်)။\n")
	sb.WriteString(fmt.Sprintf("- **အဆုံးသတ် စစ်ဆေးမှု ချိတ်ဆက်ခြင်း (Summative Link):** %s ဘာသာရပ်၏ လာမည့် ယူနစ်စာမေးပွဲနှင့် အိမ်စာတာဝန်များနှင့် ချိတ်ဆက် သတ်မှတ်ခြင်း။\n", req.Subject))

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
			Timeout: 120 * time.Second,
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
	MaxTokens   int                 `json:"max_tokens,omitempty"`
}

type openAIChatResponse struct {
	Choices []struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
		FinishReason string `json:"finish_reason"`
	} `json:"choices"`
	Error *struct {
		Message string `json:"message"`
	} `json:"error,omitempty"`
}

// completeChat executes chat completion with automatic continuation if token limit (finish_reason=length) is encountered
func (c *OpenAIClient) completeChat(ctx context.Context, systemPrompt, userPrompt string, temperature float64, maxTokens int) (string, error) {
	messages := []openAIChatMessage{
		{Role: "system", Content: systemPrompt},
		{Role: "user", Content: userPrompt},
	}

	var fullContent strings.Builder

	for iter := 0; iter < 3; iter++ {
		payload := openAIChatRequest{
			Model:       c.model,
			Messages:    messages,
			Temperature: temperature,
			MaxTokens:   maxTokens,
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

		respBody, err := io.ReadAll(resp.Body)
		resp.Body.Close()
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

		choice := parsed.Choices[0]
		chunk := choice.Message.Content
		fullContent.WriteString(chunk)

		// Check if generation completed naturally
		if choice.FinishReason != "length" {
			break
		}

		// Response reached token ceiling; request continuation starting exactly where it cut off
		messages = append(messages,
			openAIChatMessage{Role: "assistant", Content: chunk},
			openAIChatMessage{Role: "user", Content: "Your previous response was cut off by token limits. Please continue writing immediately from the exact point where it was cut off and finish all remaining sections (especially Phase 5 closing, Exit Ticket, and Assessment) to the final end. Do NOT repeat any previous text."},
		)
	}

	result := strings.TrimSpace(fullContent.String())
	if result == "" {
		return "", fmt.Errorf("llm returned empty content")
	}

	return result, nil
}

// GenerateLessonPlan calls the OpenAI chat completion API
func (c *OpenAIClient) GenerateLessonPlan(ctx context.Context, req LessonPlanPromptRequest) (string, error) {
	if c.apiKey == "" {
		return "", fmt.Errorf("openai api key is not configured")
	}

	systemPrompt := "You are an elite master teacher and educational curriculum designer. " +
		"Create comprehensive, pedagogical, highly structured lesson plans formatted strictly in Markdown. " +
		"Include Learning Objectives (SWBAT), Essential Questions, Materials, Step-by-Step Timeline (5 phases totaling the requested duration), Differentiation, and Assessment. " +
		"Strict formatting constraints: Do NOT use markdown tables (| ... |) or blockquote markers (>). Use structured bullet points, clear subheadings, and bold text instead. " +
		"Structure the content concisely so that all sections fit cleanly and complete thoroughly from beginning to end without cutting off."

	userPrompt := fmt.Sprintf(
		"Generate a structured, curriculum-aligned lesson plan for:\n"+
			"- Subject: %s\n"+
			"- Grade Level: %s\n"+
			"- Topic: %s\n"+
			"- Duration: %d minutes\n\n"+
			"Formatting & Structural rules:\n"+
			"- Output in clean Markdown with clear headings and bullet lists.\n"+
			"- Never use markdown tables (| ... |) or blockquote characters (>). Use lists and bold labels instead.\n"+
			"- Keep explanations concise and actionable for classroom delivery (approx. 1,000-1,400 words).\n"+
			"- Ensure all 5 instructional phases, differentiation, and the closing assessment/exit ticket finish completely.",
		req.Subject, req.GradeLevel, req.Topic, req.DurationMinutes,
	)

	return c.completeChat(ctx, systemPrompt, userPrompt, 0.7, 4096)
}

// GenerateLessonPlanBurmese calls OpenAI to generate or translate the lesson plan into authentic Myanmar (Burmese) language
func (c *OpenAIClient) GenerateLessonPlanBurmese(ctx context.Context, req LessonPlanPromptRequest, englishMarkdown string) (string, error) {
	if c.apiKey == "" {
		return "", fmt.Errorf("openai api key is not configured")
	}

	systemPrompt := "You are a master Myanmar educator and senior curriculum designer for the Ministry of Education. " +
		"Translate and synthesize lesson plans into authentic, natural, professional Myanmar (Burmese) language using official MoE curriculum terminology. " +
		"Format strictly in clean Markdown with clear headings and bullet lists. " +
		"Strict formatting constraints: Do NOT use markdown tables (| ... |) or blockquote markers (>). Use bullet points and bold text instead. " +
		"Structure the content with high pedagogical efficiency so every single section—especially Phase 5 (Closing/Exit Ticket) and final Assessment—is fully written out and finished to the end with standard Myanmar punctuation (။). Never truncate or leave sentences unfinished."

	userPrompt := fmt.Sprintf(
		"Translate and structure the following lesson plan into professional Myanmar (Burmese) language:\n"+
			"- Subject: %s\n"+
			"- Grade Level: %s\n"+
			"- Topic: %s\n"+
			"- Duration: %d minutes\n\n"+
			"Reference English Lesson Plan:\n%s\n\n"+
			"Requirements:\n"+
			"1. Translate into clear, high-yield Burmese Markdown with these exact sections:\n"+
			"   - # သင်ခန်းစာ အစီအစဉ်: [ခေါင်းစဉ်]\n"+
			"   - ## ၁။ သင်ယူမှု ရည်မှန်းချက်များ (Learning Objectives / SWBAT)\n"+
			"   - ## ၂။ အဓိက မေးခွန်းများနှင့် ဝေါဟာရများ (Essential Questions & Key Vocabulary)\n"+
			"   - ## ၃။ သင်ထောက်ကူ ပစ္စည်းများ (Materials)\n"+
			"   - ## ၄။ သင်ကြားရေး အဆင့်ဆင့် (5 Instructional Phases with timestamps totaling %d min: နိဒါန်း၊ လမ်းညွှန်သင်ကြားခြင်း၊ အဖွဲ့လိုက်လေ့ကျင့်ခြင်း၊ တစ်ဦးချင်းလေ့ကျင့်ခြင်း၊ နိဂုံးချုပ်ခြင်းနှင့် ထွက်ပေါက်လက်မှတ်)\n"+
			"   - ## ၅။ ကွဲပြားသော ပံ့ပိုးမှု (Differentiation: အကူအညီလိုအပ်သူများနှင့် ထူးချွန်သူများ)\n"+
			"   - ## ၆။ အကဲဖြတ် စစ်ဆေးခြင်းနှင့် ထွက်ပေါက်လက်မှတ် (Assessment & Exit Ticket)\n"+
			"2. Concise Pedagogical Phrasing: Keep teacher scripts, student prompts, and explanations concise and focused so the entire plan fits within output limits.\n"+
			"3. Complete Finish: Ensure Section ၄, Section ၅, and Section ၆ with the Exit Ticket (ထွက်ပေါက်လက်မှတ်) finish completely with standard Myanmar punctuation (။). Never cut off mid-sentence.",
		req.Subject, req.GradeLevel, req.Topic, req.DurationMinutes, englishMarkdown, req.DurationMinutes,
	)

	return c.completeChat(ctx, systemPrompt, userPrompt, 0.7, 4096)
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
			Timeout: 120 * time.Second,
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
	System    string             `json:"system,omitempty"`
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

// GenerateLessonPlan calls Anthropic messages API
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

// GenerateLessonPlanBurmese calls Anthropic to generate or translate into authentic Myanmar (Burmese) language
func (a *AnthropicClient) GenerateLessonPlanBurmese(ctx context.Context, req LessonPlanPromptRequest, englishMarkdown string) (string, error) {
	if a.apiKey == "" {
		return "", fmt.Errorf("anthropic api key is not configured")
	}

	systemPrompt := "You are a master educator and curriculum designer in Myanmar. " +
		"Generate or accurately translate curriculum lesson plans into authentic, natural Myanmar (Burmese) language with standard Burmese educational terminology. " +
		"Format strictly in clean Markdown with clear headings and bullet points."

	userPrompt := fmt.Sprintf(
		"Generate a detailed, curriculum-aligned lesson plan in Myanmar (Burmese) language for:\n"+
			"- Subject: %s\n"+
			"- Grade Level: %s\n"+
			"- Topic: %s\n"+
			"- Duration: %d minutes\n\n"+
			"Reference English Lesson Plan:\n%s\n\n"+
			"Translate and structure this into clear, professional Burmese Markdown with standard sections (သင်ယူမှု ရည်မှန်းချက်များ, အဓိက မေးခွန်းများ, သင်ထောက်ကူ ပစ္စည်းများ, သင်ကြားရေး အဆင့်ဆင့်, ကွဲပြားသော ပံ့ပိုးမှု, အကဲဖြတ် စစ်ဆေးခြင်း).",
		req.Subject, req.GradeLevel, req.Topic, req.DurationMinutes, englishMarkdown,
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
	case "deepseek":
		if apiKey != "" {
			if baseURL == "" || baseURL == "https://api.openai.com/v1" {
				baseURL = "https://api.deepseek.com"
			}
			if model == "" || model == "gpt-4o-mini" {
				model = "deepseek-chat"
			}
			return NewOpenAIClient(apiKey, baseURL, model)
		}
		return NewMockLLMClient()
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

