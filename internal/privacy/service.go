package privacy

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/google/uuid"
)

// Service coordinates data erasure requests, policies, and audit logging
type Service struct {
	mu          sync.RWMutex
	anonymizer  *Anonymizer
	requests    map[uuid.UUID]*ErasureRequest
	auditLogs   []PrivacyAuditLog
	summaries   map[string]*AnonymizedStudentSummary
	policies    []RetentionPolicy
}

func NewService(pepper string) *Service {
	return &Service{
		anonymizer: NewAnonymizer(pepper),
		requests:   make(map[uuid.UUID]*ErasureRequest),
		auditLogs:  make([]PrivacyAuditLog, 0),
		summaries:  make(map[string]*AnonymizedStudentSummary),
		policies: []RetentionPolicy{
			{
				ID:                    "policy-graduated-5yr",
				TargetCohort:          "graduated",
				RetentionPeriodMonths: 60,
				Action:                RequestTypeDeIdentifyAnalytics,
				PreserveStatistics:    true,
			},
			{
				ID:                    "policy-withdrawn-3yr",
				TargetCohort:          "withdrawn",
				RetentionPeriodMonths: 36,
				Action:                RequestTypeFullErasure,
				PreserveStatistics:    false,
			},
		},
	}
}

// SubmitErasureRequest queues a request to be forgotten
func (s *Service) SubmitErasureRequest(
	ctx context.Context,
	studentID uuid.UUID,
	originalDID string,
	schoolID *uuid.UUID,
	requestedBy *uuid.UUID,
	reqType RequestType,
	legalBasis, reason string,
) (*ErasureRequest, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	req := &ErasureRequest{
		ID:             uuid.New(),
		StudentID:      studentID,
		OriginalDID:    originalDID,
		SchoolID:       schoolID,
		RequestedBy:    requestedBy,
		RequestType:    reqType,
		Status:         StatusPending,
		LegalBasis:     legalBasis,
		Reason:         reason,
		FieldsScrubbed: make([]string, 0),
		RequestedAt:    time.Now().UTC(),
	}

	s.requests[req.ID] = req
	return req, nil
}

// GetErasureRequest retrieves an erasure request by ID
func (s *Service) GetErasureRequest(id uuid.UUID) (*ErasureRequest, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	req, ok := s.requests[id]
	if !ok {
		return nil, fmt.Errorf("erasure request not found: %s", id)
	}
	return req, nil
}

// ExecuteErasure performs the cryptographic anonymization and updates records
func (s *Service) ExecuteErasure(
	ctx context.Context,
	requestID uuid.UUID,
	executedBy *uuid.UUID,
	record *StudentPIIRecord,
) (*AnonymizedStudentSummary, *ErasureRequest, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	req, ok := s.requests[requestID]
	if !ok {
		return nil, nil, fmt.Errorf("erasure request not found: %s", requestID)
	}

	if req.Status == StatusExecuted {
		return nil, nil, fmt.Errorf("request already executed")
	}

	summary, scrubbed, err := s.anonymizer.ScrubStudentRecord(record, req.RequestType)
	if err != nil {
		return nil, nil, fmt.Errorf("scrub failed: %w", err)
	}

	now := time.Now().UTC()
	req.Status = StatusExecuted
	req.ExecutedAt = &now
	req.ExecutedBy = executedBy
	req.Pseudonym = summary.Pseudonym
	req.FieldsScrubbed = scrubbed

	// Save anonymized analytical summary
	s.summaries[summary.Pseudonym] = summary

	// Write immutable audit log entry
	logEntry := PrivacyAuditLog{
		ID:              uuid.New(),
		EventType:       "PII_SCRUBBED",
		ActorID:         executedBy,
		TargetStudentID: req.StudentID,
		Pseudonym:       summary.Pseudonym,
		Details: map[string]interface{}{
			"fields_scrubbed_count": len(scrubbed),
			"request_type":          string(req.RequestType),
			"legal_basis":           req.LegalBasis,
		},
		CreatedAt: now,
	}
	s.auditLogs = append(s.auditLogs, logEntry)

	return summary, req, nil
}

// GetAuditLogs returns compliance logs
func (s *Service) GetAuditLogs() []PrivacyAuditLog {
	s.mu.RLock()
	defer s.mu.RUnlock()

	logsCopy := make([]PrivacyAuditLog, len(s.auditLogs))
	copy(logsCopy, s.auditLogs)
	return logsCopy
}

// GetPolicies returns active retention policies
func (s *Service) GetPolicies() []RetentionPolicy {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.policies
}
