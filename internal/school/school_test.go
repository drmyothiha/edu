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

func (m *mockQuerier) GetUserByID(ctx context.Context, id uuid.UUID) (database.GetUserByIDRow, error) {
	return database.GetUserByIDRow{
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

func (m *mockQuerier) ListClassesByStudentID(ctx context.Context, studentID uuid.UUID) ([]database.ListClassesByStudentIDRow, error) {
	var rows []database.ListClassesByStudentIDRow
	for id, c := range m.classes {
		rows = append(rows, database.ListClassesByStudentIDRow{
			ID:   id,
			Name: c.Name,
		})
	}
	return rows, nil
}

func (m *mockQuerier) ListSchools(ctx context.Context) ([]database.School, error) {
	return []database.School{
		{
			ID:     uuid.MustParse("00000000-0000-0000-0000-000000000001"),
			Name:   "BEHS Intaing (အင်းတိုင် အထက)",
			Code:   "MMR013035-BEHS01",
			Region: "Yangon Region",
		},
	}, nil
}

func (m *mockQuerier) GetSchoolByID(ctx context.Context, id uuid.UUID) (database.School, error) {
	return database.School{
		ID:     id,
		Name:   "BEHS Intaing (အင်းတိုင် အထက)",
		Code:   "MMR013035-BEHS01",
		Region: "Yangon Region",
	}, nil
}

func (m *mockQuerier) ListStudentsBySchool(ctx context.Context, schoolID pgtype.UUID) ([]database.ListStudentsBySchoolRow, error) {
	return []database.ListStudentsBySchoolRow{
		{
			ID:         uuid.MustParse("11111111-1111-1111-1111-111111111111"),
			Email:      "aung.kyaw@edu.local",
			FullName:   "MAUNG AUNG KYAW",
			Role:       "student",
			SchoolName: "BEHS Intaing",
			ClassName:  pgtype.Text{String: "Grade 5-A", Valid: true},
			GradeLevel: pgtype.Text{String: "Grade 5 (Primary)", Valid: true},
		},
	}, nil
}

func (m *mockQuerier) GetVerifiableCredentialByStudentID(ctx context.Context, studentID uuid.UUID) (database.VerifiableCredential, error) {
	return database.VerifiableCredential{
		StudentID: studentID,
		Did:       "did:edu:mm:013:MMR013035-BEHS01-2026-STU0042",
	}, nil
}

func (m *mockQuerier) ListStudentsByClassID(ctx context.Context, classID uuid.UUID) ([]database.ListStudentsByClassIDRow, error) {
	return []database.ListStudentsByClassIDRow{}, nil
}

func (m *mockQuerier) ListParentsByClassID(ctx context.Context, classID uuid.UUID) ([]database.ListParentsByClassIDRow, error) {
	return []database.ListParentsByClassIDRow{}, nil
}

func (m *mockQuerier) CreateNotification(ctx context.Context, arg database.CreateNotificationParams) (database.Notification, error) {
	return database.Notification{
		ID:     uuid.New(),
		UserID: arg.UserID,
		Type:   arg.Type,
		Title:  arg.Title,
		Body:   arg.Body,
	}, nil
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

func TestGetGateRoster(t *testing.T) {
	mock := newMockQuerier()
	service := NewService(mock)

	roster, err := service.GetGateRoster(context.Background(), nil)
	if err != nil {
		t.Fatalf("unexpected error getting gate roster: %v", err)
	}

	if roster.TotalCount != 1 {
		t.Errorf("expected 1 student in roster, got %d", roster.TotalCount)
	}
	if len(roster.Students) != 1 {
		t.Fatalf("expected 1 student item, got %d", len(roster.Students))
	}

	st := roster.Students[0]
	if st.FullName != "MAUNG AUNG KYAW" {
		t.Errorf("expected student name MAUNG AUNG KYAW, got %s", st.FullName)
	}
	if st.DID != "did:edu:mm:013:MMR013035-BEHS01-2026-STU0042" {
		t.Errorf("unexpected DID: %s", st.DID)
	}
	if st.SchoolCode != "MMR013035-BEHS01" {
		t.Errorf("unexpected school code: %s", st.SchoolCode)
	}
}

func TestSyncAttendanceBatch(t *testing.T) {
	mock := newMockQuerier()
	classID := uuid.New()
	mock.classes[classID] = database.Class{ID: classID, Name: "Grade 5-A"}

	service := NewService(mock)

	studentID := uuid.MustParse("11111111-1111-1111-1111-111111111111")
	eventID := "ev-swipe-001"

	req := SyncAttendanceBatchRequest{
		SchoolCode: "MMR013035-BEHS01",
		DeviceID:   "GATE-01-DESK",
		Events: []SyncAttendanceEvent{
			{
				EventID:     eventID,
				StudentID:   &studentID,
				DID:         "did:edu:mm:013:MMR013035-BEHS01-2026-STU0042",
				StudentName: "MAUNG AUNG KYAW",
				ClassID:     &classID,
				ClassName:   "Grade 5-A",
				EventDate:   "2026-09-28",
				TimeDisplay: "07:45 AM",
				ScanMethod:  "nfc_tap",
				Status:      "present",
				DeviceID:    "GATE-01-DESK",
			},
		},
	}

	resp, err := service.SyncAttendanceBatch(context.Background(), req)
	if err != nil {
		t.Fatalf("unexpected error during batch sync: %v", err)
	}

	if resp.SyncedCount != 1 {
		t.Errorf("expected 1 synced item, got %d", resp.SyncedCount)
	}
	if len(resp.SyncedIDs) != 1 || resp.SyncedIDs[0] != eventID {
		t.Errorf("expected event %s to be synced, got %v", eventID, resp.SyncedIDs)
	}
	if len(mock.attendanceRecords) != 1 {
		t.Fatalf("expected 1 attendance record in db, got %d", len(mock.attendanceRecords))
	}

	record := mock.attendanceRecords[0]
	if record.Status != "present" {
		t.Errorf("expected status 'present', got %s", record.Status)
	}
	if record.StudentID != studentID {
		t.Errorf("expected student ID %s, got %s", studentID, record.StudentID)
	}
}

func TestClassTimetableAndStudentSync(t *testing.T) {
	mock := &mockQuerier{
		classes: make(map[uuid.UUID]database.Class),
	}
	service := NewService(mock)

	classID := uuid.New()
	studentID := uuid.New()
	mock.classes[classID] = database.Class{
		ID:           classID,
		Name:         "Grade 8 - Section A",
		GradeLevel:   "Grade 8",
		AcademicYear: "2026-2027",
	}

	// 1. Get initial default timetable for class
	tt, err := service.GetClassTimetable(context.Background(), classID)
	if err != nil {
		t.Fatalf("failed to get class timetable: %v", err)
	}
	if tt == nil || len(tt.Periods) == 0 {
		t.Fatalf("expected non-empty periods for class timetable")
	}

	// 2. Teacher updates timetable
	updateReq := UpdateClassTimetableRequest{
		ClassID:   classID,
		ShiftType: "morning",
		Periods: []TimetablePeriodDTO{
			{
				ID:            "period-1-mon",
				ClassID:       classID.String(),
				GradeLevel:    "Grade 8",
				Section:       "Section A",
				DayOfWeek:     1,
				StartTime:     "08:00",
				EndTime:       "08:50",
				PeriodIndex:   1,
				SubjectName:   "Advanced Mathematics",
				SubjectNameMy: "အဆင့်မြင့် သင်္ချာ",
				SubjectCode:   "MTH-301",
				TeacherName:   "ဒေါ်သီတာ (Daw Thida)",
				RoomNumber:    "Room 302",
				ColorHex:      "#3B82F6",
				Topic:         "Chapter 1: Quadratic Equations",
				ShiftType:     "morning",
			},
		},
	}

	updated, err := service.UpdateClassTimetable(context.Background(), updateReq)
	if err != nil {
		t.Fatalf("failed to update timetable: %v", err)
	}
	if updated.ShiftType != "morning" || len(updated.Periods) != 1 {
		t.Fatalf("expected 1 period with morning shift, got %d periods and shift %s", len(updated.Periods), updated.ShiftType)
	}

	// 3. Publish timetable to mobile
	published, err := service.PublishClassTimetable(context.Background(), classID)
	if err != nil {
		t.Fatalf("failed to publish timetable: %v", err)
	}
	if published == nil {
		t.Fatalf("expected non-nil published timetable")
	}

	// 4. Student syncs their timetable
	studentTT, err := service.GetStudentTimetable(context.Background(), studentID)
	if err != nil {
		t.Fatalf("failed to get student timetable: %v", err)
	}
	if studentTT == nil || len(studentTT.Periods) == 0 {
		t.Fatalf("expected non-empty student timetable periods")
	}
	// Verify student gets the updated timetable
	if studentTT.ClassID == classID {
		if studentTT.Periods[0].SubjectName != "Advanced Mathematics" {
			t.Errorf("expected 'Advanced Mathematics', got '%s'", studentTT.Periods[0].SubjectName)
		}
	}
}

