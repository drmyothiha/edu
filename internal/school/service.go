package school

import (
	"context"
	"errors"
	"fmt"
	"math"
	"strings"
	"time"

	"edu-platform/internal/database"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

var (
	ErrNotFound       = errors.New("resource not found")
	ErrUnauthorized   = errors.New("unauthorized action")
	ErrBadRequest     = errors.New("bad request")
	ErrConflict       = errors.New("resource conflict")
	ErrInternalServer = errors.New("internal server error")
)

// Service defines the business logic for classes, attendance, and assignments
type Service struct {
	queries database.Querier
}

// NewService creates a new school Service instance
func NewService(queries database.Querier) *Service {
	return &Service{queries: queries}
}

// CreateClass creates a new class assigned to a teacher
func (s *Service) CreateClass(ctx context.Context, teacherID uuid.UUID, req CreateClassRequest) (ClassDTO, error) {
	req.Name = strings.TrimSpace(req.Name)
	req.GradeLevel = strings.TrimSpace(req.GradeLevel)
	req.AcademicYear = strings.TrimSpace(req.AcademicYear)

	if req.Name == "" {
		return ClassDTO{}, fmt.Errorf("%w: class name is required", ErrBadRequest)
	}
	if req.GradeLevel == "" {
		return ClassDTO{}, fmt.Errorf("%w: grade_level is required", ErrBadRequest)
	}
	if req.AcademicYear == "" {
		return ClassDTO{}, fmt.Errorf("%w: academic_year is required", ErrBadRequest)
	}

	targetTeacherID := teacherID
	if req.TeacherID != nil && *req.TeacherID != uuid.Nil {
		targetTeacherID = *req.TeacherID
	}

	// Verify teacher exists and has teacher or admin role
	teacher, err := s.queries.GetUserByID(ctx, targetTeacherID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ClassDTO{}, fmt.Errorf("%w: teacher not found", ErrBadRequest)
		}
		return ClassDTO{}, fmt.Errorf("%w: failed to fetch teacher", ErrInternalServer)
	}
	if teacher.Role != "teacher" && teacher.Role != "admin" {
		return ClassDTO{}, fmt.Errorf("%w: assigned user must be a teacher or admin", ErrBadRequest)
	}

	class, err := s.queries.CreateClass(ctx, database.CreateClassParams{
		Name:         req.Name,
		GradeLevel:   req.GradeLevel,
		TeacherID:    targetTeacherID,
		AcademicYear: req.AcademicYear,
	})
	if err != nil {
		return ClassDTO{}, fmt.Errorf("%w: failed to create class", ErrInternalServer)
	}

	return ClassDTO{
		ID:           class.ID,
		Name:         class.Name,
		GradeLevel:   class.GradeLevel,
		TeacherID:    class.TeacherID,
		AcademicYear: class.AcademicYear,
		CreatedAt:    class.CreatedAt.Time,
	}, nil
}

// GetClass fetches a class by its ID
func (s *Service) GetClass(ctx context.Context, classID uuid.UUID) (ClassDTO, error) {
	class, err := s.queries.GetClassByID(ctx, classID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ClassDTO{}, fmt.Errorf("%w: class not found", ErrNotFound)
		}
		return ClassDTO{}, fmt.Errorf("%w: failed to fetch class", ErrInternalServer)
	}

	return ClassDTO{
		ID:           class.ID,
		Name:         class.Name,
		GradeLevel:   class.GradeLevel,
		TeacherID:    class.TeacherID,
		AcademicYear: class.AcademicYear,
		CreatedAt:    class.CreatedAt.Time,
	}, nil
}

// ListClasses returns all classes or classes taught by a specific teacher
func (s *Service) ListClasses(ctx context.Context, teacherID *uuid.UUID) ([]ClassDTO, error) {
	var classes []database.Class
	var err error

	if teacherID != nil {
		classes, err = s.queries.ListClassesByTeacher(ctx, *teacherID)
	} else {
		classes, err = s.queries.ListClasses(ctx)
	}

	if err != nil {
		return nil, fmt.Errorf("%w: failed to list classes", ErrInternalServer)
	}

	result := make([]ClassDTO, 0, len(classes))
	for _, c := range classes {
		result = append(result, ClassDTO{
			ID:           c.ID,
			Name:         c.Name,
			GradeLevel:   c.GradeLevel,
			TeacherID:    c.TeacherID,
			AcademicYear: c.AcademicYear,
			CreatedAt:    c.CreatedAt.Time,
		})
	}
	return result, nil
}

