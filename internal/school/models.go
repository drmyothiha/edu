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
	NameEn          *string   `json:"name_en,omitempty"`
	NameMy          *string   `json:"name_my,omitempty"`
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
	NameEn          *string `json:"name_en,omitempty"`
	NameMy          *string `json:"name_my,omitempty"`
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
	NameEn          *string `json:"name_en,omitempty"`
	NameMy          *string `json:"name_my,omitempty"`
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

// FacultyMemberDTO represents a teacher or school admin faculty member
type FacultyMemberDTO struct {
	ID              uuid.UUID  `json:"id"`
	Email           string     `json:"email"`
	FullName        string     `json:"full_name"`
	Role            string     `json:"role"`
	SchoolID        *uuid.UUID `json:"school_id,omitempty"`
	SchoolName      string     `json:"school_name,omitempty"`
	AssignedClasses []string   `json:"assigned_classes,omitempty"`
}

// CreateTeacherRequest contains parameters for creating a new teacher under a school
type CreateTeacherRequest struct {
	FullName string     `json:"full_name"`
	Email    string     `json:"email"`
	Password string     `json:"password,omitempty"`
	Role     string     `json:"role,omitempty"` // defaults to "teacher"
	SchoolID *uuid.UUID `json:"school_id,omitempty"`
}

// UpdateTeacherRequest contains parameters for updating or transferring a teacher
type UpdateTeacherRequest struct {
	FullName *string    `json:"full_name,omitempty"`
	Email    *string    `json:"email,omitempty"`
	SchoolID *uuid.UUID `json:"school_id,omitempty"` // For transferring to another school
}

// SchoolStudentDTO represents a student belonging to a school with enrolled class & grade level
type SchoolStudentDTO struct {
	ID         uuid.UUID  `json:"id"`
	Email      string     `json:"email"`
	FullName   string     `json:"full_name"`
	Role       string     `json:"role"`
	SchoolID   uuid.UUID  `json:"school_id"`
	SchoolName string     `json:"school_name,omitempty"`
	ClassID    *uuid.UUID `json:"class_id,omitempty"`
	ClassName  *string    `json:"class_name,omitempty"`
	GradeLevel *string    `json:"grade_level,omitempty"`
	CreatedAt  time.Time  `json:"created_at"`
}

// StudentDetailDTO represents complete detail of a student for drill-down views
type StudentDetailDTO struct {
	ID           uuid.UUID                    `json:"id"`
	Email        string                       `json:"email"`
	FullName     string                       `json:"full_name"`
	Role         string                       `json:"role"`
	SchoolID     *uuid.UUID                   `json:"school_id,omitempty"`
	SchoolName   string                       `json:"school_name,omitempty"`
	SchoolCode   string                       `json:"school_code,omitempty"`
	ClassID      *uuid.UUID                   `json:"class_id,omitempty"`
	ClassName    string                       `json:"class_name,omitempty"`
	GradeLevel   string                       `json:"grade_level,omitempty"`
	AcademicYear string                       `json:"academic_year,omitempty"`
	ParentID     *uuid.UUID                   `json:"parent_id,omitempty"`
	ParentName   string                       `json:"parent_name,omitempty"`
	ParentEmail  string                       `json:"parent_email,omitempty"`
	CreatedAt    time.Time                    `json:"created_at"`
	Overview     *StudentOverviewResponse     `json:"overview,omitempty"`
	BlockchainID *StudentBlockchainIDResponse `json:"blockchain_id,omitempty"`
	WholeChild   *WholeChildProfileDTO        `json:"whole_child,omitempty"`
}

// CreateSchoolStudentRequest contains parameters for registering/enrolling a student
type CreateSchoolStudentRequest struct {
	FullName string     `json:"full_name"`
	Email    string     `json:"email,omitempty"`
	ClassID  *uuid.UUID `json:"class_id,omitempty"`
}

