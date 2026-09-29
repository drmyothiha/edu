package copilot

import (
	"context"
	"encoding/json"
	"fmt"

	"edu-platform/internal/database"
	"edu-platform/internal/notification"
	"github.com/google/uuid"
)

// NotificationEventPublisher publishes LessonCreatedEvent to the notification service and SSE broker
type NotificationEventPublisher struct {
	notifService *notification.Service
	querier      database.Querier
}

// NewNotificationEventPublisher creates a publisher instance
func NewNotificationEventPublisher(notifService *notification.Service, querier database.Querier) *NotificationEventPublisher {
	return &NotificationEventPublisher{
		notifService: notifService,
		querier:      querier,
	}
}

// PublishLessonCreated persists a notification and broadcasts LessonCreatedEvent over SSE & FCM
func (p *NotificationEventPublisher) PublishLessonCreated(
	ctx context.Context,
	userID uuid.UUID,
	planID uuid.UUID,
	subject, grade, topic string,
	alignmentScore float64,
) error {
	if p.notifService == nil || p.querier == nil {
		return nil
	}

	payload := map[string]any{
		"event":                     "LessonCreatedEvent",
		"lesson_plan_id":            planID.String(),
		"subject":                   subject,
		"grade_level":               grade,
		"topic":                     topic,
		"curriculum_alignment_score": alignmentScore,
		"route":                     "/teacher/copilot",
	}

	dataBytes, _ := json.Marshal(payload)

	notif, err := p.querier.CreateNotification(ctx, database.CreateNotificationParams{
		UserID: userID,
		Type:   "lesson_created",
		Title:  "သင်ခန်းစာ အစီအစဉ် ရေးဆွဲပြီးပါပြီ • Lesson Plan Generated",
		Body:   fmt.Sprintf("RAG-grounded lesson plan for %s (%s) generated and validated with %.0f%% curriculum alignment.", topic, grade, alignmentScore),
		Data:   dataBytes,
	})
	if err != nil {
		return fmt.Errorf("failed to create lesson notification: %w", err)
	}

	p.notifService.PublishNotification(ctx, notif)
	return nil
}
