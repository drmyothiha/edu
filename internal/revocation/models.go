package revocation

import (
	"time"

	"github.com/google/uuid"
)

// ReasonCode defines why a credential was revoked or suspended
type ReasonCode string

const (
	ReasonAcademicMisconduct ReasonCode = "AcademicMisconduct"
	ReasonErroneousIssuance  ReasonCode = "ErroneousIssuance"
	ReasonStudentTransferred ReasonCode = "StudentTransferred"
	ReasonSuperseded         ReasonCode = "Superseded"
	ReasonSuspension         ReasonCode = "Suspension"
)

// RevocationRecord stores metadata about an individual revocation action
type RevocationRecord struct {
	ID             uuid.UUID  `json:"id"`
	ListID         uuid.UUID  `json:"list_id"`
	CredentialHash string     `json:"credential_hash"`
	StudentDID     string     `json:"student_did"`
	BitPosition    int        `json:"bit_position"`
	Reason         ReasonCode `json:"reason"`
	Details        string     `json:"details"`
	RevokedBy      *uuid.UUID `json:"revoked_by,omitempty"`
	RevokedAt      time.Time  `json:"revoked_at"`
	OnChainTxHash  string     `json:"onchain_tx_hash,omitempty"`
}

// BitstringStatusListCredential represents a W3C-compliant Status List Credential
// Spec: https://www.w3.org/TR/vc-bitstring-status-list/
type BitstringStatusListCredential struct {
	Context           []string             `json:"@context"`
	ID                string               `json:"id"`
	Type              []string             `json:"type"`
	Issuer            string               `json:"issuer"`
	ValidFrom         string               `json:"validFrom"`
	CredentialSubject StatusListSubject    `json:"credentialSubject"`
}

type StatusListSubject struct {
	ID            string `json:"id"`
	Type          string `json:"type"`          // "BitstringStatusList"
	StatusPurpose string `json:"statusPurpose"` // "revocation" or "suspension"
	EncodedList   string `json:"encodedList"`   // gzip + base64url encoded bitstring
}

// StatusCheckResult returns status evaluation
type StatusCheckResult struct {
	CredentialHash   string     `json:"credential_hash"`
	IsRevoked        bool       `json:"is_revoked"`
	BitPosition      int        `json:"bit_position"`
	Reason           ReasonCode `json:"reason,omitempty"`
	Details          string     `json:"details,omitempty"`
	RevokedAt        *time.Time `json:"revoked_at,omitempty"`
	CheckedAt        time.Time  `json:"checked_at"`
}
