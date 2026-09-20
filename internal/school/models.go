package school

import (
	"time"

	"github.com/google/uuid"
)

// PCodeDTO represents a MIMU administrative division (State/Region, Township, Ward/Village Tract)
type PCodeDTO struct {
	PCode       string  `json:"pcode"`
	ParentPCode *string `json:"parent_pcode,omitempty"`
	AdminLevel  int     `json:"admin_level"`
	NameEn      string  `json:"name_en"`
	NameMy      string  `json:"name_my"`
	SRPCode     *string `json:"sr_pcode,omitempty"`
	TSPCode     *string `json:"ts_pcode,omitempty"`
	PCodeType   string  `json:"pcode_type"`
}

// SchoolDTO represents a tenant educational facility with MIMU P-Code metadata
type SchoolDTO struct {
	ID              uuid.UUID `json:"id"`
	Name            string    `json:"name"`
	Code            string    `json:"code"`
	Address         string    `json:"address"`
	City            string    `json:"city"`
	Region          string    `json:"region"`
	Phone           string    `json:"phone"`
	Status          string    `json:"status"`
	PCodeSR         *string   `json:"pcode_sr,omitempty"`
	PCodeTS         *string   `json:"pcode_ts,omitempty"`
	PCodeWardVT     *string   `json:"pcode_ward_vt,omitempty"`
	PCodeLevel      *string   `json:"pcode_level,omitempty"`
	TownshipName    *string   `json:"township_name,omitempty"`
	WardVillageName *string   `json:"ward_village_name,omitempty"`
	SchoolCategory  *string   `json:"school_category,omitempty"`
	CreatedAt       time.Time `json:"created_at"`
}

// CreateSchoolRequest contains fields for creating a new school tenant
type CreateSchoolRequest struct {
	Name            string  `json:"name"`
	Code            string  `json:"code"`
	Address         string  `json:"address"`
	City            string  `json:"city"`
	Region          string  `json:"region"`
	Phone           string  `json:"phone"`
	Status          string  `json:"status"`
	PCodeSR         *string `json:"pcode_sr,omitempty"`
	PCodeTS         *string `json:"pcode_ts,omitempty"`
	PCodeWardVT     *string `json:"pcode_ward_vt,omitempty"`
	PCodeLevel      *string `json:"pcode_level,omitempty"`
	TownshipName    *string `json:"township_name,omitempty"`
	WardVillageName *string `json:"ward_village_name,omitempty"`
	SchoolCategory  *string `json:"school_category,omitempty"`
}

// UpdateSchoolRequest contains fields for updating a school
type UpdateSchoolRequest struct {
	Name            *string `json:"name,omitempty"`
	Address         *string `json:"address,omitempty"`
	City            *string `json:"city,omitempty"`
	Region          *string `json:"region,omitempty"`
	Phone           *string `json:"phone,omitempty"`
	Status          *string `json:"status,omitempty"`
	PCodeSR         *string `json:"pcode_sr,omitempty"`
	PCodeTS         *string `json:"pcode_ts,omitempty"`
	PCodeWardVT     *string `json:"pcode_ward_vt,omitempty"`
	PCodeLevel      *string `json:"pcode_level,omitempty"`
	TownshipName    *string `json:"township_name,omitempty"`
	WardVillageName *string `json:"ward_village_name,omitempty"`
	SchoolCategory  *string `json:"school_category,omitempty"`
}

// ClassDTO represents a class entity returned to clients
type ClassDTO struct {
	ID           uuid.UUID `json:"id"`
	Name         string    `json:"name"`
	GradeLevel   string    `json:"grade_level"`
	TeacherID    uuid.UUID `json:"teacher_id"`
	AcademicYear string    `json:"academic_year"`
	SchoolID     uuid.UUID `json:"school_id"`
	CreatedAt    time.Time `json:"created_at"`
}

// CreateClassRequest contains parameters to create a new class
type CreateClassRequest struct {
	Name         string     `json:"name"`
	GradeLevel   string     `json:"grade_level"`
	AcademicYear string     `json:"academic_year"`
	TeacherID    *uuid.UUID `json:"teacher_id,omitempty"`
	SchoolID     *uuid.UUID `json:"school_id,omitempty"`
}

// UpdateClassRequest contains parameters to update a class
type UpdateClassRequest struct {
	Name         string `json:"name"`
	GradeLevel   string `json:"grade_level"`
	AcademicYear string `json:"academic_year"`
}

