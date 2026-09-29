package transcript

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/google/uuid"
)

// Service provides high-level business operations for transcripts and report cards
type Service struct {
	mu          sync.RWMutex
	store       map[uuid.UUID]*OfficialReportCard
	hashIndex   map[string]*OfficialReportCard
	transcripts map[uuid.UUID]*CumulativeTranscript
}

func NewService() *Service {
	return &Service{
		store:       make(map[uuid.UUID]*OfficialReportCard),
		hashIndex:   make(map[string]*OfficialReportCard),
		transcripts: make(map[uuid.UUID]*CumulativeTranscript),
	}
}

// GenerateAndStoreReportCard compiles, signs, and indexes a new official report card
func (s *Service) GenerateAndStoreReportCard(
	ctx context.Context,
	studentID uuid.UUID,
	studentDID, nameEN, nameMM, rollNumber string,
	schoolID uuid.UUID,
	schoolNameEN, schoolNameMM, schoolCode string,
	academicYear, term, gradeLevel string,
	subjectScores map[string]float64,
	remarks map[string]string,
	rank, totalStudents int,
	presentDays, totalDays int,
	highlights []CompetencyHighlight,
) (*OfficialReportCard, error) {
	card, err := CompileReportCard(
		studentID, studentDID, nameEN, nameMM, rollNumber,
		schoolID, schoolNameEN, schoolNameMM, schoolCode,
		academicYear, term, gradeLevel,
		subjectScores, remarks,
		rank, totalStudents,
		presentDays, totalDays,
		highlights,
	)
	if err != nil {
		return nil, err
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	s.store[card.ID] = card
	s.hashIndex[card.VerificationHash] = card

	return card, nil
}

// GetReportCard retrieves a report card by ID
func (s *Service) GetReportCard(id uuid.UUID) (*OfficialReportCard, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	card, ok := s.store[id]
	if !ok {
		return nil, fmt.Errorf("report card not found: %s", id)
	}
	return card, nil
}

// VerifyReportCard checks if a cryptographic digest matches an official issued report card
func (s *Service) VerifyReportCard(hash string) (*OfficialReportCard, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	card, ok := s.hashIndex[hash]
	return card, ok
}

// CompileCumulativeTranscript combines multiple terms into a permanent graduation transcript
func (s *Service) CompileCumulativeTranscript(
	studentID uuid.UUID,
	studentDID, nameEN, nameMM, dob string,
	schoolID uuid.UUID,
	schoolNameEN, schoolCode string,
	terms []TermRecord,
	isGraduated bool,
) (*CumulativeTranscript, error) {
	if len(terms) == 0 {
		return nil, fmt.Errorf("cannot compile transcript with zero terms")
	}

	var totalGPA float64
	var totalCredits float64
	var totalDistinctions int
	hasFailed := false

	for _, t := range terms {
		totalGPA += t.GPA * t.CreditsEarned
		totalCredits += t.CreditsEarned
		for _, s := range t.Subjects {
			if s.IsDistinction {
				totalDistinctions++
			}
			if !s.IsPass {
				hasFailed = true
			}
		}
	}

	var cumulativeGPA float64
	if totalCredits > 0 {
		cumulativeGPA = roundTwoDecimals(totalGPA / totalCredits)
	}

	var standing StudentAcademicStanding
	if hasFailed {
		standing = StandingFailed
	} else if totalDistinctions > 0 {
		standing = StandingDistinction
	} else {
		standing = StandingPassed
	}

	status := "Active"
	var gradDate *string
	if isGraduated && !hasFailed {
		status = "Graduated"
		nowStr := time.Now().UTC().Format("2006-01-02")
		gradDate = &nowStr
	}

	ct := &CumulativeTranscript{
		ID:                 uuid.New(),
		StudentID:          studentID,
		StudentDID:         studentDID,
		StudentNameEN:      nameEN,
		StudentNameMM:      nameMM,
		DateOfBirth:        dob,
		SchoolID:           schoolID,
		SchoolNameEN:       schoolNameEN,
		SchoolCode:         schoolCode,
		GraduationDate:     gradDate,
		GraduationStatus:   status,
		CumulativeGPA:      cumulativeGPA,
		TotalCreditsEarned: totalCredits,
		Terms:              terms,
		OverallStanding:    standing,
		TotalDistinctions:  totalDistinctions,
		IssuerDID:          fmt.Sprintf("did:edu:school:%s", schoolCode),
		IssuedAt:           time.Now().UTC(),
	}

	// Compute verification hash
	firstCard := &OfficialReportCard{
		StudentID:          studentID,
		StudentDID:         studentDID,
		SchoolCode:         schoolCode,
		AcademicYear:       "Cumulative",
		Term:               "Permanent Record",
		TotalMarksObtained: totalGPA,
		AveragePercentage:  cumulativeGPA * 25.0,
		GPA:                cumulativeGPA,
		DistinctionsCount:  totalDistinctions,
		Standing:           standing,
	}
	h, _ := ComputeReportCardHash(firstCard)
	ct.VerificationHash = h

	s.mu.Lock()
	s.transcripts[studentID] = ct
	s.mu.Unlock()

	return ct, nil
}
