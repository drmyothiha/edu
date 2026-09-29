package notification

import (
	"context"
	"encoding/json"
	"fmt"
	"log"

	"edu-platform/internal/database"
	"github.com/google/uuid"
)

// Service provides notification streaming, token management, and push dispatching
type Service struct {
	queries database.Querier
	broker  *Broker
	fcm     PushClient
}

// NewService creates a new notification service
func NewService(queries database.Querier, broker *Broker, fcm PushClient) *Service {
	return &Service{
		queries: queries,
		broker:  broker,
		fcm:     fcm,
	}
}

// Broker returns the SSE broker instance
func (s *Service) Broker() *Broker {
	return s.broker
}

// RegisterDeviceToken saves or updates an FCM token for a user
func (s *Service) RegisterDeviceToken(ctx context.Context, userID uuid.UUID, fcmToken, platform string) error {
	if fcmToken == "" {
		return fmt.Errorf("fcm_token cannot be empty")
	}
	if platform == "" {
		platform = "web"
	}

	_, err := s.queries.UpsertDeviceToken(ctx, database.UpsertDeviceTokenParams{
		UserID:   userID,
		FcmToken: fcmToken,
		Platform: platform,
	})
	if err != nil {
		return fmt.Errorf("failed to save device token: %w", err)
	}

	log.Printf("[Notification] Registered %s device token for user %s", platform, userID)
	return nil
}

// UnregisterDeviceToken removes a device token (e.g., on logout)
func (s *Service) UnregisterDeviceToken(ctx context.Context, fcmToken string) error {
	if fcmToken == "" {
		return nil
	}
	return s.queries.DeleteDeviceToken(ctx, fcmToken)
}

// PublishNotification sends the notification via SSE (foreground) and FCM (background push)
func (s *Service) PublishNotification(ctx context.Context, notif database.Notification) {
	// 1. Instant foreground SSE broadcast
	event := NotificationEvent{
		ID:        notif.ID,
		UserID:    notif.UserID,
		Type:      notif.Type,
		Title:     notif.Title,
		Body:      notif.Body,
		Data:      notif.Data,
		IsRead:    notif.IsRead,
		CreatedAt: notif.CreatedAt.Time,
	}
	s.broker.Broadcast(notif.UserID, event)

	// 2. Background push notification via FCM
	go func() {
		bgCtx := context.Background()
		tokens, err := s.queries.ListDeviceTokensByUserID(bgCtx, notif.UserID)
		if err != nil {
			log.Printf("[Notification] Error fetching device tokens for user %s: %v", notif.UserID, err)
			return
		}
		if len(tokens) == 0 {
			return
		}

		tokenStrings := make([]string, 0, len(tokens))
		for _, t := range tokens {
			tokenStrings = append(tokenStrings, t.FcmToken)
		}

		// Prepare string data payload for FCM
		dataPayload := map[string]string{
			"id":              notif.ID.String(),
			"type":            notif.Type,
			"title":           notif.Title,
			"click_action":    "FLUTTER_NOTIFICATION_CLICK",
			"route":           "/notifications",
		}

		// Unmarshal extra data fields if present
		var extraData map[string]any
		if err := json.Unmarshal(notif.Data, &extraData); err == nil {
			for k, v := range extraData {
				dataPayload[k] = fmt.Sprintf("%v", v)
			}
		}

		if err := s.fcm.SendPush(bgCtx, tokenStrings, notif.Title, notif.Body, dataPayload); err != nil {
			log.Printf("[Notification] Failed to send push to user %s: %v", notif.UserID, err)
		}
	}()
}
