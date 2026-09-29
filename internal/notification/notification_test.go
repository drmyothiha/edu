package notification_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"edu-platform/internal/auth"
	"edu-platform/internal/database"
	"edu-platform/internal/notification"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

type mockQuerier struct {
	database.Querier
	mu     sync.Mutex
	tokens map[uuid.UUID][]database.UserDeviceToken
}

func newMockQuerier() *mockQuerier {
	return &mockQuerier{
		tokens: make(map[uuid.UUID][]database.UserDeviceToken),
	}
}

func (m *mockQuerier) UpsertDeviceToken(ctx context.Context, arg database.UpsertDeviceTokenParams) (database.UserDeviceToken, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	tok := database.UserDeviceToken{
		ID:        uuid.New(),
		UserID:    arg.UserID,
		FcmToken:  arg.FcmToken,
		Platform:  arg.Platform,
		CreatedAt: pgtype.Timestamptz{Time: time.Now(), Valid: true},
		UpdatedAt: pgtype.Timestamptz{Time: time.Now(), Valid: true},
	}
	m.tokens[arg.UserID] = append(m.tokens[arg.UserID], tok)
	return tok, nil
}

func (m *mockQuerier) DeleteDeviceToken(ctx context.Context, fcmToken string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	for uID, list := range m.tokens {
		filtered := make([]database.UserDeviceToken, 0)
		for _, t := range list {
			if t.FcmToken != fcmToken {
				filtered = append(filtered, t)
			}
		}
		m.tokens[uID] = filtered
	}
	return nil
}

func (m *mockQuerier) ListDeviceTokensByUserID(ctx context.Context, userID uuid.UUID) ([]database.UserDeviceToken, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.tokens[userID], nil
}

type mockPushClient struct {
	mu     sync.Mutex
	pushes []struct {
		tokens []string
		title  string
		body   string
	}
}

func (m *mockPushClient) SendPush(ctx context.Context, tokens []string, title, body string, data map[string]string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.pushes = append(m.pushes, struct {
		tokens []string
		title  string
		body   string
	}{tokens: tokens, title: title, body: body})
	return nil
}

func TestSSEBroker_SubscribeAndBroadcast(t *testing.T) {
	broker := notification.NewBroker()
	userID := uuid.New()

	ch, unsub := broker.Subscribe(userID)
	defer unsub()

	event := notification.NotificationEvent{
		ID:     uuid.New(),
		UserID: userID,
		Type:   "message",
		Title:  "Hello Test",
		Body:   "This is a test notification",
	}

	broker.Broadcast(userID, event)

	select {
	case received := <-ch:
		if received.Title != "Hello Test" {
			t.Fatalf("expected title 'Hello Test', got %s", received.Title)
		}
	case <-time.After(1 * time.Second):
		t.Fatal("timed out waiting for event on SSE channel")
	}
}

func TestNotificationService_PublishAndTokens(t *testing.T) {
	querier := newMockQuerier()
	broker := notification.NewBroker()
	pushClient := &mockPushClient{}

	service := notification.NewService(querier, broker, pushClient)
	userID := uuid.New()

	// 1. Register device token
	err := service.RegisterDeviceToken(context.Background(), userID, "fcm-token-123", "android")
	if err != nil {
		t.Fatalf("failed to register token: %v", err)
	}

	// 2. Subscribe to SSE
	ch, unsub := broker.Subscribe(userID)
	defer unsub()

	// 3. Publish notification
	notif := database.Notification{
		ID:        uuid.New(),
		UserID:    userID,
		Type:      "absence_alert",
		Title:     "Student Absent",
		Body:      "Student was absent today",
		Data:      []byte(`{"student_id":"123"}`),
		CreatedAt: pgtype.Timestamptz{Time: time.Now(), Valid: true},
	}
	service.PublishNotification(context.Background(), notif)

	// Check SSE receive
	select {
	case ev := <-ch:
		if ev.Title != "Student Absent" {
			t.Errorf("expected SSE event title 'Student Absent', got %s", ev.Title)
		}
	case <-time.After(1 * time.Second):
		t.Fatal("timed out waiting for SSE event")
	}

	// Wait briefly for background FCM goroutine
	time.Sleep(50 * time.Millisecond)
	pushClient.mu.Lock()
	defer pushClient.mu.Unlock()
	if len(pushClient.pushes) == 0 {
		t.Errorf("expected push client to receive push, got 0")
	} else if pushClient.pushes[0].title != "Student Absent" {
		t.Errorf("expected push title 'Student Absent', got %s", pushClient.pushes[0].title)
	}
}

func TestNotificationHandler_Endpoints(t *testing.T) {
	querier := newMockQuerier()
	broker := notification.NewBroker()
	pushClient := &mockPushClient{}
	service := notification.NewService(querier, broker, pushClient)
	handler := notification.NewHandler(service)

	userID := uuid.New()
	userCtx := &auth.UserContext{
		UserID: userID,
		Email:  "test@edu.mm",
		Role:   "parent",
	}

	// Test POST /api/v1/devices/token
	reqBody := `{"fcm_token":"fcm-web-test","platform":"web"}`
	req := httptest.NewRequest("POST", "/api/v1/devices/token", strings.NewReader(reqBody))
	req = req.WithContext(auth.ContextWithUser(req.Context(), userCtx))
	rec := httptest.NewRecorder()

	handler.RegisterDeviceToken(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", rec.Code, rec.Body.String())
	}

	// Test DELETE /api/v1/devices/token
	delBody := `{"fcm_token":"fcm-web-test"}`
	delReq := httptest.NewRequest("DELETE", "/api/v1/devices/token", strings.NewReader(delBody))
	delReq = delReq.WithContext(auth.ContextWithUser(delReq.Context(), userCtx))
	delRec := httptest.NewRecorder()

	handler.UnregisterDeviceToken(delRec, delReq)
	if delRec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", delRec.Code, delRec.Body.String())
	}
}
