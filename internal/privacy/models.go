package privacy

import (
	"time"

	"github.com/google/uuid"
)

type RequestType string

const (
	RequestTypeFullErasure         RequestType = "FullErasure"
	RequestTypeDeIdentifyAnalytics RequestType = "DeIdentifyAnalytics"
	RequestTypeArchiveOnly         RequestType = "ArchiveOnly"
)

type ErasureStatus string

const (
	StatusPending  ErasureStatus = "pending"
	StatusApproved ErasureStatus = "approved"
	StatusExecuted ErasureStatus = "executed"
	StatusRejected ErasureStatus = "rejected"
)

// ErasureRequest represents a formal "Right to be Forgotten" or statutory data purging request
type ErasureRequest struct {
	ID                  uuid.UUID     `json:"id"`
	StudentID           uuid.UUID     `json:"student_id"`
	OriginalDID         string        `json:"original_did"`
	SchoolID            *uuid.UUID    `json:"school_id,omitempty"`
	RequestedBy         *uuid.UUID    `json:"requested_by,omitempty"`
	RequestType         RequestType   `json:"request_type"`
	Status              ErasureStatus `json:"status"`
	LegalBasis          string        `json:"legal_basis"` // e.g. "ParentalConsentRevocation", "AgeOutPolicy"
	Reason              string        `json:"reason"`
	Pseudonym           string        `json:"pseudonym,omitempty"` // e.g. "ANON-8a3f91bc"
	FieldsScrubbed      []string      `json:"fields_scrubbed"`
	RequestedAt         time.Time     `json:"requested_at"`
	ExecutedAt          *time.Time    `json:"executed_at,omitempty"`
	ExecutedBy          *uuid.UUID    `json:"executed_by,omitempty"`
	RejectionReason     string        `json:"rejection_reason,omitempty"`
}

// RetentionPolicy defines automated data minimization rules
type RetentionPolicy struct {
	ID                    string `json:"id"`
	TargetCohort          string `json:"target_cohort"`           // "graduated", "transferred", "withdrawn"
	RetentionPeriodMonths int    `json:"retention_period_months"` // e.g. 60 (5 years)
	Action                RequestType `json:"action"`             // DeIdentifyAnalytics or FullErasure
	PreserveStatistics    bool   `json:"preserve_statistics"`     // preserve anonymous exam averages
}

// StudentPIIRecord holds identifying information subject to erasure
type StudentPIIRecord struct {
	StudentID       uuid.UUID `json:"student_id"`
	FullNameEN      string    `json:"full_name_en"`
	FullNameMM      string    `json:"full_name_mm"`
	DateOfBirth     string    `json:"date_of_birth"`
	FatherName      string    `json:"father_name"`
	MotherName      string    `json:"mother_name"`
	PhoneNumber     string    `json:"phone_number"`
	Address         string    `json:"address"`
	AvatarURL       string    `json:"avatar_url"`
	BiometricData   string    `json:"biometric_data"`
	TownshipPCode   string    `json:"township_pcode"`
	StatePCode      string    `json:"state_pcode"`
	AcademicYear    string    `json:"academic_year"`
	GradeLevel      string    `json:"grade_level"`
	FinalExamScore  float64   `json:"final_exam_score"`
	AttendanceRate  float64   `json:"attendance_rate"`
}

// AnonymizedStudentSummary holds safe, non-identifiable data preserved for regional ministry analytics
type AnonymizedStudentSummary struct {
	Pseudonym      string    `json:"pseudonym"`
	StatePCode     string    `json:"state_pcode"`
	TownshipPCode  string    `json:"township_pcode"`
	AcademicYear   string    `json:"academic_year"`
	GradeLevel     string    `json:"grade_level"`
	FinalExamScore float64   `json:"final_exam_score"`
	AttendanceRate float64   `json:"attendance_rate"`
	AnonymizedAt   time.Time `json:"anonymized_at"`
}

// PrivacyAuditLog tracks all data minimization actions for GDPR-K / compliance auditors
type PrivacyAuditLog struct {
	ID              uuid.UUID `json:"id"`
	EventType       string    `json:"event_type"` // "PII_SCRUBBED", "RETENTION_SWEEP", "ANONYMIZED_SUMMARY_CREATED"
	ActorID         *uuid.UUID `json:"actor_id,omitempty"`
	TargetStudentID uuid.UUID `json:"target_student_id"`
	Pseudonym       string    `json:"pseudonym"`
	Details         map[string]interface{} `json:"details"`
	CreatedAt       time.Time `json:"created_at"`
}