// EnrollStudentRequest contains the student ID to enroll into a class
type EnrollStudentRequest struct {
	StudentID uuid.UUID `json:"student_id"`
}

// StudentDTO represents student info within a class
type StudentDTO struct {
	ID         uuid.UUID `json:"id"`
	Email      string    `json:"email"`
	FullName   string    `json:"full_name"`
	Role       string    `json:"role"`
	EnrolledAt time.Time `json:"enrolled_at"`
}

// AttendanceItem represents one student's attendance record in a batch
type AttendanceItem struct {
	StudentID uuid.UUID `json:"student_id"`
	Status    string    `json:"status"` // present, absent, late, excused
	Notes     string    `json:"notes,omitempty"`
}

// BatchAttendanceRequest payload for POST /api/v1/classes/{id}/attendance
type BatchAttendanceRequest struct {
	Date    string           `json:"date"` // YYYY-MM-DD
	Records []AttendanceItem `json:"records"`
}

// BatchAttendanceResponse response for batch attendance recording
type BatchAttendanceResponse struct {
	ClassID       uuid.UUID        `json:"class_id"`
	Date          string           `json:"date"`
	RecordedCount int              `json:"recorded_count"`
	Records       []AttendanceItem `json:"records"`
}

// AttendanceRosterItem represents a student with their attendance status on a specific date
type AttendanceRosterItem struct {
	StudentID    uuid.UUID  `json:"student_id"`
	StudentName  string     `json:"student_name"`
	StudentEmail string     `json:"student_email"`
	AttendanceID *uuid.UUID `json:"attendance_id,omitempty"`
	Status       string     `json:"status"` // present, absent, late, excused, or unrecorded
	Notes        string     `json:"notes"`
	Date         string     `json:"date"`
}

// AttendanceRosterResponse response for GET /api/v1/classes/{id}/attendance?date=YYYY-MM-DD
type AttendanceRosterResponse struct {
	ClassID uuid.UUID              `json:"class_id"`
	Date    string                 `json:"date"`
	Total   int                    `json:"total_students"`
	Roster  []AttendanceRosterItem `json:"roster"`
}

// CreateAssignmentRequest payload for POST /api/v1/classes/{id}/assignments
type CreateAssignmentRequest struct {
	Title       string    `json:"title"`
	Description string    `json:"description"`
	DueDate     time.Time `json:"due_date"`
	MaxScore    int32     `json:"max_score"`
}

// AssignmentDTO represents an assignment entity returned to clients
type AssignmentDTO struct {
	ID          uuid.UUID `json:"id"`
	ClassID     uuid.UUID `json:"class_id"`
	Title       string    `json:"title"`
	Description string    `json:"description"`
	DueDate     time.Time `json:"due_date"`
	MaxScore    int32     `json:"max_score"`
	CreatedAt   time.Time `json:"created_at"`
}

// AttendanceSummary contains attendance count stats and percentage
type AttendanceSummary struct {
	Total          int64   `json:"total_days"`
	Present        int64   `json:"present"`
	Absent         int64   `json:"absent"`
	Late           int64   `json:"late"`
	Excused        int64   `json:"excused"`
	AttendanceRate float64 `json:"attendance_rate_percentage"`
}

// PendingAssignmentDTO represents an unsubmitted assignment for a student
type PendingAssignmentDTO struct {
	ID          uuid.UUID `json:"id"`
	ClassID     uuid.UUID `json:"class_id"`
	ClassName   string    `json:"class_name"`
	Title       string    `json:"title"`
	Description string    `json:"description"`
	DueDate     time.Time `json:"due_date"`
	MaxScore    int32     `json:"max_score"`
	CreatedAt   time.Time `json:"created_at"`
}

// StudentOverviewResponse response for GET /api/v1/students/{id}/overview
type StudentOverviewResponse struct {
	StudentID          uuid.UUID              `json:"student_id"`
	AttendanceSummary  AttendanceSummary      `json:"attendance_summary"`
	PendingAssignments []PendingAssignmentDTO `json:"pending_assignments"`
}

// SubmitAssignmentRequest payload for student submission
type SubmitAssignmentRequest struct {
	Notes string `json:"notes,omitempty"`
}

// GradeSubmissionRequest payload for teacher grading
type GradeSubmissionRequest struct {
	Grade    float64 `json:"grade"`
	Feedback string  `json:"feedback"`
}
