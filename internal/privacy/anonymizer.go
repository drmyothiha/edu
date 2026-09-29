package privacy

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
)

// Anonymizer handles cryptographic pseudonymization and PII purging
type Anonymizer struct {
	pepper []byte
}

func NewAnonymizer(pepper string) *Anonymizer {
	if pepper == "" {
		pepper = "myanmar-edu-privacy-salt-pepper-2026"
	}
	return &Anonymizer{
		pepper: []byte(pepper),
	}
}

// GeneratePseudonym generates a deterministic, non-reversible cryptographic pseudonym
func (a *Anonymizer) GeneratePseudonym(studentID uuid.UUID) string {
	mac := hmac.New(sha256.New, a.pepper)
	mac.Write([]byte(studentID.String()))
	sum := mac.Sum(nil)
	// Return "ANON-" prefix followed by first 16 characters of HMAC hex
	return fmt.Sprintf("ANON-%s", hex.EncodeToString(sum[:8]))
}

// ScrubStudentRecord transforms a raw PII record into an anonymized analytical summary
func (a *Anonymizer) ScrubStudentRecord(record *StudentPIIRecord, requestType RequestType) (*AnonymizedStudentSummary, []string, error) {
	if record == nil {
		return nil, nil, fmt.Errorf("cannot scrub nil record")
	}

	pseudonym := a.GeneratePseudonym(record.StudentID)
	scrubbedFields := []string{
		"full_name_en",
		"full_name_mm",
		"date_of_birth",
		"father_name",
		"mother_name",
		"phone_number",
		"address",
		"avatar_url",
		"biometric_data",
	}

	if requestType == RequestTypeFullErasure {
		// Zero out all statistical fields as well
		scrubbedFields = append(scrubbedFields, "final_exam_score", "attendance_rate", "township_pcode", "state_pcode")
		return &AnonymizedStudentSummary{
			Pseudonym:    pseudonym,
			AnonymizedAt: time.Now().UTC(),
		}, scrubbedFields, nil
	}

	// De-identify: preserve broad regional cohort statistics (state/township p-code, grade, year, score)
	summary := &AnonymizedStudentSummary{
		Pseudonym:      pseudonym,
		StatePCode:     record.StatePCode,
		TownshipPCode:  record.TownshipPCode,
		AcademicYear:   record.AcademicYear,
		GradeLevel:     record.GradeLevel,
		FinalExamScore: record.FinalExamScore,
		AttendanceRate: record.AttendanceRate,
		AnonymizedAt:   time.Now().UTC(),
	}

	return summary, scrubbedFields, nil
}

// ValidateScrubbedRecord verifies that no sensitive substrings remain
func (a *Anonymizer) ValidateScrubbedRecord(summary *AnonymizedStudentSummary, original *StudentPIIRecord) bool {
	if summary == nil || original == nil {
		return false
	}

	// Pseudonym must not match original ID
	if summary.Pseudonym == original.StudentID.String() {
		return false
	}

	// Ensure no personal name or phone exists in any summary field
	fields := []string{
		summary.Pseudonym,
		summary.StatePCode,
		summary.TownshipPCode,
		summary.GradeLevel,
	}

	sensitiveSubstrings := []string{
		strings.ToLower(original.FullNameEN),
		strings.ToLower(original.FullNameMM),
		original.PhoneNumber,
		original.FatherName,
		original.MotherName,
	}

	for _, text := range fields {
		lowerText := strings.ToLower(text)
		for _, sens := range sensitiveSubstrings {
			if sens != "" && strings.Contains(lowerText, sens) {
				return false
			}
		}
	}

	return true
}
