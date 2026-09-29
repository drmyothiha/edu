package school

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/google/uuid"
)

// GatePairingSession tracks a temporary setup handshake between an unprovisioned kiosk and a school admin's mobile device
type GatePairingSession struct {
	PairingID    string    `json:"pairing_id"`
	QRPayload    string    `json:"qr_payload"`
	CreatedAt    time.Time `json:"created_at"`
	ExpiresAt    time.Time `json:"expires_at"`
	Status       string    `json:"status"` // "pending" or "paired"
	SchoolID     string    `json:"school_id,omitempty"`
	SchoolCode   string    `json:"school_code,omitempty"`
	SchoolName   string    `json:"school_name,omitempty"`
	SchoolNameMy string    `json:"school_name_my,omitempty"`
	GateName     string    `json:"gate_name,omitempty"`
	DeviceAPIKey string    `json:"device_api_key,omitempty"`
}

type ConfirmGatePairingRequest struct {
	PairingID string `json:"pairing_id"`
	GateName  string `json:"gate_name"`
	SchoolID  string `json:"school_id,omitempty"` // Optional override if sysadmin
}

type GatePairingStore struct {
	mu       sync.RWMutex
	sessions map[string]GatePairingSession
}

var globalPairingStore = &GatePairingStore{
	sessions: make(map[string]GatePairingSession),
}

func generateRandomToken(bytesLen int) string {
	b := make([]byte, bytesLen)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

// InitSession creates a new pairing session valid for 15 minutes
func (s *GatePairingStore) InitSession() GatePairingSession {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Clean expired sessions
	now := time.Now()
	for k, v := range s.sessions {
		if now.After(v.ExpiresAt) {
			delete(s.sessions, k)
		}
	}

	pairingID := fmt.Sprintf("kiosk_%s_%s", uuid.New().String()[:8], generateRandomToken(4))
	session := GatePairingSession{
		PairingID: pairingID,
		QRPayload: fmt.Sprintf("edu:kiosk:pair:%s", pairingID),
		CreatedAt: now,
		ExpiresAt: now.Add(15 * time.Minute),
		Status:    "pending",
	}

	s.sessions[pairingID] = session
	return session
}

// GetSession returns the current state of a pairing session
func (s *GatePairingStore) GetSession(pairingID string) (GatePairingSession, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	session, exists := s.sessions[pairingID]
	if !exists || time.Now().After(session.ExpiresAt) {
		return GatePairingSession{}, false
	}
	return session, true
}

// ConfirmSession marks the session as paired by an authorized school administrator
func (s *GatePairingStore) ConfirmSession(pairingID string, school SchoolDTO, gateName string) (GatePairingSession, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	session, exists := s.sessions[pairingID]
	if !exists {
		return GatePairingSession{}, errors.New("pairing session expired or not found")
	}

	if session.Status == "paired" {
		return session, nil
	}

	if gateName == "" {
		gateName = "ဂိတ်-၀၁ (အဓိက အဝင်ဝ) • Gate-01"
	}

	schoolNameMy := school.Name
	if school.NameMy != nil && *school.NameMy != "" {
		schoolNameMy = *school.NameMy
	}

	deviceKey := fmt.Sprintf("kiosk_key_%s_%s", school.Code, generateRandomToken(12))

	session.Status = "paired"
	session.SchoolID = school.ID.String()
	session.SchoolCode = school.Code
	session.SchoolName = school.Name
	session.SchoolNameMy = schoolNameMy
	session.GateName = gateName
	session.DeviceAPIKey = deviceKey

	s.sessions[pairingID] = session
	return session, nil
}
