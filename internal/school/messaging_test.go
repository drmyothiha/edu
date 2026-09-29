package school

import (
	"context"
	"sync"
	"testing"
	"time"

	"edu-platform/internal/database"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

type messagingMockQuerier struct {
	database.Querier
	mu            sync.Mutex
	conversations map[uuid.UUID]database.Conversation
	messages      []database.Message
	announcements []database.Announcement
	notifications []database.Notification
	parentID      uuid.UUID
	teacherID     uuid.UUID
	studentID     uuid.UUID
	classID       uuid.UUID
}

func newMessagingMock() *messagingMockQuerier {
	pID := uuid.New()
	tID := uuid.New()
	sID := uuid.New()
	cID := uuid.New()
	return &messagingMockQuerier{
		conversations: make(map[uuid.UUID]database.Conversation),
		parentID:      pID,
		teacherID:     tID,
		studentID:     sID,
		classID:       cID,
	}
}

func (m *messagingMockQuerier) GetClassByID(ctx context.Context, id uuid.UUID) (database.Class, error) {
	return database.Class{
		ID:        id,
		Name:      "Grade 5-A",
		TeacherID: m.teacherID,
	}, nil
}

func (m *messagingMockQuerier) GetUserByID(ctx context.Context, id uuid.UUID) (database.GetUserByIDRow, error) {
	role := "student"
	name := "Maung Maung"
	if id == m.parentID {
		role = "parent"
		name = "Daw Khin Mar"
	} else if id == m.teacherID {
		role = "teacher"
		name = "Daw Thida"
	}
	return database.GetUserByIDRow{
		ID:       id,
		FullName: name,
		Role:     role,
		Email:    name + "@test.local",
	}, nil
}

func (m *messagingMockQuerier) GetParentByStudentID(ctx context.Context, id uuid.UUID) (database.GetParentByStudentIDRow, error) {
	return database.GetParentByStudentIDRow{
		ID:       m.parentID,
		Email:    "parent@test.local",
		FullName: "Daw Khin Mar",
	}, nil
}

func (m *messagingMockQuerier) GetTeacherByStudentID(ctx context.Context, id uuid.UUID) (database.GetTeacherByStudentIDRow, error) {
	return database.GetTeacherByStudentIDRow{
		ID:        m.teacherID,
		Email:     "teacher@test.local",
		FullName:  "Daw Thida",
		ClassID:   m.classID,
		ClassName: "Grade 5-A",
	}, nil
}

func (m *messagingMockQuerier) CreateConversation(ctx context.Context, arg database.CreateConversationParams) (database.Conversation, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	conv := database.Conversation{
		ID:            uuid.New(),
		SchoolID:      arg.SchoolID,
		TeacherID:     arg.TeacherID,
		ParentID:      arg.ParentID,
		StudentID:     arg.StudentID,
		LastMessageAt: pgtype.Timestamptz{Time: time.Now(), Valid: true},
		CreatedAt:     pgtype.Timestamptz{Time: time.Now(), Valid: true},
	}
	m.conversations[conv.ID] = conv
	return conv, nil
}

func (m *messagingMockQuerier) GetConversationByID(ctx context.Context, id uuid.UUID) (database.GetConversationByIDRow, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	conv, ok := m.conversations[id]
	if !ok {
		return database.GetConversationByIDRow{}, ErrNotFound
	}
	return database.GetConversationByIDRow{
		ID:            conv.ID,
		SchoolID:      conv.SchoolID,
		TeacherID:     conv.TeacherID,
		ParentID:      conv.ParentID,
		StudentID:     conv.StudentID,
		LastMessageAt: conv.LastMessageAt,
		CreatedAt:     conv.CreatedAt,
		TeacherName:   "Daw Thida",
		TeacherEmail:  "teacher@test.local",
		ParentName:    "Daw Khin Mar",
		ParentEmail:   "parent@test.local",
		StudentName:   "Maung Maung",
	}, nil
}

func (m *messagingMockQuerier) ListUserConversations(ctx context.Context, id uuid.UUID) ([]database.ListUserConversationsRow, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	var rows []database.ListUserConversationsRow
	for _, c := range m.conversations {
		if c.TeacherID == id || c.ParentID == id {
			rows = append(rows, database.ListUserConversationsRow{
				ID:                   c.ID,
				SchoolID:             c.SchoolID,
				TeacherID:            c.TeacherID,
				ParentID:             c.ParentID,
				StudentID:            c.StudentID,
				LastMessageAt:        c.LastMessageAt,
				CreatedAt:            c.CreatedAt,
				TeacherName:          "Daw Thida",
				TeacherEmail:         "teacher@test.local",
				ParentName:           "Daw Khin Mar",
				ParentEmail:          "parent@test.local",
				StudentName:          "Maung Maung",
				LatestMessageContent: "Hello",
				LatestMessageAt:      c.LastMessageAt,
				UnreadCount:          0,
			})
		}
	}
	return rows, nil
}

func (m *messagingMockQuerier) CreateMessage(ctx context.Context, arg database.CreateMessageParams) (database.Message, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	msg := database.Message{
		ID:             uuid.New(),
		ConversationID: arg.ConversationID,
		SenderID:       arg.SenderID,
		Content:        arg.Content,
		IsRead:         false,
		CreatedAt:      pgtype.Timestamptz{Time: time.Now(), Valid: true},
	}
	m.messages = append(m.messages, msg)
	return msg, nil
}

func (m *messagingMockQuerier) TouchConversation(ctx context.Context, id uuid.UUID) error {
	return nil
}

func (m *messagingMockQuerier) ListMessagesByConversation(ctx context.Context, id uuid.UUID) ([]database.ListMessagesByConversationRow, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	var rows []database.ListMessagesByConversationRow
	for _, msg := range m.messages {
		if msg.ConversationID == id {
			rows = append(rows, database.ListMessagesByConversationRow{
				ID:             msg.ID,
				ConversationID: msg.ConversationID,
				SenderID:       msg.SenderID,
				Content:        msg.Content,
				IsRead:         msg.IsRead,
				CreatedAt:      msg.CreatedAt,
				SenderName:     "Sender",
				SenderRole:     "teacher",
			})
		}
	}
	return rows, nil
}

func (m *messagingMockQuerier) MarkMessagesAsRead(ctx context.Context, arg database.MarkMessagesAsReadParams) error {
	return nil
}

func (m *messagingMockQuerier) CreateAnnouncement(ctx context.Context, arg database.CreateAnnouncementParams) (database.Announcement, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	ann := database.Announcement{
		ID:        uuid.New(),
		ClassID:   arg.ClassID,
		TeacherID: arg.TeacherID,
		Title:     arg.Title,
		Content:   arg.Content,
		Priority:  arg.Priority,
		CreatedAt: pgtype.Timestamptz{Time: time.Now(), Valid: true},
	}
	m.announcements = append(m.announcements, ann)
	return ann, nil
}

func (m *messagingMockQuerier) ListParentsByClassID(ctx context.Context, id uuid.UUID) ([]database.ListParentsByClassIDRow, error) {
	return []database.ListParentsByClassIDRow{
		{
			ID:       m.parentID,
			Email:    "parent@test.local",
			FullName: "Daw Khin Mar",
		},
	}, nil
}

func (m *messagingMockQuerier) CreateNotification(ctx context.Context, arg database.CreateNotificationParams) (database.Notification, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	notif := database.Notification{
		ID:        uuid.New(),
		UserID:    arg.UserID,
		Type:      arg.Type,
		Title:     arg.Title,
		Body:      arg.Body,
		Data:      arg.Data,
		IsRead:    false,
		CreatedAt: pgtype.Timestamptz{Time: time.Now(), Valid: true},
	}
	m.notifications = append(m.notifications, notif)
	return notif, nil
}

func (m *messagingMockQuerier) ListNotificationsByUser(ctx context.Context, arg database.ListNotificationsByUserParams) ([]database.Notification, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	var rows []database.Notification
	for _, n := range m.notifications {
		if n.UserID == arg.UserID {
			rows = append(rows, n)
		}
	}
	return rows, nil
}

func (m *messagingMockQuerier) CountUnreadNotifications(ctx context.Context, id uuid.UUID) (int64, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	var count int64
	for _, n := range m.notifications {
		if n.UserID == id && !n.IsRead {
			count++
		}
	}
	return count, nil
}

func (m *messagingMockQuerier) MarkNotificationAsRead(ctx context.Context, arg database.MarkNotificationAsReadParams) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	for i := range m.notifications {
		if m.notifications[i].ID == arg.ID && m.notifications[i].UserID == arg.UserID {
			m.notifications[i].IsRead = true
		}
	}
	return nil
}

