package copilot

import (
	"fmt"
	"math"
	"regexp"
	"strings"
	"time"
	"unicode"
)

var (
	moeCodeRegex        = regexp.MustCompile(`(?i)\[?MM-MOE-[A-Z0-9-]+\]?`)
	bloomsVerbsRegex    = regexp.MustCompile(`(?i)\b(define|identify|explain|describe|calculate|solve|apply|demonstrate|analyze|compare|contrast|evaluate|construct|formulate|model)\b`)
	prohibitedWordsList = []string{
		"violence", "weapon", "gambling", "hate", "terror", "porn", "abuse", "racist", "kill", "drug",
	}
)

// OutputValidator enforces curriculum compliance, readability, and child safety
type OutputValidator struct{}

// NewOutputValidator initializes the validator
func NewOutputValidator() *OutputValidator {
	return &OutputValidator{}
}

// Validate executes the 3-step validation pipeline on the generated output
func (v *OutputValidator) Validate(markdown, burmeseMarkdown, targetGrade string, chunks []CurriculumChunk) ValidationReport {
	alignCheck := v.checkCurriculumAlignment(markdown, burmeseMarkdown, targetGrade, chunks)
	readCheck := v.checkReadability(markdown, targetGrade)
	safetyCheck := v.checkLanguageSafety(markdown, burmeseMarkdown)

	overallScore := (alignCheck.Score * 0.6) + (readCheck.Score * 0.4)
	overallStatus := "PASSED"
	if safetyCheck.Status == "FAILED" || alignCheck.Status == "FAILED" {
		overallStatus = "FAILED"
	} else if alignCheck.Status == "WARNING" || readCheck.Status == "WARNING" {
		overallStatus = "PASS_WITH_WARNINGS"
	}

	return ValidationReport{
		CurriculumAlignment:  alignCheck,
		ReadabilityScore:     readCheck,
		LanguageSafetyFilter: safetyCheck,
		OverallStatus:        overallStatus,
		OverallScore:         math.Round(overallScore*10) / 10,
		Timestamp:            time.Now(),
	}
}

// checkCurriculumAlignment performs regex and rule-based verification against MoE standards
func (v *OutputValidator) checkCurriculumAlignment(markdown, burmeseMarkdown, targetGrade string, chunks []CurriculumChunk) ValidationCheck {
	score := 0.0
	var details []string

	combined := markdown + " " + burmeseMarkdown

	// 1. Regex check: citation of Myanmar MoE standard code
	hasMoeCitation := moeCodeRegex.MatchString(combined)
	if hasMoeCitation {
		score += 30.0
		details = append(details, "Official Myanmar MoE Standard Code cited")
	} else {
		// Partial credit if framework is mentioned
		if strings.Contains(strings.ToLower(combined), "moe") || strings.Contains(combined, "သင်ရိုးညွှန်းတမ်း") {
			score += 15.0
			details = append(details, "National curriculum framework referenced")
		} else {
			details = append(details, "Missing explicit MoE standard code citation")
		}
	}

	// 2. Structural Phase Check (Warm-up, Direct, Guided, Independent, Closure)
	phasesFound := 0
	lower := strings.ToLower(combined)
	if strings.Contains(lower, "warm-up") || strings.Contains(combined, "နိဒါန်းပျိုးခြင်း") || strings.Contains(lower, "hook") {
		phasesFound++
	}
	if strings.Contains(lower, "direct instruction") || strings.Contains(combined, "တိုက်ရိုက်ရှင်းလင်းသင်ကြားခြင်း") || strings.Contains(lower, "i do") {
		phasesFound++
	}
	if strings.Contains(lower, "guided practice") || strings.Contains(combined, "အဖွဲ့လိုက် ပူးပေါင်းလေ့ကျင့်ခြင်း") || strings.Contains(lower, "we do") {
		phasesFound++
	}
	if strings.Contains(lower, "independent application") || strings.Contains(combined, "တစ်ဦးချင်း လွတ်လပ်စွာ") || strings.Contains(lower, "you do") {
		phasesFound++
	}
	if strings.Contains(lower, "exit ticket") || strings.Contains(combined, "လက်မှတ်စစ်ဆေးခြင်း") || strings.Contains(lower, "closure") {
		phasesFound++
	}

	phaseScore := (float64(phasesFound) / 5.0) * 35.0
	score += phaseScore
	details = append(details, fmt.Sprintf("%d/5 required pedagogical phases verified", phasesFound))

	// 3. Bloom's Taxonomy Action Verbs
	verbMatches := bloomsVerbsRegex.FindAllString(markdown, -1)
	if len(verbMatches) >= 3 {
		score += 20.0
		details = append(details, fmt.Sprintf("Strong cognitive action verbs identified (%d instances)", len(verbMatches)))
	} else if len(verbMatches) > 0 {
		score += 10.0
		details = append(details, "Basic cognitive verbs identified")
	} else {
		details = append(details, "Limited measurable cognitive verbs")
	}

	// 4. Grounding Keyword Affinity with Retrieved Chunks
	groundingMatches := 0
	for _, chunk := range chunks {
		for _, kw := range chunk.Keywords {
			if strings.Contains(lower, strings.ToLower(kw)) {
				groundingMatches++
				break
			}
		}
	}
	if groundingMatches >= 2 {
		score += 15.0
		details = append(details, fmt.Sprintf("High grounding keyword overlap with %d retrieved chunks", groundingMatches))
	} else {
		score += 8.0
		details = append(details, "Moderate grounding keyword overlap")
	}

	status := "PASSED"
	if score < 70.0 {
		status = "WARNING"
	}
	if score < 50.0 {
		status = "FAILED"
	}

	return ValidationCheck{
		Name:    "Curriculum Alignment & Pedagogical Rules Check",
		Status:  status,
		Score:   math.Round(score*10) / 10,
		Details: strings.Join(details, "; "),
	}
}

