package transcript

import (
	"context"
	"strings"
	"testing"

	"github.com/google/uuid"
)

func TestCalculateSubjectGrade(t *testing.T) {
	// Distinction in Maths (>= 80)
	mathDist := CalculateSubjectGrade("MTH", 85.5, "Excellent analytical ability")
	if !mathDist.IsDistinction {
		t.Errorf("expected distinction for Maths 85.5")
	}
	if mathDist.LetterGrade != "A" {
		t.Errorf("expected A for 85.5, got %s", mathDist.LetterGrade)
	}
	if mathDist.GradePoint != 3.8 {
		t.Errorf("expected 3.8 grade point, got %v", mathDist.GradePoint)
	}

	// Passing grade in English (65 -> C)
	engPass := CalculateSubjectGrade("ENG", 65.0, "Good vocabulary")
	if !engPass.IsPass {
		t.Errorf("expected pass for 65.0")
	}
	if engPass.IsDistinction {
		t.Errorf("did not expect distinction for English 65.0")
	}
	if engPass.LetterGrade != "C" {
		t.Errorf("expected C for 65.0, got %s", engPass.LetterGrade)
	}

	// Failing grade in Physics (< 40)
	phyFail := CalculateSubjectGrade("PHY", 35.0, "Needs remedial study")
	if phyFail.IsPass {
		t.Errorf("expected fail for Physics 35.0")
	}
	if phyFail.LetterGrade != "F" {
		t.Errorf("expected F, got %s", phyFail.LetterGrade)
	}
}

func TestCompileReportCardAndHash(t *testing.T) {
	scores := map[string]float64{
		"MYA": 82.0, // Distinction (>=75)
		"ENG": 78.0, // Distinction (>=75)
		"MTH": 92.0, // Distinction & A+ (>=80 & >=90)
		"PHY": 84.0, // Distinction (>=80)
		"CHE": 76.0, // Pass (need 80 for dist)
		"BIO": 80.0, // Distinction (>=80)
	}
	remarks := map[string]string{
		"MTH": "Top in math olympiad prep",
	}

	studentID := uuid.New()
	schoolID := uuid.New()

	card, err := CompileReportCard(
		studentID, "did:edu:mm:01:BEHS01-2026-STU0001",
		"Aung Kyaw", "အောင်ကျော်", "10-A-01",
		schoolID, "No. 1 Basic Education High School Dagon", "အမှတ်(၁) အခြေခံပညာအထက်တန်းကျောင်း ဒဂုံ", "MMR013001001-BEHS01",
		"2026-2027", "Final Examination", "Grade 10-A",
		scores, remarks,
		1, 45,
		175, 180,
		nil,
	)
	if err != nil {
		t.Fatalf("unexpected error compiling report card: %v", err)
	}

	if card.DistinctionsCount != 5 {
		t.Errorf("expected 5 distinctions, got %d", card.DistinctionsCount)
	}
	if card.Standing != StandingDistinction {
		t.Errorf("expected StandingDistinction, got %s", card.Standing)
	}
	if card.ClassRank != 1 {
		t.Errorf("expected rank 1, got %d", card.ClassRank)
	}
	if card.AttendanceRate <= 97.0 || card.AttendanceRate >= 98.0 {
		t.Errorf("expected attendance rate ~97.22, got %v", card.AttendanceRate)
	}
	if !strings.HasPrefix(card.VerificationHash, "0x") {
		t.Errorf("expected 0x prefixed verification hash, got %s", card.VerificationHash)
	}
}

func TestTranscriptServiceWorkflow(t *testing.T) {
	svc := NewService()
	ctx := context.Background()

	scores := map[string]float64{
		"MYA": 65.0,
		"ENG": 70.0,
		"MTH": 75.0,
	}

	card, err := svc.GenerateAndStoreReportCard(
		ctx,
		uuid.New(), "did:edu:mm:01:SCH01-2026-STU0042",
		"Su Su", "စုစု", "10-B-12",
		uuid.New(), "BEHS 2 Bahan", "အထက ၂ ဗဟန်း", "SCH01",
		"2026-2027", "Semester 1", "Grade 10-B",
		scores, nil,
		5, 40,
		95, 100,
		nil,
	)
	if err != nil {
		t.Fatalf("failed to store report card: %v", err)
	}

	retrieved, err := svc.GetReportCard(card.ID)
	if err != nil {
		t.Fatalf("failed to get report card: %v", err)
	}
	if retrieved.GPA <= 0.0 {
		t.Errorf("expected non-zero GPA, got %v", retrieved.GPA)
	}

	// Verify Hash
	found, valid := svc.VerifyReportCard(card.VerificationHash)
	if !valid || found.ID != card.ID {
		t.Errorf("verification failed for valid hash: %s", card.VerificationHash)
	}

	// Tampered Hash
	_, validBad := svc.VerifyReportCard("0x0000000000000000000000000000000000000000000000000000000000000000")
	if validBad {
		t.Errorf("expected verification to fail for fake hash")
	}
}