func (m *messagingMockQuerier) MarkAllNotificationsAsRead(ctx context.Context, id uuid.UUID) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	for i := range m.notifications {
		if m.notifications[i].UserID == id {
			m.notifications[i].IsRead = true
		}
	}
	return nil
}

func TestMessagingFlow(t *testing.T) {
	ctx := context.Background()
	mock := newMessagingMock()
	svc := &Service{queries: mock}

	// 1. Parent initiates conversation with child's teacher
	conv, err := svc.GetOrCreateConversation(ctx, mock.parentID, "parent", CreateConversationRequest{
		StudentID: &mock.studentID,
	})
	if err != nil {
		t.Fatalf("failed to create conversation: %v", err)
	}
	if conv.TeacherID != mock.teacherID || conv.ParentID != mock.parentID {
		t.Errorf("unexpected participants: %+v", conv)
	}

	// 2. Parent sends message
	msg, err := svc.SendMessage(ctx, mock.parentID, conv.ID, "Hello teacher, how is Maung Maung doing?")
	if err != nil {
		t.Fatalf("failed to send message: %v", err)
	}
	if msg.Content != "Hello teacher, how is Maung Maung doing?" {
		t.Errorf("unexpected message content: %s", msg.Content)
	}

	// 3. Teacher creates class announcement
	ann, err := svc.CreateAnnouncement(ctx, mock.teacherID, mock.classID, CreateAnnouncementRequest{
		Title:    "School Sports Day",
		Content:  "Sports Day will be held next Friday at 9am.",
		Priority: "important",
	})
	if err != nil {
		t.Fatalf("failed to create announcement: %v", err)
	}
	if ann.Title != "School Sports Day" {
		t.Errorf("unexpected announcement title: %s", ann.Title)
	}

	// 4. Trigger absence notification
	svc.triggerAbsenceNotification(ctx, mock.studentID, mock.classID, "2026-09-25")

	// Wait briefly for async goroutines
	time.Sleep(100 * time.Millisecond)

	// 5. Parent checks notifications
	res, err := svc.ListNotifications(ctx, mock.parentID, 20, 0)
	if err != nil {
		t.Fatalf("failed to list notifications: %v", err)
	}
	if len(res.Notifications) == 0 {
		t.Errorf("expected notifications for parent, got 0")
	}

	// Check unread count
	if res.UnreadCount == 0 {
		t.Errorf("expected positive unread count")
	}
}
