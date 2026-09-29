package transcript

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"math"
	"sort"
	"time"

	"github.com/google/uuid"
)

// StandardSubjectDefinition provides default bilingual names and pass/distinction boundaries
type StandardSubjectDefinition struct {
	Code           string
	NameEN         string
	NameMM         string
	PassMark       float64
	DistinctionMin float64
	Credits        float64
}

var DefaultSubjectRegistry = map[string]StandardSubjectDefinition{
	"MYA":    {Code: "MYA", NameEN: "Myanmar Language", NameMM: "မြန်မာစာ", PassMark: 40.0, DistinctionMin: 75.0, Credits: 1.0},
	"ENG":    {Code: "ENG", NameEN: "English", NameMM: "အင်္ဂလိပ်စာ", PassMark: 40.0, DistinctionMin: 75.0, Credits: 1.0},
	"MTH":    {Code: "MTH", NameEN: "Mathematics", NameMM: "သင်္ချာ", PassMark: 40.0, DistinctionMin: 80.0, Credits: 1.0},
	"PHY":    {Code: "PHY", NameEN: "Physics", NameMM: "ရူပဗေဒ", PassMark: 40.0, DistinctionMin: 80.0, Credits: 1.0},
	"CHE":    {Code: "CHE", NameEN: "Chemistry", NameMM: "ဓာတုဗေဒ", PassMark: 40.0, DistinctionMin: 80.0, Credits: 1.0},
	"BIO":    {Code: "BIO", NameEN: "Biology", NameMM: "ဇီဝဗေဒ", PassMark: 40.0, DistinctionMin: 80.0, Credits: 1.0},
	"GEO":    {Code: "GEO", NameEN: "Geography", NameMM: "ပထဝီဝင်", PassMark: 40.0, DistinctionMin: 75.0, Credits: 1.0},
	"HIS":    {Code: "HIS", NameEN: "History", NameMM: "သမိုင်း", PassMark: 40.0, DistinctionMin: 75.0, Credits: 1.0},
	"ECO":    {Code: "ECO", NameEN: "Economics", NameMM: "ဘောဂဗေဒ", PassMark: 40.0, DistinctionMin: 75.0, Credits: 1.0},
	"SOCIAL": {Code: "SOCIAL", NameEN: "Social Studies", NameMM: "လူမှုရေးသိပ္ပံ", PassMark: 40.0, DistinctionMin: 75.0, Credits: 1.0},
}

// CalculateSubjectGrade processes a raw score into letter grade, grade points, and distinction
func CalculateSubjectGrade(code string, marks float64, remark string) SubjectMark {
	def, exists := DefaultSubjectRegistry[code]
	if !exists {
		def = StandardSubjectDefinition{
			Code:           code,
			NameEN:         code,
			NameMM:         code,
			PassMark:       40.0,
			DistinctionMin: 80.0,
			Credits:        1.0,
		}
	}

	isPass := marks >= def.PassMark
	isDistinction := marks >= def.DistinctionMin

	var letterGrade string
	var gradePoint float64

	switch {
	case marks >= 90.0:
		letterGrade = "A+"
		gradePoint = 4.0
	case marks >= 80.0:
		letterGrade = "A"
		gradePoint = 3.8
	case marks >= 70.0:
		letterGrade = "B"
		gradePoint = 3.0
	case marks >= 60.0:
		letterGrade = "C"
		gradePoint = 2.0
	case marks >= 40.0:
		letterGrade = "D"
		gradePoint = 1.0
	default:
		letterGrade = "F"
		gradePoint = 0.0
	}

	return SubjectMark{
		SubjectCode:    def.Code,
		SubjectNameEN:  def.NameEN,
		SubjectNameMM:  def.NameMM,
		MarksObtained:  roundTwoDecimals(marks),
		MaxMarks:       100.0,
		PassMark:       def.PassMark,
		DistinctionMin: def.DistinctionMin,
		LetterGrade:    letterGrade,
		GradePoint:     gradePoint,
		IsDistinction:  isDistinction,
		IsPass:         isPass,
		Credits:        def.Credits,
		TeacherRemark:  remark,
	}
}

