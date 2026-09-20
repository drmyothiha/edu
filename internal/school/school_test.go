package school

import (
	"context"
	"testing"
	"time"

	"edu-platform/internal/database"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

// mockQuerier implements database.Querier for testing domain logic without live PostgreSQL
type mockQuerier struct {
	database.Querier
	classes           map[uuid.UUID]database.Class
	attendanceRecords []database.AttendanceRecord
	summaryRows       []database.GetStudentAttendanceSummaryRow
	pendingRows       []database.ListPendingAssignmentsByStudentIDRow
	rosterRows        []database.GetClassAttendanceRosterRow
}

func newMockQuerier() *mockQuerier {
	return &mockQuerier{
		classes: make(map[uuid.UUID]database.Class),
	}
}

func (m *mockQuerier) GetClassByID(ctx context.Context, id uuid.UUID) (database.Class, error) {
	c, ok := m.classes[id]
	if !ok {
		return database.Class{}, ErrNotFound
	}
	return c, nil
}

func (m *mockQuerier) UpsertAttendance(ctx context.Context, arg database.UpsertAttendanceParams) (database.AttendanceRecord, error) {
	record := database.AttendanceRecord{
		ID:        uuid.New(),
		ClassID:   arg.ClassID,
		StudentID: arg.StudentID,
		Date:      arg.Date,
		Status:    arg.Status,
		Notes:     arg.Notes,
	}
	m.attendanceRecords = append(m.attendanceRecords, record)
	return record, nil
}

func (m *mockQuerier) IsStudentEnrolled(ctx context.Context, arg database.IsStudentEnrolledParams) (bool, error) {
	return true, nil
}

func (m *mockQuerier) GetUserByID(ctx context.Context, id uuid.UUID) (database.User, error) {
	return database.User{
		ID:       id,
		FullName: "Test Student",
		Role:     "student",
	}, nil
}

func (m *mockQuerier) GetStudentAttendanceSummary(ctx context.Context, studentID uuid.UUID) ([]database.GetStudentAttendanceSummaryRow, error) {
	return m.summaryRows, nil
}

func (m *mockQuerier) ListPendingAssignmentsByStudentID(ctx context.Context, studentID uuid.UUID) ([]database.ListPendingAssignmentsByStudentIDRow, error) {
	return m.pendingRows, nil
}

func (m *mockQuerier) GetClassAttendanceRoster(ctx context.Context, arg database.GetClassAttendanceRosterParams) ([]database.GetClassAttendanceRosterRow, error) {
	return m.rosterRows, nil
}

func TestBatchRecordAttendance(t *testing.T) {
	mock := newMockQuerier()
	classID := uuid.New()
	mock.classes[classID] = database.Class{
		ID:   classID,
		Name: "Calculus I",
	}

	service := NewService(mock)
	student1 := uuid.New()
	student2 := uuid.New()

	req := BatchAttendanceRequest{
		Date: "2026-09-20",
		Records: []AttendanceItem{
			{StudentID: student1, Status: "present", Notes: "On time"},
			{StudentID: student2, Status: "late", Notes: "5 min late"},
		},
	}

	res, err := service.BatchRecordAttendance(context.Background(), classID, req)
	if err != nil {
		t.Fatalf("unexpected error recording attendance: %v", err)
	}

	if res.RecordedCount != 2 {
		t.Errorf("expected 2 recorded items, got %d", res.RecordedCount)
	}
	if len(mock.attendanceRecords) != 2 {
		t.Errorf("expected 2 records in mock db, got %d", len(mock.attendanceRecords))
	}
}

func TestBatchRecordAttendanceInvalidStatus(t *testing.T) {
	mock := newMockQuerier()
	classID := uuid.New()
	mock.classes[classID] = database.Class{ID: classID}

	service := NewService(mock)
	req := BatchAttendanceRequest{
		Date: "2026-09-20",
		Records: []AttendanceItem{
			{StudentID: uuid.New(), Status: "invalid_status"},
		},
	}

	_, err := service.BatchRecordAttendance(context.Background(), classID, req)
	if err == nil {
		t.Fatalf("expected error for invalid attendance status, got nil")
	}
}

func TestGetStudentOverview(t *testing.T) {
	mock := newMockQuerier()
	studentID := uuid.New()

	// 18 present, 2 absent -> total 20 -> 90% attendance rate
	mock.summaryRows = []database.GetStudentAttendanceSummaryRow{
		{Status: "present", Count: 18},
		{Status: "absent", Count: 2},
	}

	mock.pendingRows = []database.ListPendingAssignmentsByStudentIDRow{
		{
			ID:          uuid.New(),
			ClassID:     uuid.New(),
			ClassName:   "Physics 101",
			Title:       "Lab Report 1",
			Description: "Mechanics report",
			DueDate:     pgtype.Timestamptz{Time: time.Now().Add(48 * time.Hour), Valid: true},
			MaxScore:    100,
		},
	}

	service := NewService(mock)
	overview, err := service.GetStudentOverview(context.Background(), studentID)
	if err != nil {
		t.Fatalf("unexpected error getting student overview: %v", err)
	}

	if overview.StudentID != studentID {
		t.Errorf("expected student ID %s, got %s", studentID, overview.StudentID)
	}
	if overview.AttendanceSummary.Total != 20 {
		t.Errorf("expected 20 total days, got %d", overview.AttendanceSummary.Total)
	}
	if overview.AttendanceSummary.Present != 18 {
		t.Errorf("expected 18 present, got %d", overview.AttendanceSummary.Present)
	}
	if overview.AttendanceSummary.Absent != 2 {
		t.Errorf("expected 2 absent, got %d", overview.AttendanceSummary.Absent)
	}
	if overview.AttendanceSummary.AttendanceRate != 90.0 {
		t.Errorf("expected 90%% attendance rate, got %f", overview.AttendanceSummary.AttendanceRate)
	}

	if len(overview.PendingAssignments) != 1 {
		t.Fatalf("expected 1 pending assignment, got %d", len(overview.PendingAssignments))
	}
	if overview.PendingAssignments[0].Title != "Lab Report 1" {
		t.Errorf("expected title 'Lab Report 1', got %s", overview.PendingAssignments[0].Title)
	}
}
