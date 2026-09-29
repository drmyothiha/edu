package notification

import (
	"context"
	"fmt"
	"log"
	"os"

	firebase "firebase.google.com/go/v4"
	"firebase.google.com/go/v4/messaging"
	"google.golang.org/api/option"
)

// PushClient defines the interface for delivering push notifications to mobile and web devices
type PushClient interface {
	SendPush(ctx context.Context, tokens []string, title, body string, data map[string]string) error
}

// NoopPushClient is used in local development or test environments where Firebase credentials are not provided
type NoopPushClient struct{}

func (n *NoopPushClient) SendPush(ctx context.Context, tokens []string, title, body string, data map[string]string) error {
	log.Printf("[FCM-Dev] Push notification simulated (no credentials configured): title=%q tokens_count=%d", title, len(tokens))
	return nil
}

// FirebasePushClient sends push notifications via Firebase Cloud Messaging
type FirebasePushClient struct {
	client *messaging.Client
}

// NewPushClient creates a FirebasePushClient if credentialsFile exists, or falls back to NoopPushClient
func NewPushClient(ctx context.Context, credentialsFile string) (PushClient, error) {
	if credentialsFile == "" {
		log.Println("[FCM] FIREBASE_CREDENTIALS_FILE not set. Using dev/noop push client.")
		return &NoopPushClient{}, nil
	}

	if _, err := os.Stat(credentialsFile); os.IsNotExist(err) {
		log.Printf("[FCM] Credentials file %q not found. Using dev/noop push client.", credentialsFile)
		return &NoopPushClient{}, nil
	}

	app, err := firebase.NewApp(ctx, nil, option.WithCredentialsFile(credentialsFile))
	if err != nil {
		return nil, fmt.Errorf("failed to initialize firebase app: %w", err)
	}

	fcmClient, err := app.Messaging(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get firebase messaging client: %w", err)
	}

	log.Printf("[FCM] Initialized Firebase Cloud Messaging client from %s", credentialsFile)
	return &FirebasePushClient{client: fcmClient}, nil
}

// SendPush sends multicast notification to a list of device tokens
func (f *FirebasePushClient) SendPush(ctx context.Context, tokens []string, title, body string, data map[string]string) error {
	if len(tokens) == 0 {
		return nil
	}

	// Max 500 tokens per multicast message in FCM
	const maxTokensPerBatch = 500
	for i := 0; i < len(tokens); i += maxTokensPerBatch {
		end := i + maxTokensPerBatch
		if end > len(tokens) {
			end = len(tokens)
		}
		batch := tokens[i:end]

		msg := &messaging.MulticastMessage{
			Tokens: batch,
			Notification: &messaging.Notification{
				Title: title,
				Body:  body,
			},
			Data: data,
			Android: &messaging.AndroidConfig{
				Priority: "high",
				Notification: &messaging.AndroidNotification{
					Title:       title,
					Body:        body,
					Sound:       "default",
					ClickAction: "FLUTTER_NOTIFICATION_CLICK",
				},
			},
			Webpush: &messaging.WebpushConfig{
				Notification: &messaging.WebpushNotification{
					Title: title,
					Body:  body,
					Icon:  "/edu/logo.png",
				},
				FCMOptions: &messaging.WebpushFCMOptions{
					Link: "/edu/notifications",
				},
			},
		}

		resp, err := f.client.SendEachForMulticast(ctx, msg)
		if err != nil {
			log.Printf("[FCM] Error sending multicast: %v", err)
			return err
		}

		if resp.FailureCount > 0 {
			log.Printf("[FCM] Multicast sent with %d successes and %d failures", resp.SuccessCount, resp.FailureCount)
		}
	}

	return nil
}
