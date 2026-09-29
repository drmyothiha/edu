package transcript

import (
	"time"

	"github.com/google/uuid"
)

// SubjectMark holds raw marks and grading outputs for a specific curriculum subject
type SubjectMark struct {
	SubjectCode    string  `json:"subject_code"`             // e.g. "MYA", "ENG", "MTH", "PHY", "CHE", "BIO"
	SubjectNameEN  string  `json:"subject_name_en"`          // e.g. "Mathematics"
	SubjectNameMM  string  `json:"subject_name_mm"`          // e.g. "သင်္ချာ"
	MarksObtained  float64 `json:"marks_obtained"`           // 0.00 - 100.00
	MaxMarks       float64 `json:"max_marks"`                // default 100.00
	PassMark       float64 `json:"pass_mark"`                // default 40.00 (Myanmar Basic Education standard)
	DistinctionMin float64 `json:"distinction_min"`          // 75.00 or 80.00 depending on subject
	LetterGrade    string  `json:"letter_grade"`             // "A+", "A", "B", "C", "D", "F"
	GradePoint     float64 `json:"grade_point"`              // 0.00 to 4.00
	IsDistinction  bool    `json:"is_distinction"`           // true if marked as "ဂုဏ်ထူး"
	IsPass         bool    `json:"is_pass"`
	Credits        float64 `json:"credits"`                  // default 1.0 or 0.5
	TeacherRemark  string  `json:"teacher_remark,omitempty"`
}

// StudentAcademicStanding represents the overall academic status
type StudentAcademicStanding string

const (
	StandingDistinction StudentAcademicStanding = "Passed with Distinction" // ဂုဏ်ထူးဖြင့် အောင်မြင်သည်
	StandingPassed      StudentAcademicStanding = "Passed"                  // ရိုးရိုး အောင်မြင်သည်
	StandingFailed      StudentAcademicStanding = "Failed"                  // ကျရှုံးသည်
	StandingIncomplete  StudentAcademicStanding = "Incomplete"
)

// CompetencyHighlight represents Whole-Child mastery summary in the transcript
type CompetencyHighlight struct {
	Domain     string `json:"domain"`      // "Cognitive", "Physical", "Social-Emotional", "Civic"
	Competency string `json:"competency"`  // e.g. "Critical Problem Solving", "Team Leadership"
	Level      string `json:"level"`       // "Mastered", "Proficient", "Developing"
}

// OfficialReportCard contains complete compiled term-level student performance
type OfficialReportCard struct {
	ID                     uuid.UUID               `json:"id"`
	StudentID              uuid.UUID               `json:"student_id"`
	StudentDID             string                  `json:"student_did"`
	StudentNameEN          string                  `json:"student_name_en"`
	StudentNameMM          string                  `json:"student_name_mm"`
	StudentRollNumber      string                  `json:"student_roll_number"`
	SchoolID               uuid.UUID               `json:"school_id"`
	SchoolNameEN           string                  `json:"school_name_en"`
	SchoolNameMM           string                  `json:"school_name_mm"`
	SchoolCode             string                  `json:"school_code"`
	AcademicYear           string                  `json:"academic_year"` // e.g. "2026-2027"
	Term                   string                  `json:"term"`          // e.g. "Semester 1", "Final Examination"
	GradeLevel             string                  `json:"grade_level"`   // e.g. "Grade 10 - Section A"
	ClassRank              int                     `json:"class_rank"`
	TotalClassStudents     int                     `json:"total_class_students"`
	Subjects               []SubjectMark           `json:"subjects"`
	TotalMarksObtained     float64                 `json:"total_marks_obtained"`
	TotalMaxMarks          float64                 `json:"total_max_marks"`
	AveragePercentage      float64                 `json:"average_percentage"`
	GPA                    float64                 `json:"gpa"` // 4.0 scale
	DistinctionsCount      int                     `json:"distinctions_count"`
	Standing               StudentAcademicStanding `json:"standing"`
	AttendanceDaysPresent  int                     `json:"attendance_days_present"`
	AttendanceTotalDays    int                     `json:"attendance_total_days"`
	AttendanceRate         float64                 `json:"attendance_rate"` // e.g. 96.5%
	WholeChildHighlights   []CompetencyHighlight   `json:"whole_child_highlights,omitempty"`
	PrincipalRemarks       string                  `json:"principal_remarks"`
	HomeroomTeacherRemarks string                  `json:"homeroom_teacher_remarks"`
	VerificationHash       string                  `json:"verification_hash"` // 0xsha256 anti-tamper hash
	IssuerDID              string                  `json:"issuer_did"`
	CertifiedBy            *uuid.UUID              `json:"certified_by,omitempty"`
	CertifiedAt            *time.Time              `json:"certified_at,omitempty"`
	IssuedAt               time.Time               `json:"issued_at"`
}

// TermRecord summarizes one term's performance in a multi-year graduation transcript
type TermRecord struct {
	AcademicYear      string        `json:"academic_year"`
	Term              string        `json:"term"`
	GradeLevel        string        `json:"grade_level"`
	GPA               float64       `json:"gpa"`
	CreditsEarned     float64       `json:"credits_earned"`
	AveragePercentage float64       `json:"average_percentage"`
	Subjects          []SubjectMark `json:"subjects"`
}

// CumulativeTranscript represents a student's permanent graduation record
type CumulativeTranscript struct {
	ID                 uuid.UUID               `json:"id"`
	StudentID          uuid.UUID               `json:"student_id"`
	StudentDID         string                  `json:"student_did"`
	StudentNameEN      string                  `json:"student_name_en"`
	StudentNameMM      string                  `json:"student_name_mm"`
	DateOfBirth        string                  `json:"date_of_birth"`
	SchoolID           uuid.UUID               `json:"school_id"`
	SchoolNameEN       string                  `json:"school_name_en"`
	SchoolCode         string                  `json:"school_code"`
	GraduationDate     *string                 `json:"graduation_date,omitempty"`
	GraduationStatus   string                  `json:"graduation_status"` // "Graduated", "Active", "Honors"
	CumulativeGPA      float64                 `json:"cumulative_gpa"`
	TotalCreditsEarned float64                 `json:"total_credits_earned"`
	Terms              []TermRecord            `json:"terms"`
	OverallStanding    StudentAcademicStanding `json:"overall_standing"`
	TotalDistinctions  int                     `json:"total_distinctions"`
	VerificationHash   string                  `json:"verification_hash"`
	IssuerDID          string                  `json:"issuer_did"`
	IssuedAt           time.Time               `json:"issued_at"`
}
