package revocation

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/google/uuid"
)

// Registry manages credential revocation lists and queries
type Registry struct {
	mu           sync.RWMutex
	bitset       *BitSet
	issuerDID    string
	listID       uuid.UUID
	nextBitIndex int
	records      map[string]*RevocationRecord // keyed by credential_hash
	hashToBit    map[string]int
	bitToHash    map[int]string
}

func NewRegistry(issuerDID string, totalBits int) *Registry {
	if totalBits <= 0 {
		totalBits = 131072
	}
	return &Registry{
		bitset:    NewBitSet(totalBits),
		issuerDID: issuerDID,
		listID:    uuid.New(),
		records:   make(map[string]*RevocationRecord),
		hashToBit: make(map[string]int),
		bitToHash: make(map[int]string),
	}
}

// RegisterCredential allocates the next bit position for a newly issued credential
func (r *Registry) RegisterCredential(credentialHash, studentDID string) (int, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	if _, exists := r.hashToBit[credentialHash]; exists {
		return r.hashToBit[credentialHash], nil
	}

	if r.nextBitIndex >= r.bitset.capacity {
		return -1, fmt.Errorf("revocation list capacity exceeded (%d bits)", r.bitset.capacity)
	}

	bitPos := r.nextBitIndex
	r.nextBitIndex++

	r.hashToBit[credentialHash] = bitPos
	r.bitToHash[bitPos] = credentialHash

	// Bit is initially 0 (valid)
	_ = r.bitset.Set(bitPos, false)

	return bitPos, nil
}

// RevokeCredential sets bit to 1 and stores reason code
func (r *Registry) RevokeCredential(
	ctx context.Context,
	credentialHash string,
	reason ReasonCode,
	details string,
	revokedBy *uuid.UUID,
) (*RevocationRecord, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	bitPos, exists := r.hashToBit[credentialHash]
	if !exists {
		// If not explicitly pre-registered, assign next position and revoke
		if r.nextBitIndex >= r.bitset.capacity {
			return nil, fmt.Errorf("revocation list capacity exceeded")
		}
		bitPos = r.nextBitIndex
		r.nextBitIndex++
		r.hashToBit[credentialHash] = bitPos
		r.bitToHash[bitPos] = credentialHash
	}

	if err := r.bitset.Set(bitPos, true); err != nil {
		return nil, fmt.Errorf("failed to set revocation bit: %w", err)
	}

	record := &RevocationRecord{
		ID:             uuid.New(),
		ListID:         r.listID,
		CredentialHash: credentialHash,
		BitPosition:    bitPos,
		Reason:         reason,
		Details:        details,
		RevokedBy:      revokedBy,
		RevokedAt:      time.Now().UTC(),
	}

	r.records[credentialHash] = record
	return record, nil
}

// CheckStatus verifies if a credential has been revoked
func (r *Registry) CheckStatus(credentialHash string) (*StatusCheckResult, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	bitPos, exists := r.hashToBit[credentialHash]
	now := time.Now().UTC()

	if !exists {
		// Not in this list means not revoked
		return &StatusCheckResult{
			CredentialHash: credentialHash,
			IsRevoked:      false,
			BitPosition:    -1,
			CheckedAt:      now,
		}, nil
	}

	isRevoked, err := r.bitset.Get(bitPos)
	if err != nil {
		return nil, err
	}

	result := &StatusCheckResult{
		CredentialHash: credentialHash,
		IsRevoked:      isRevoked,
		BitPosition:    bitPos,
		CheckedAt:      now,
	}

	if isRevoked {
		if rec, ok := r.records[credentialHash]; ok {
			result.Reason = rec.Reason
			result.Details = rec.Details
			result.RevokedAt = &rec.RevokedAt
		}
	}

	return result, nil
}

// ExportStatusListCredential produces a W3C-compliant Status List Credential
func (r *Registry) ExportStatusListCredential() (*BitstringStatusListCredential, error) {
	encoded, err := r.bitset.EncodeCompressed()
	if err != nil {
		return nil, fmt.Errorf("failed to encode bitstring: %w", err)
	}

	now := time.Now().UTC().Format(time.RFC3339)
	credID := fmt.Sprintf("https://identity.edu.gov.mm/status-lists/%s", r.listID.String())

	return &BitstringStatusListCredential{
		Context: []string{
			"https://www.w3.org/ns/credentials/v2",
			"https://w3id.org/vc/status-list",
		},
		ID:        credID,
		Type:      []string{"VerifiableCredential", "BitstringStatusListCredential"},
		Issuer:    r.issuerDID,
		ValidFrom: now,
		CredentialSubject: StatusListSubject{
			ID:            fmt.Sprintf("%s#list", credID),
			Type:          "BitstringStatusList",
			StatusPurpose: "revocation",
			EncodedList:   encoded,
		},
	}, nil
}