// EnrollStudent enrolls a student into a class
func (s *Service) EnrollStudent(ctx context.Context, classID, studentID uuid.UUID) error {
	// Verify class exists
	_, err := s.queries.GetClassByID(ctx, classID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return fmt.Errorf("%w: class not found", ErrNotFound)
		}
		return fmt.Errorf("%w: failed to verify class", ErrInternalServer)
	}

	// Verify student exists and has 'student' role
	student, err := s.queries.GetUserByID(ctx, studentID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return fmt.Errorf("%w: student not found", ErrNotFound)
		}
		return fmt.Errorf("%w: failed to verify student", ErrInternalServer)
	}
	if student.Role != "student" {
		return fmt.Errorf("%w: user is not a student (role: %s)", ErrBadRequest, student.Role)
	}

	_, err = s.queries.CreateEnrollment(ctx, database.CreateEnrollmentParams{
		ClassID:   classID,
		StudentID: studentID,
	})
	if err != nil {
		return fmt.Errorf("%w: failed to enroll student", ErrInternalServer)
	}

	return nil
}

// ListClassStudents returns the list of students enrolled in a class
func (s *Service) ListClassStudents(ctx context.Context, classID uuid.UUID) ([]StudentDTO, error) {
	// Verify class exists
	_, err := s.queries.GetClassByID(ctx, classID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("%w: class not found", ErrNotFound)
		}
		return nil, fmt.Errorf("%w: failed to verify class", ErrInternalServer)
	}

	students, err := s.queries.ListStudentsByClassID(ctx, classID)
	if err != nil {
		return nil, fmt.Errorf("%w: failed to fetch students", ErrInternalServer)
	}

	result := make([]StudentDTO, 0, len(students))
	for _, st := range students {
		result = append(result, StudentDTO{
			ID:         st.ID,
			Email:      st.Email,
			FullName:   st.FullName,
			Role:       st.Role,
			EnrolledAt: st.EnrolledAt.Time,
		})
	}
	return result, nil
}

// BatchRecordAttendance batch records or updates attendance for students in a class on a specific date
func (s *Service) BatchRecordAttendance(ctx context.Context, classID uuid.UUID, req BatchAttendanceRequest) (BatchAttendanceResponse, error) {
	// Verify class exists
	_, err := s.queries.GetClassByID(ctx, classID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return BatchAttendanceResponse{}, fmt.Errorf("%w: class not found", ErrNotFound)
		}
		return BatchAttendanceResponse{}, fmt.Errorf("%w: failed to verify class", ErrInternalServer)
	}

	parsedDate, err := time.Parse("2006-01-02", strings.TrimSpace(req.Date))
	if err != nil {
		return BatchAttendanceResponse{}, fmt.Errorf("%w: invalid date format, expected YYYY-MM-DD", ErrBadRequest)
	}

	validStatuses := map[string]bool{
		"present": true,
		"absent":  true,
		"late":    true,
		"excused": true,
	}

	if len(req.Records) == 0 {
		return BatchAttendanceResponse{}, fmt.Errorf("%w: attendance records list cannot be empty", ErrBadRequest)
	}

	recorded := make([]AttendanceItem, 0, len(req.Records))
	pgDate := pgtype.Date{
		Time:  parsedDate,
		Valid: true,
	}

	for _, item := range req.Records {
		status := strings.ToLower(strings.TrimSpace(item.Status))
		if !validStatuses[status] {
			return BatchAttendanceResponse{}, fmt.Errorf("%w: invalid attendance status %q for student %s (allowed: present, absent, late, excused)", ErrBadRequest, item.Status, item.StudentID)
		}

		// Verify enrollment
		enrolled, err := s.queries.IsStudentEnrolled(ctx, database.IsStudentEnrolledParams{
			ClassID:   classID,
			StudentID: item.StudentID,
		})
		if err != nil {
			return BatchAttendanceResponse{}, fmt.Errorf("%w: failed to check student enrollment: %v", ErrInternalServer, err)
		}
		if !enrolled {
			return BatchAttendanceResponse{}, fmt.Errorf("%w: student %s is not enrolled in class %s", ErrBadRequest, item.StudentID, classID)
		}

		_, err = s.queries.UpsertAttendance(ctx, database.UpsertAttendanceParams{
			ClassID:   classID,
			StudentID: item.StudentID,
			Date:      pgDate,
			Status:    status,
			Notes:     strings.TrimSpace(item.Notes),
		})
		if err != nil {
			return BatchAttendanceResponse{}, fmt.Errorf("%w: failed to upsert attendance record for student %s: %v", ErrInternalServer, item.StudentID, err)
		}

		recorded = append(recorded, AttendanceItem{
			StudentID: item.StudentID,
			Status:    status,
			Notes:     strings.TrimSpace(item.Notes),
		})
	}

	return BatchAttendanceResponse{
		ClassID:       classID,
		Date:          req.Date,
		RecordedCount: len(recorded),
		Records:       recorded,
	}, nil
}

