package notification

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sync"
	"time"

	"edu-platform/internal/auth"
	"github.com/google/uuid"
)

// NotificationEvent represents the live notification payload pushed over SSE
type NotificationEvent struct {
	ID        uuid.UUID       `json:"id"`
	UserID    uuid.UUID       `json:"user_id"`
	Type      string          `json:"type"`
	Title     string          `json:"title"`
	Body      string          `json:"body"`
	Data      json.RawMessage `json:"data"`
	IsRead    bool            `json:"is_read"`
	CreatedAt time.Time       `json:"created_at"`
}

// Broker manages active client SSE channels
type Broker struct {
	mu      sync.RWMutex
	clients map[uuid.UUID]map[chan NotificationEvent]struct{}
}

// NewBroker initializes a thread-safe SSE broker
func NewBroker() *Broker {
	return &Broker{
		clients: make(map[uuid.UUID]map[chan NotificationEvent]struct{}),
	}
}

// Subscribe attaches a new SSE client for a given user
func (b *Broker) Subscribe(userID uuid.UUID) (chan NotificationEvent, func()) {
	b.mu.Lock()
	defer b.mu.Unlock()

	ch := make(chan NotificationEvent, 32)
	if _, exists := b.clients[userID]; !exists {
		b.clients[userID] = make(map[chan NotificationEvent]struct{})
	}
	b.clients[userID][ch] = struct{}{}

	unsubscribe := func() {
		b.mu.Lock()
		defer b.mu.Unlock()
		if userMap, exists := b.clients[userID]; exists {
			delete(userMap, ch)
			if len(userMap) == 0 {
				delete(b.clients, userID)
			}
		}
		close(ch)
	}

	return ch, unsubscribe
}

// Broadcast distributes a notification event to all connected channels for that user
func (b *Broker) Broadcast(userID uuid.UUID, event NotificationEvent) {
	b.mu.RLock()
	defer b.mu.RUnlock()

	userMap, exists := b.clients[userID]
	if !exists {
		return
	}

	for ch := range userMap {
		select {
		case ch <- event:
		default:
			log.Printf("[SSE] Channel buffer full for user %s, event skipped on slow connection", userID)
		}
	}
}

// StreamHandler streams Server-Sent Events to the authenticated client
func (b *Broker) StreamHandler(w http.ResponseWriter, r *http.Request) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "Streaming unsupported by client or server", http.StatusInternalServerError)
		return
	}

	user, ok := auth.UserFromContext(r.Context())
	if !ok || user == nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// SSE response headers
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no") // Disables Nginx response buffering
	if origin := r.Header.Get("Origin"); origin != "" {
		w.Header().Set("Access-Control-Allow-Origin", origin)
		w.Header().Set("Access-Control-Allow-Credentials", "true")
	}

	eventChan, unsubscribe := b.Subscribe(user.UserID)
	defer unsubscribe()

	// Initial connected ping
	fmt.Fprintf(w, ": connected\n\n")
	flusher.Flush()

	// Keep-alive heartbeat ticker every 15s to keep connections alive through proxies & NAT
	ticker := time.NewTicker(15 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-r.Context().Done():
			return

		case <-ticker.C:
			if _, err := fmt.Fprintf(w, ": keepalive\n\n"); err != nil {
				return
			}
			flusher.Flush()

		case ev, open := <-eventChan:
			if !open {
				return
			}
			payload, err := json.Marshal(ev)
			if err != nil {
				continue
			}
			if _, err := fmt.Fprintf(w, "event: notification\ndata: %s\n\n", payload); err != nil {
				return
			}
			flusher.Flush()
		}
	}
}