// CompileReportCard compiles student performance into an official report card
func CompileReportCard(
	studentID uuid.UUID,
	studentDID string,
	nameEN, nameMM, rollNumber string,
	schoolID uuid.UUID,
	schoolNameEN, schoolNameMM, schoolCode string,
	academicYear, term, gradeLevel string,
	rawSubjectScores map[string]float64,
	remarks map[string]string,
	classRank, totalClassStudents int,
	presentDays, totalDays int,
	wholeChildHighlights []CompetencyHighlight,
) (*OfficialReportCard, error) {
	var subjects []SubjectMark
	var totalObtained float64
	var totalMax float64
	var totalWeightedGP float64
	var totalCredits float64
	distinctionsCount := 0
	hasFailedSubject := false

	// Sorted keys for deterministic output
	keys := make([]string, 0, len(rawSubjectScores))
	for k := range rawSubjectScores {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	for _, code := range keys {
		score := rawSubjectScores[code]
		remark := remarks[code]
		sub := CalculateSubjectGrade(code, score, remark)
		subjects = append(subjects, sub)

		totalObtained += sub.MarksObtained
		totalMax += sub.MaxMarks
		totalWeightedGP += sub.GradePoint * sub.Credits
		totalCredits += sub.Credits

		if sub.IsDistinction {
			distinctionsCount++
		}
		if !sub.IsPass {
			hasFailedSubject = true
		}
	}

	var avgPercentage float64
	if totalMax > 0 {
		avgPercentage = roundTwoDecimals((totalObtained / totalMax) * 100.0)
	}

	var gpa float64
	if totalCredits > 0 {
		gpa = roundTwoDecimals(totalWeightedGP / totalCredits)
	}

	var standing StudentAcademicStanding
	if hasFailedSubject || len(subjects) == 0 {
		standing = StandingFailed
	} else if distinctionsCount > 0 {
		standing = StandingDistinction
	} else {
		standing = StandingPassed
	}

	var attendanceRate float64
	if totalDays > 0 {
		attendanceRate = roundTwoDecimals((float64(presentDays) / float64(totalDays)) * 100.0)
	}

	issuerDID := fmt.Sprintf("did:edu:school:%s", schoolCode)
	now := time.Now().UTC()

	card := &OfficialReportCard{
		ID:                    uuid.New(),
		StudentID:             studentID,
		StudentDID:            studentDID,
		StudentNameEN:         nameEN,
		StudentNameMM:         nameMM,
		StudentRollNumber:     rollNumber,
		SchoolID:              schoolID,
		SchoolNameEN:          schoolNameEN,
		SchoolNameMM:          schoolNameMM,
		SchoolCode:            schoolCode,
		AcademicYear:          academicYear,
		Term:                  term,
		GradeLevel:            gradeLevel,
		ClassRank:             classRank,
		TotalClassStudents:    totalClassStudents,
		Subjects:              subjects,
		TotalMarksObtained:    roundTwoDecimals(totalObtained),
		TotalMaxMarks:         roundTwoDecimals(totalMax),
		AveragePercentage:     avgPercentage,
		GPA:                   gpa,
		DistinctionsCount:     distinctionsCount,
		Standing:              standing,
		AttendanceDaysPresent: presentDays,
		AttendanceTotalDays:   totalDays,
		AttendanceRate:        attendanceRate,
		WholeChildHighlights:  wholeChildHighlights,
		IssuerDID:             issuerDID,
		IssuedAt:              now,
	}

	// Compute canonical cryptographic verification hash
	hash, err := ComputeReportCardHash(card)
	if err != nil {
		return nil, fmt.Errorf("failed to compute report card hash: %w", err)
	}
	card.VerificationHash = hash

	return card, nil
}

// ComputeReportCardHash creates a canonical SHA-256 digest of the academic results
func ComputeReportCardHash(rc *OfficialReportCard) (string, error) {
	type DigestPayload struct {
		StudentID          string        `json:"student_id"`
		StudentDID         string        `json:"student_did"`
		SchoolCode         string        `json:"school_code"`
		AcademicYear       string        `json:"academic_year"`
		Term               string        `json:"term"`
		TotalMarksObtained float64       `json:"total_marks_obtained"`
		AveragePercentage  float64       `json:"average_percentage"`
		GPA                float64       `json:"gpa"`
		DistinctionsCount  int           `json:"distinctions_count"`
		Standing           string        `json:"standing"`
		Subjects           []SubjectMark `json:"subjects"`
	}

	payload := DigestPayload{
		StudentID:          rc.StudentID.String(),
		StudentDID:         rc.StudentDID,
		SchoolCode:         rc.SchoolCode,
		AcademicYear:       rc.AcademicYear,
		Term:               rc.Term,
		TotalMarksObtained: rc.TotalMarksObtained,
		AveragePercentage:  rc.AveragePercentage,
		GPA:                rc.GPA,
		DistinctionsCount:  rc.DistinctionsCount,
		Standing:           string(rc.Standing),
		Subjects:           rc.Subjects,
	}

	raw, err := json.Marshal(payload)
	if err != nil {
		return "", err
	}
	h := sha256.Sum256(raw)
	return "0x" + hex.EncodeToString(h[:]), nil
}

func roundTwoDecimals(val float64) float64 {
	return math.Round(val*100.0) / 100.0
}