// GetAttendanceRoster returns all enrolled students in a class and their attendance status on the given date
func (s *Service) GetAttendanceRoster(ctx context.Context, classID uuid.UUID, dateStr string) (AttendanceRosterResponse, error) {
	// Verify class exists
	_, err := s.queries.GetClassByID(ctx, classID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return AttendanceRosterResponse{}, fmt.Errorf("%w: class not found", ErrNotFound)
		}
		return AttendanceRosterResponse{}, fmt.Errorf("%w: failed to verify class", ErrInternalServer)
	}

	parsedDate, err := time.Parse("2006-01-02", strings.TrimSpace(dateStr))
	if err != nil {
		return AttendanceRosterResponse{}, fmt.Errorf("%w: invalid date format, expected YYYY-MM-DD", ErrBadRequest)
	}

	pgDate := pgtype.Date{
		Time:  parsedDate,
		Valid: true,
	}

	rows, err := s.queries.GetClassAttendanceRoster(ctx, database.GetClassAttendanceRosterParams{
		ClassID: classID,
		Date:    pgDate,
	})
	if err != nil {
		return AttendanceRosterResponse{}, fmt.Errorf("%w: failed to fetch attendance roster: %v", ErrInternalServer, err)
	}

	items := make([]AttendanceRosterItem, 0, len(rows))
	for _, r := range rows {
		var attID *uuid.UUID
		if r.AttendanceID.Valid {
			id := uuid.UUID(r.AttendanceID.Bytes)
			attID = &id
		}

		items = append(items, AttendanceRosterItem{
			StudentID:    r.StudentID,
			StudentName:  r.StudentName,
			StudentEmail: r.StudentEmail,
			AttendanceID: attID,
			Status:       r.Status,
			Notes:        r.Notes,
			Date:         dateStr,
		})
	}

	return AttendanceRosterResponse{
		ClassID: classID,
		Date:    dateStr,
		Total:   len(items),
		Roster:  items,
	}, nil
}

// CreateAssignment creates an assignment for a class
func (s *Service) CreateAssignment(ctx context.Context, classID uuid.UUID, req CreateAssignmentRequest) (AssignmentDTO, error) {
	// Verify class exists
	_, err := s.queries.GetClassByID(ctx, classID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return AssignmentDTO{}, fmt.Errorf("%w: class not found", ErrNotFound)
		}
		return AssignmentDTO{}, fmt.Errorf("%w: failed to verify class", ErrInternalServer)
	}

	req.Title = strings.TrimSpace(req.Title)
	if req.Title == "" {
		return AssignmentDTO{}, fmt.Errorf("%w: title is required", ErrBadRequest)
	}
	if req.MaxScore <= 0 {
		req.MaxScore = 100
	}
	if req.DueDate.IsZero() {
		return AssignmentDTO{}, fmt.Errorf("%w: due_date is required", ErrBadRequest)
	}

	assignment, err := s.queries.CreateAssignment(ctx, database.CreateAssignmentParams{
		ClassID:     classID,
		Title:       req.Title,
		Description: strings.TrimSpace(req.Description),
		DueDate: pgtype.Timestamptz{
			Time:  req.DueDate,
			Valid: true,
		},
		MaxScore: req.MaxScore,
	})
	if err != nil {
		return AssignmentDTO{}, fmt.Errorf("%w: failed to create assignment", ErrInternalServer)
	}

	return AssignmentDTO{
		ID:          assignment.ID,
		ClassID:     assignment.ClassID,
		Title:       assignment.Title,
		Description: assignment.Description,
		DueDate:     assignment.DueDate.Time,
		MaxScore:    assignment.MaxScore,
		CreatedAt:   assignment.CreatedAt.Time,
	}, nil
}

// ListAssignments lists all assignments for a class
func (s *Service) ListAssignments(ctx context.Context, classID uuid.UUID) ([]AssignmentDTO, error) {
	// Verify class exists
	_, err := s.queries.GetClassByID(ctx, classID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("%w: class not found", ErrNotFound)
		}
		return nil, fmt.Errorf("%w: failed to verify class", ErrInternalServer)
	}

	assignments, err := s.queries.ListAssignmentsByClassID(ctx, classID)
	if err != nil {
		return nil, fmt.Errorf("%w: failed to fetch assignments", ErrInternalServer)
	}

	result := make([]AssignmentDTO, 0, len(assignments))
	for _, a := range assignments {
		result = append(result, AssignmentDTO{
			ID:          a.ID,
			ClassID:     a.ClassID,
			Title:       a.Title,
			Description: a.Description,
			DueDate:     a.DueDate.Time,
			MaxScore:    a.MaxScore,
			CreatedAt:   a.CreatedAt.Time,
		})
	}
	return result, nil
}

