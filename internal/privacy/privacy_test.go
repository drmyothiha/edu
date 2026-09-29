package privacy

import (
	"context"
	"strings"
	"testing"

	"github.com/google/uuid"
)

func TestPseudonymGeneration(t *testing.T) {
	anon := NewAnonymizer("test-salt-secret-key")
	id1 := uuid.New()
	id2 := uuid.New()

	pseudo1 := anon.GeneratePseudonym(id1)
	pseudo1Repeat := anon.GeneratePseudonym(id1)
	pseudo2 := anon.GeneratePseudonym(id2)

	if pseudo1 != pseudo1Repeat {
		t.Errorf("pseudonym generation must be deterministic for the same student ID")
	}
	if pseudo1 == pseudo2 {
		t.Errorf("different student IDs must yield different pseudonyms")
	}
	if !strings.HasPrefix(pseudo1, "ANON-") {
		t.Errorf("expected ANON- prefix, got: %s", pseudo1)
	}
}

func TestScrubStudentRecord(t *testing.T) {
	anon := NewAnonymizer("test-salt-secret-key")
	studentID := uuid.New()

	raw := &StudentPIIRecord{
		StudentID:      studentID,
		FullNameEN:     "Maung Mg Mg",
		FullNameMM:     "မောင်မောင်မောင်",
		DateOfBirth:    "2010-04-12",
		FatherName:     "U Ba",
		MotherName:     "Daw Mya",
		PhoneNumber:    "+95912345678",
		Address:        "No. 12 Bogyoke Road, Yangon",
		AvatarURL:      "https://storage.edu.gov.mm/avatars/student123.jpg",
		BiometricData:  "sha256-fingerprint-vector-129038",
		TownshipPCode:  "MMR013001",
		StatePCode:     "MMR013",
		AcademicYear:   "2026-2027",
		GradeLevel:     "Grade 10",
		FinalExamScore: 84.5,
		AttendanceRate: 98.2,
	}

	// De-identification mode
	summary, scrubbed, err := anon.ScrubStudentRecord(raw, RequestTypeDeIdentifyAnalytics)
	if err != nil {
		t.Fatalf("failed to scrub record: %v", err)
	}

	if len(scrubbed) == 0 {
		t.Errorf("expected scrubbed fields list to be non-empty")
	}

	// Statistical indicators must be preserved
	if summary.FinalExamScore != 84.5 {
		t.Errorf("expected final exam score 84.5 to be preserved, got %v", summary.FinalExamScore)
	}
	if summary.AttendanceRate != 98.2 {
		t.Errorf("expected attendance rate 98.2 to be preserved, got %v", summary.AttendanceRate)
	}
	if summary.TownshipPCode != "MMR013001" {
		t.Errorf("expected township pcode MMR013001 preserved, got %s", summary.TownshipPCode)
	}

	// Audit validation
	isValid := anon.ValidateScrubbedRecord(summary, raw)
	if !isValid {
		t.Errorf("validation failed: PII was detected or format was invalid")
	}
}

func TestPrivacyServiceWorkflow(t *testing.T) {
	svc := NewService("test-secret-salt")
	ctx := context.Background()

	studentID := uuid.New()
	req, err := svc.SubmitErasureRequest(
		ctx,
		studentID,
		"did:edu:mm:01:SCH01-2026-STU0099",
		nil,
		nil,
		RequestTypeDeIdentifyAnalytics,
		"GDPR-K Consent Revocation",
		"Student transferred abroad and requested data erasure",
	)
	if err != nil {
		t.Fatalf("unexpected error submitting erasure request: %v", err)
	}

	if req.Status != StatusPending {
		t.Errorf("expected status pending, got %s", req.Status)
	}

	raw := &StudentPIIRecord{
		StudentID:      studentID,
		FullNameEN:     "Zayar Min",
		FullNameMM:     "ဇေယျာမင်း",
		DateOfBirth:    "2009-08-15",
		FatherName:     "U Kyaw",
		PhoneNumber:    "+95998765432",
		FinalExamScore: 78.0,
		AttendanceRate: 95.0,
	}

	summary, executedReq, err := svc.ExecuteErasure(ctx, req.ID, nil, raw)
	if err != nil {
		t.Fatalf("failed to execute erasure: %v", err)
	}

	if executedReq.Status != StatusExecuted {
		t.Errorf("expected status executed, got %s", executedReq.Status)
	}
	if summary.Pseudonym == "" {
		t.Errorf("expected non-empty pseudonym")
	}

	logs := svc.GetAuditLogs()
	if len(logs) == 0 {
		t.Errorf("expected at least 1 audit log entry")
	}
	if logs[0].EventType != "PII_SCRUBBED" {
		t.Errorf("expected PII_SCRUBBED log event, got %s", logs[0].EventType)
	}
}