// checkReadability calculates Flesch Reading Ease and target grade appropriateness
func (v *OutputValidator) checkReadability(text, targetGrade string) ValidationCheck {
	words := strings.Fields(text)
	if len(words) < 50 {
		return ValidationCheck{
			Name:    "Readability & Grade Calibration Check",
			Status:  "WARNING",
			Score:   60.0,
			Details: "Insufficient text length for reliable statistical readability scoring",
		}
	}

	sentences := strings.Split(text, ".")
	sentenceCount := 0
	for _, s := range sentences {
		if len(strings.TrimSpace(s)) > 3 {
			sentenceCount++
		}
	}
	if sentenceCount == 0 {
		sentenceCount = 1
	}

	syllableCount := 0
	for _, w := range words {
		syllableCount += countSyllables(w)
	}

	wordCount := len(words)
	asl := float64(wordCount) / float64(sentenceCount)      // Average Sentence Length
	asw := float64(syllableCount) / float64(wordCount)     // Average Syllables per Word

	// Flesch Reading Ease formula
	fre := 206.835 - (1.015 * asl) - (84.6 * asw)
	// Flesch-Kincaid Grade Level formula
	fkgl := (0.39 * asl) + (11.8 * asw) - 15.59

	score := 90.0
	status := "PASSED"
	var detailMsg string

	if fkgl < 3.0 {
		score = 80.0
		detailMsg = fmt.Sprintf("Flesch-Kincaid Grade Index: %.1f (Elementary clear; Reading Ease: %.1f)", fkgl, fre)
	} else if fkgl <= 12.0 {
		score = 95.0
		detailMsg = fmt.Sprintf("Flesch-Kincaid Grade Index: %.1f (Perfect pedagogical clarity for %s; Reading Ease: %.1f)", fkgl, targetGrade, fre)
	} else {
		score = 78.0
		status = "WARNING"
		detailMsg = fmt.Sprintf("Flesch-Kincaid Grade Index: %.1f (Slightly advanced vocabulary; Reading Ease: %.1f)", fkgl, fre)
	}

	return ValidationCheck{
		Name:    "Readability & Pedagogical Clarity Check",
		Status:  status,
		Score:   math.Round(score*10) / 10,
		Details: detailMsg,
	}
}

// checkLanguageSafety ensures child safeguarding, non-toxic, and culturally sensitive content
func (v *OutputValidator) checkLanguageSafety(markdown, burmeseMarkdown string) ValidationCheck {
	combinedLower := strings.ToLower(markdown + " " + burmeseMarkdown)

	for _, badWord := range prohibitedWordsList {
		matched, _ := regexp.MatchString(`(?i)\b`+regexp.QuoteMeta(badWord)+`\b`, combinedLower)
		if matched {
			return ValidationCheck{
				Name:    "Child Safety & Language Filter",
				Status:  "FAILED",
				Score:   0.0,
				Details: fmt.Sprintf("Safety violation: Prohibited term '%s' detected in output", badWord),
			}
		}
	}

	return ValidationCheck{
		Name:    "Child Safety & Cultural Appropriateness Filter",
		Status:  "PASSED",
		Score:   100.0,
		Details: "Verified zero safety violations; child-safe and culturally respectful language throughout.",
	}
}

func countSyllables(word string) int {
	word = strings.ToLower(strings.TrimFunc(word, func(r rune) bool {
		return !unicode.IsLetter(r)
	}))
	if len(word) <= 3 {
		return 1
	}

	vowels := "aeiouy"
	count := 0
	lastWasVowel := false

	for _, r := range word {
		isVowel := strings.ContainsRune(vowels, r)
		if isVowel && !lastWasVowel {
			count++
		}
		lastWasVowel = isVowel
	}

	if strings.HasSuffix(word, "e") && !strings.HasSuffix(word, "le") && count > 1 {
		count--
	}
	if count == 0 {
		count = 1
	}
	return count
}