// SubmitAssignment allows a student to submit an assignment
func (s *Service) SubmitAssignment(ctx context.Context, assignmentID, studentID uuid.UUID) error {
	// Verify assignment exists
	assignment, err := s.queries.GetAssignmentByID(ctx, assignmentID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return fmt.Errorf("%w: assignment not found", ErrNotFound)
		}
		return fmt.Errorf("%w: failed to fetch assignment", ErrInternalServer)
	}

	// Verify student enrollment in the assignment's class
	enrolled, err := s.queries.IsStudentEnrolled(ctx, database.IsStudentEnrolledParams{
		ClassID:   assignment.ClassID,
		StudentID: studentID,
	})
	if err != nil {
		return fmt.Errorf("%w: failed to check enrollment", ErrInternalServer)
	}
	if !enrolled {
		return fmt.Errorf("%w: student is not enrolled in this class", ErrForbidden)
	}

	status := "submitted"
	if time.Now().After(assignment.DueDate.Time) {
		status = "late"
	}

	_, err = s.queries.UpsertSubmission(ctx, database.UpsertSubmissionParams{
		AssignmentID: assignmentID,
		StudentID:    studentID,
		Status:       status,
	})
	if err != nil {
		return fmt.Errorf("%w: failed to record submission", ErrInternalServer)
	}

	return nil
}

var ErrForbidden = errors.New("forbidden")

// GradeSubmission allows a teacher to assign a grade and feedback to a submission
func (s *Service) GradeSubmission(ctx context.Context, submissionID uuid.UUID, grade float64, feedback string) error {
	if grade < 0 {
		return fmt.Errorf("%w: grade cannot be negative", ErrBadRequest)
	}

	// Convert grade to pgtype.Numeric
	var pgGrade pgtype.Numeric
	if err := pgGrade.Scan(fmt.Sprintf("%.2f", grade)); err != nil {
		return fmt.Errorf("%w: invalid grade format", ErrBadRequest)
	}

	_, err := s.queries.GradeSubmission(ctx, database.GradeSubmissionParams{
		ID:       submissionID,
		Grade:    pgGrade,
		Feedback: strings.TrimSpace(feedback),
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return fmt.Errorf("%w: submission not found", ErrNotFound)
		}
		return fmt.Errorf("%w: failed to grade submission", ErrInternalServer)
	}

	return nil
}

// GetStudentOverview returns attendance summary and pending assignments for a student
func (s *Service) GetStudentOverview(ctx context.Context, studentID uuid.UUID) (StudentOverviewResponse, error) {
	// Verify student exists and role is student
	student, err := s.queries.GetUserByID(ctx, studentID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return StudentOverviewResponse{}, fmt.Errorf("%w: student not found", ErrNotFound)
		}
		return StudentOverviewResponse{}, fmt.Errorf("%w: failed to verify student", ErrInternalServer)
	}
	if student.Role != "student" {
		return StudentOverviewResponse{}, fmt.Errorf("%w: user is not a student (role: %s)", ErrBadRequest, student.Role)
	}

	// Fetch attendance stats
	summaryRows, err := s.queries.GetStudentAttendanceSummary(ctx, studentID)
	if err != nil {
		return StudentOverviewResponse{}, fmt.Errorf("%w: failed to fetch attendance summary", ErrInternalServer)
	}

	var summary AttendanceSummary
	for _, row := range summaryRows {
		switch strings.ToLower(row.Status) {
		case "present":
			summary.Present += row.Count
		case "absent":
			summary.Absent += row.Count
		case "late":
			summary.Late += row.Count
		case "excused":
			summary.Excused += row.Count
		}
		summary.Total += row.Count
	}

	if summary.Total > 0 {
		// Attendance rate counts present + late attendance as attended days
		rate := (float64(summary.Present+summary.Late) / float64(summary.Total)) * 100.0
		summary.AttendanceRate = math.Round(rate*100) / 100
	}

	// Fetch pending assignments (assignments without a student submission)
	pendingRows, err := s.queries.ListPendingAssignmentsByStudentID(ctx, studentID)
	if err != nil {
		return StudentOverviewResponse{}, fmt.Errorf("%w: failed to fetch pending assignments", ErrInternalServer)
	}

	pending := make([]PendingAssignmentDTO, 0, len(pendingRows))
	for _, p := range pendingRows {
		pending = append(pending, PendingAssignmentDTO{
			ID:          p.ID,
			ClassID:     p.ClassID,
			ClassName:   p.ClassName,
			Title:       p.Title,
			Description: p.Description,
			DueDate:     p.DueDate.Time,
			MaxScore:    p.MaxScore,
			CreatedAt:   p.CreatedAt.Time,
		})
	}

	return StudentOverviewResponse{
		StudentID:          studentID,
		AttendanceSummary:  summary,
		PendingAssignments: pending,
	}, nil
}