// SeedDefaultClassesRequest contains parameters for default class seeding
type SeedDefaultClassesRequest struct {
	SchoolID     *uuid.UUID `json:"school_id,omitempty"`
	AcademicYear string     `json:"academic_year,omitempty"`
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

// StudentBlockchainIDResponse represents the immutable decentralized credential for a student
type StudentBlockchainIDResponse struct {
	StudentID        uuid.UUID   `json:"student_id"`
	StudentName      string      `json:"student_name"`
	StudentEmail     string      `json:"student_email"`
	DID              string      `json:"did"`
	BlockchainAddr   string      `json:"blockchain_address"`
	PublicKey        string      `json:"public_key"`
	CredentialHash   string      `json:"credential_hash"`
	MerkleRoot       *string     `json:"merkle_root,omitempty"`
	MerkleProof      interface{} `json:"merkle_proof,omitempty"`
	PolygonTxHash    *string     `json:"polygon_tx_hash,omitempty"`
	AnchorStatus     string      `json:"anchor_status"` // unanchored, pending, anchored, revoked
	IssuerSchool     string      `json:"issuer_school"`
	IssuerSchoolEn   *string     `json:"issuer_school_en,omitempty"`
	IssuerSchoolMy   *string     `json:"issuer_school_my,omitempty"`
	SchoolCode       string      `json:"school_code"`
	Region           string      `json:"region"`
	Township         string      `json:"township"`
	RawCredential    interface{} `json:"raw_credential_json"`
	DigitalSignature string      `json:"digital_signature"`
	IssuedAt         time.Time   `json:"issued_at"`
	IsRevoked        bool        `json:"is_revoked"`
}

// VerificationResult represents public, independent verification of a credential
type VerificationResult struct {
	IsValid          bool      `json:"is_valid"`
	IsRevoked        bool      `json:"is_revoked"`
	SignatureValid   bool      `json:"signature_valid"`
	MerkleProofValid bool      `json:"merkle_proof_valid"`
	DID              string    `json:"did"`
	StudentName      string    `json:"student_name"`
	SchoolName       string    `json:"school_name"`
	SchoolCode       string    `json:"school_code"`
	CredentialHash   string    `json:"credential_hash"`
	MerkleRoot       string    `json:"merkle_root,omitempty"`
	PolygonTxHash    string    `json:"polygon_tx_hash,omitempty"`
	Network          string    `json:"network"`
	VerificationTime time.Time `json:"verification_time"`
	Message          string    `json:"message"`
}

// BatchAnchorResponse represents the result of batching unanchored credentials to Layer-2
type BatchAnchorResponse struct {
	MerkleRoot      string    `json:"merkle_root"`
	BatchSize       int       `json:"batch_size"`
	Network         string    `json:"network"`
	ContractAddress string    `json:"contract_address"`
	TxHash          string    `json:"tx_hash"`
	Status          string    `json:"status"`
	AnchoredAt      time.Time `json:"anchored_at"`
}

// PaginationMeta contains metadata for paginated results
type PaginationMeta struct {
	Total      int64 `json:"total"`
	Page       int   `json:"page"`
	Limit      int   `json:"limit"`
	TotalPages int   `json:"total_pages"`
}

// PaginatedSchoolsResponse represents server-side paginated schools list
type PaginatedSchoolsResponse struct {
	Data       []SchoolDTO    `json:"data"`
	Pagination PaginationMeta `json:"pagination"`
}

// ListSchoolsParams contains filtering and pagination query options
type ListSchoolsParams struct {
	Page     int
	Limit    int
	Search   string
	Region   string
	PCodeSR  string
	PCodeTS  string
	Category string
}

// ChildDTO represents a student associated with a parent
type ChildDTO struct {
	ID             uuid.UUID  `json:"id"`
	FullName       string     `json:"full_name"`
	Email          string     `json:"email"`
	Role           string     `json:"role"`
	SchoolID       uuid.UUID  `json:"school_id"`
	SchoolName     string     `json:"school_name"`
	SchoolNameEn   *string    `json:"school_name_en,omitempty"`
	SchoolNameMy   *string    `json:"school_name_my,omitempty"`
	SchoolCode     string     `json:"school_code"`
	SchoolRegion   string     `json:"school_region"`
	SchoolTownship string     `json:"school_township"`
	ClassID        *uuid.UUID `json:"class_id,omitempty"`
	ClassName      string     `json:"class_name"`
	GradeLevel     string     `json:"grade_level"`
	DID            string     `json:"did"`
	BlockchainAddr string     `json:"blockchain_address"`
	CredentialHash string     `json:"credential_hash"`
	MerkleRoot     *string    `json:"merkle_root,omitempty"`
	AnchorStatus   string     `json:"anchor_status"`
}

// WholeChildSyncPayload represents the complete offline sync bundle
type WholeChildSyncPayload struct {
	SyncMetadata SyncMetadataDTO            `json:"sync_metadata"`
	Students     []WholeChildStudentEntryDTO `json:"students"`
}

type SyncMetadataDTO struct {
	ProtocolVersion          string                 `json:"protocol_version"`
	SchoolCode               string                 `json:"school_code"`
	SchoolName               string                 `json:"school_name"`
	Township                 string                 `json:"township"`
	ClassID                  string                 `json:"class_id"`
	ClassName                string                 `json:"class_name"`
	AcademicYear             string                 `json:"academic_year"`
	ReportingPeriod          string                 `json:"reporting_period"`
	ReportingTeacher         ReportingTeacherDTO    `json:"reporting_teacher"`
	GeneratedAt              string                 `json:"generated_at"`
	TotalOfficialSchoolDays  int                    `json:"total_official_school_days"`
	TotalEnrolledStudents    int                    `json:"total_enrolled_students"`
	Checksum                 string                 `json:"checksum"`
}

type ReportingTeacherDTO struct {
	TeacherID string `json:"teacher_id"`
	Name      string `json:"name"`
	Role      string `json:"role"`
}

type WholeChildStudentEntryDTO struct {
	StudentID                 string                 `json:"student_id"`
	RollNo                    string                 `json:"roll_no"`
	NationalStudentID         string                 `json:"national_student_id,omitempty"`
	FullName                  string                 `json:"full_name"`
	DateOfBirth               string                 `json:"date_of_birth,omitempty"`
	Gender                    string                 `json:"gender,omitempty"`
	SyncRecordHash            string                 `json:"sync_record_hash,omitempty"`
	AcademicProfile           map[string]interface{} `json:"academic_profile"`
	PhysicalGrowthProfile     map[string]interface{} `json:"physical_growth_profile"`
	HealthVisibilityProfile   map[string]interface{} `json:"health_visibility_profile"`
	WellbeingProfile          map[string]interface{} `json:"wellbeing_profile"`
	SocialCitizenshipProfile  map[string]interface{} `json:"social_citizenship_profile"`
}

// WholeChildProfileDTO represents a student's full 5-pillar profile returned by API
type WholeChildProfileDTO struct {
	ID                       uuid.UUID              `json:"id"`
	StudentID                uuid.UUID              `json:"student_id"`
	StudentName              string                 `json:"student_name"`
	StudentEmail             string                 `json:"student_email"`
	StudentDID               *string                `json:"student_did,omitempty"`
	SchoolID                 uuid.UUID              `json:"school_id"`
	ClassID                  uuid.UUID              `json:"class_id"`
	AcademicYear             string                 `json:"academic_year"`
	Period                   string                 `json:"period"`
	AttendanceRatePct        float64                `json:"attendance_rate_pct"`
	AcademicProfile          map[string]interface{} `json:"academic_profile"`
	PhysicalGrowthProfile    map[string]interface{} `json:"physical_growth_profile"`
	HealthVisibilityProfile  map[string]interface{} `json:"health_visibility_profile"`
	WellbeingProfile         map[string]interface{} `json:"wellbeing_profile"`
	SocialCitizenshipProfile map[string]interface{} `json:"social_citizenship_profile"`
	SyncSource               string                 `json:"sync_source"`
	SyncRecordHash           *string                `json:"sync_record_hash,omitempty"`
	CreatedAt                time.Time              `json:"created_at"`
	UpdatedAt                time.Time              `json:"updated_at"`
}

// WholeChildSyncResponse is the receipt returned after batch ingestion
type WholeChildSyncResponse struct {
	BatchID           uuid.UUID `json:"batch_id"`
	Checksum          string    `json:"checksum"`
	Status            string    `json:"status"`
	ProcessedStudents int       `json:"processed_students"`
	SyncedAt          time.Time `json:"synced_at"`
	Message           string    `json:"message"`
}

// BatchSaveClassWholeChildRequest represents request to save whole child profiles for a class
type BatchSaveClassWholeChildRequest struct {
	Period       string                       `json:"period"`
	AcademicYear string                       `json:"academic_year"`
	Profiles     []StudentWholeChildUpdateDTO `json:"profiles"`
}

// StudentWholeChildUpdateDTO represents a student's domain updates from spreadsheet
type StudentWholeChildUpdateDTO struct {
	StudentID                uuid.UUID              `json:"student_id"`
	PhysicalGrowthProfile    map[string]interface{} `json:"physical_growth_profile,omitempty"`
	HealthVisibilityProfile  map[string]interface{} `json:"health_visibility_profile,omitempty"`
	WellbeingProfile         map[string]interface{} `json:"wellbeing_profile,omitempty"`
	SocialCitizenshipProfile map[string]interface{} `json:"social_citizenship_profile,omitempty"`
	AcademicProfile          map[string]interface{} `json:"academic_profile,omitempty"`
	AttendanceRatePct        *float64               `json:"attendance_rate_pct,omitempty"`
}

// BatchSaveClassWholeChildResponse represents response after class whole child profiles are saved
type BatchSaveClassWholeChildResponse struct {
	UpdatedCount int    `json:"updated_count"`
	Period       string `json:"period"`
	Message      string `json:"message"`
}

// ConversationDTO represents a conversation between teacher and parent regarding a student
type ConversationDTO struct {
	ID                   uuid.UUID  `json:"id"`
	SchoolID             *uuid.UUID `json:"school_id,omitempty"`
	TeacherID            uuid.UUID  `json:"teacher_id"`
	ParentID             uuid.UUID  `json:"parent_id"`
	StudentID            *uuid.UUID `json:"student_id,omitempty"`
	TeacherName          string     `json:"teacher_name"`
	TeacherEmail         string     `json:"teacher_email"`
	ParentName           string     `json:"parent_name"`
	ParentEmail          string     `json:"parent_email"`
	StudentName          string     `json:"student_name"`
	LatestMessageContent string     `json:"latest_message_content"`
	LatestMessageAt      time.Time  `json:"latest_message_at"`
	UnreadCount          int64      `json:"unread_count"`
	CreatedAt            time.Time  `json:"created_at"`
}

// CreateConversationRequest initiates or finds a conversation
type CreateConversationRequest struct {
	TeacherID *uuid.UUID `json:"teacher_id,omitempty"`
	ParentID  *uuid.UUID `json:"parent_id,omitempty"`
	StudentID *uuid.UUID `json:"student_id,omitempty"`
}

// MessageDTO represents an individual message
type MessageDTO struct {
	ID             uuid.UUID `json:"id"`
	ConversationID uuid.UUID `json:"conversation_id"`
	SenderID       uuid.UUID `json:"sender_id"`
	SenderName     string    `json:"sender_name"`
	SenderRole     string    `json:"sender_role"`
	Content        string    `json:"content"`
	IsRead         bool      `json:"is_read"`
	CreatedAt      time.Time `json:"created_at"`
}

// SendMessageRequest contains body for sending a message
type SendMessageRequest struct {
	Content string `json:"content"`
}

// AnnouncementDTO represents a classroom announcement broadcast
type AnnouncementDTO struct {
	ID          uuid.UUID `json:"id"`
	ClassID     uuid.UUID `json:"class_id"`
	TeacherID   uuid.UUID `json:"teacher_id"`
	TeacherName string    `json:"teacher_name"`
	ClassName   string    `json:"class_name"`
	StudentName *string   `json:"student_name,omitempty"`
	Title       string    `json:"title"`
	Content     string    `json:"content"`
	Priority    string    `json:"priority"`
	CreatedAt   time.Time `json:"created_at"`
}

// CreateAnnouncementRequest contains payload for publishing announcement
type CreateAnnouncementRequest struct {
	Title    string `json:"title"`
	Content  string `json:"content"`
	Priority string `json:"priority"`
}

// NotificationDTO represents a user notification
type NotificationDTO struct {
	ID        uuid.UUID      `json:"id"`
	UserID    uuid.UUID      `json:"user_id"`
	Type      string         `json:"type"`
	Title     string         `json:"title"`
	Body      string         `json:"body"`
	Data      map[string]any `json:"data"`
	IsRead    bool           `json:"is_read"`
	CreatedAt time.Time      `json:"created_at"`
}

// NotificationListResponse represents paginated notifications with unread count
type NotificationListResponse struct {
	Notifications []NotificationDTO `json:"notifications"`
	UnreadCount   int64             `json:"unread_count"`
}

// ExamMarkItem represents a student's marks for all subjects in an exam
type ExamMarkItem struct {
	StudentID   uuid.UUID `json:"student_id"`
	StudentName string    `json:"student_name,omitempty"`
	Myanmar     *float64  `json:"myanmar"`
	English     *float64  `json:"english"`
	Maths       *float64  `json:"maths"`
	Phy         *float64  `json:"phy"`
	Chem        *float64  `json:"chem"`
	Bio         *float64  `json:"bio"`
	Geo         *float64  `json:"geo"`
	His         *float64  `json:"his"`
	Eco         *float64  `json:"eco"`
	Social      *float64  `json:"social"`
	Remarks     string    `json:"remarks,omitempty"`
}

// BatchExamMarksRequest payload for POST /api/v1/classes/{id}/exam-marks
type BatchExamMarksRequest struct {
	ExamName     string         `json:"exam_name"`
	AcademicYear string         `json:"academic_year"`
	Records      []ExamMarkItem `json:"records"`
}

// BatchExamMarksResponse response for batch exam marks recording
type BatchExamMarksResponse struct {
	ClassID       uuid.UUID      `json:"class_id"`
	ExamName      string         `json:"exam_name"`
	RecordedCount int            `json:"recorded_count"`
	Records       []ExamMarkItem `json:"records"`
}

// ExamRosterItem represents a student with their exam marks in a class
type ExamRosterItem struct {
	StudentID    uuid.UUID  `json:"student_id"`
	StudentName  string     `json:"student_name"`
	StudentEmail string     `json:"student_email"`
	ExamMarkID   *uuid.UUID `json:"exam_mark_id,omitempty"`
	ExamName     string     `json:"exam_name"`
	AcademicYear string     `json:"academic_year"`
	Myanmar      *float64   `json:"myanmar"`
	English      *float64   `json:"english"`
	Maths        *float64   `json:"maths"`
	Phy          *float64   `json:"phy"`
	Chem         *float64   `json:"chem"`
	Bio          *float64   `json:"bio"`
	Geo          *float64   `json:"geo"`
	His          *float64   `json:"his"`
	Eco          *float64   `json:"eco"`
	Social       *float64   `json:"social"`
	Remarks      string     `json:"remarks"`
	UpdatedAt    *time.Time `json:"updated_at,omitempty"`
}

// ExamSummaryInfo provides high-level info on an exam in a class
type ExamSummaryInfo struct {
	ExamName     string     `json:"exam_name"`
	AcademicYear string     `json:"academic_year"`
	StudentCount int64      `json:"student_count"`
	LastUpdated  *time.Time `json:"last_updated,omitempty"`
}

// ExamRosterResponse response for GET /api/v1/classes/{id}/exam-marks?exam_name=...
type ExamRosterResponse struct {
	ClassID        uuid.UUID         `json:"class_id"`
	ClassName      string            `json:"class_name"`
	GradeLevel     string            `json:"grade_level"`
	AcademicYear   string            `json:"academic_year"`
	ExamName       string            `json:"exam_name"`
	AvailableExams []ExamSummaryInfo `json:"available_exams"`
	TotalStudents  int               `json:"total_students"`
	Roster         []ExamRosterItem  `json:"roster"`
}

// ShiftConfigDTO represents a school teaching shift configuration
type ShiftConfigDTO struct {
	ID           uuid.UUID `json:"id"`
	SchoolID     uuid.UUID `json:"school_id"`
	ShiftType    string    `json:"shift_type"` // "full_day", "morning", "afternoon"
	Name         string    `json:"name"`
	NameMy       string    `json:"name_my"`
	StartTime    string    `json:"start_time"` // "08:00"
	EndTime      string    `json:"end_time"`   // "16:00"
	TotalPeriods int       `json:"total_periods"`
	Description  string    `json:"description"`
	Active       bool      `json:"active"`
}

// TimetablePeriodDTO represents a single class period slot
type TimetablePeriodDTO struct {
	ID            string  `json:"id"`
	ClassID       string  `json:"class_id"`
	GradeLevel    string  `json:"grade_level"`
	Section       string  `json:"section"`
	DayOfWeek     int     `json:"day_of_week"` // 1 = Mon ... 7 = Sun
	StartTime     string  `json:"start_time"`  // "08:00"
	EndTime       string  `json:"end_time"`    // "09:00"
	PeriodIndex   int     `json:"period_index"`
	SubjectName   string  `json:"subject_name"`
	SubjectNameMy string  `json:"subject_name_my"`
	SubjectCode   string  `json:"subject_code"`
	TeacherID     *string `json:"teacher_id,omitempty"`
	TeacherName   string  `json:"teacher_name"`
	RoomNumber    string  `json:"room_number"`
	ColorHex      string  `json:"color_hex"`
	Topic         string  `json:"topic,omitempty"`
	ShiftType     string  `json:"shift_type"`
}

// ClassTimetableDTO represents a full timetable for a class section
type ClassTimetableDTO struct {
	ClassID      uuid.UUID            `json:"class_id"`
	ClassName    string               `json:"class_name"`
	GradeLevel   string               `json:"grade_level"`
	ShiftType    string               `json:"shift_type"`
	AcademicYear string               `json:"academic_year"`
	Periods      []TimetablePeriodDTO `json:"periods"`
	UpdatedAt    time.Time            `json:"updated_at"`
}

// UpdateClassTimetableRequest contains updated timetable periods and shift
type UpdateClassTimetableRequest struct {
	ClassID   uuid.UUID            `json:"class_id"`
	ShiftType string               `json:"shift_type"`
	Periods   []TimetablePeriodDTO `json:"periods"`
}

// GateStudentDTO represents student roster info cached on offline entrance gate kiosks
type GateStudentDTO struct {
	ID           uuid.UUID  `json:"id"`
	DID          string     `json:"did"`
	FullName     string     `json:"full_name"`
	FullNameMy   string     `json:"full_name_my,omitempty"`
	RollNo       string     `json:"roll_no"`
	ClassID      *uuid.UUID `json:"class_id,omitempty"`
	ClassName    string     `json:"class_name"`
	GradeLevel   string     `json:"grade_level"`
	SchoolName   string     `json:"school_name"`
	SchoolNameMy string     `json:"school_name_my"`
	SchoolCode   string     `json:"school_code"`
	PhotoURL     *string    `json:"photo_url,omitempty"`
	NationalID   *string    `json:"national_id,omitempty"`
	UpdatedAt    time.Time  `json:"updated_at"`
}

// GateRosterResponse represents full school roster for offline gate caching
type GateRosterResponse struct {
	SchoolID    uuid.UUID        `json:"school_id"`
	SchoolCode  string           `json:"school_code"`
	SchoolName  string           `json:"school_name"`
	TotalCount  int              `json:"total_count"`
	Students    []GateStudentDTO `json:"students"`
	GeneratedAt time.Time        `json:"generated_at"`
}

// SyncAttendanceEvent represents a single attendance scan event queued offline
type SyncAttendanceEvent struct {
	EventID     string     `json:"event_id"`
	StudentID   *uuid.UUID `json:"student_id,omitempty"`
	DID         string     `json:"did"`
	StudentName string     `json:"student_name,omitempty"`
	RollNo      string     `json:"roll_no,omitempty"`
	ClassID     *uuid.UUID `json:"class_id,omitempty"`
	ClassName   string     `json:"class_name,omitempty"`
	SchoolCode  string     `json:"school_code,omitempty"`
	ScannedAt   string     `json:"scanned_at"` // ISO8601 or RFC3339
	EventDate   string     `json:"event_date"` // YYYY-MM-DD
	TimeDisplay string     `json:"time_display,omitempty"`
	ScanMethod  string     `json:"scan_method"` // nfc_tap, qr_scan, manual
	Status      string     `json:"status"`      // present, late
	DeviceID    string     `json:"device_id"`
}

// SyncAttendanceBatchRequest payload sent by Gate Kiosk PWA to flush attendance events
type SyncAttendanceBatchRequest struct {
	SchoolCode string                `json:"school_code,omitempty"`
	DeviceID   string                `json:"device_id,omitempty"`
	Events     []SyncAttendanceEvent `json:"events"`
}

// SyncAttendanceBatchResponse summary of batch sync ingestion
type SyncAttendanceBatchResponse struct {
	SyncedCount int      `json:"synced_count"`
	FailedCount int      `json:"failed_count"`
	SyncedIDs   []string `json:"synced_ids"`
	Errors      []string `json:"errors,omitempty"`
}

