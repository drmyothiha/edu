package zkp

import (
	"time"

	"edu-platform/internal/identity"
)

// PredicateType defines the supported zero-knowledge predicates
type PredicateType string

const (
	PredicateAgeAtLeast    PredicateType = "AgeAtLeast"    // Proves age >= threshold (e.g. 18)
	PredicateIsGraduated   PredicateType = "IsGraduated"   // Proves graduated == true
	PredicateMinimumGPA    PredicateType = "MinimumGPA"    // Proves gpa >= threshold (e.g. 3.0)
	PredicateSchoolStudent PredicateType = "SchoolStudent" // Proves enrollment at specified school code
)

// ClaimValue holds an attribute name, plaintext value, and private blinding salt
type ClaimValue struct {
	Name  string `json:"name"`
	Value string `json:"value"`
	Salt  string `json:"salt"` // 32-byte cryptographic hex salt
}

// DisclosedClaim is what is presented to the verifier for revealed fields
type DisclosedClaim struct {
	Name  string `json:"name"`
	Value string `json:"value"`
	Salt  string `json:"salt"`
}

// BlindedClaim represents a field kept completely secret (only its commitment hash is shown)
type BlindedClaim struct {
	Name string `json:"name"`
	Hash string `json:"hash"` // 0xsha256(name:value:salt)
}

// SelectiveDisclosureProof allows verifying authenticity of partially disclosed claims
type SelectiveDisclosureProof struct {
	IssuerDID       string           `json:"issuer_did"`
	ClaimsRoot      string           `json:"claims_root"` // Merkle root of all claims
	DisclosedClaims []DisclosedClaim `json:"disclosed_claims"`
	BlindedClaims   []BlindedClaim   `json:"blinded_claims"`
	IssuerSignature string           `json:"issuer_signature"` // Ed25519 signature over ClaimsRoot
	IssuedAt        string           `json:"issued_at"`
}

// ZKPredicateProof contains zero-knowledge predicate demonstration
type ZKPredicateProof struct {
	PredicateType      PredicateType          `json:"predicate_type"`
	Threshold          interface{}            `json:"threshold"`            // e.g. 18 (int) or 3.5 (float)
	ClaimsRoot         string                 `json:"claims_root"`
	IssuerDID          string                 `json:"issuer_did"`
	IssuerSignature    string                 `json:"issuer_signature"`
	CommitmentHash     string                 `json:"commitment_hash"`     // commitment to the private attribute
	MerkleProof        []identity.MerkleProof `json:"merkle_proof"`        // proof that commitment is in ClaimsRoot
	Challenge          string                 `json:"challenge"`           // cryptographic challenge
	Response           string                 `json:"response"`            // zero-knowledge proof response
	AttestationTime    string                 `json:"attestation_time"`
	DisclosedMetadata  map[string]string      `json:"disclosed_metadata"`  // optional non-sensitive context
}

// VerificationResult contains the verifier's judgment
type VerificationResult struct {
	IsValid            bool              `json:"is_valid"`
	PredicateSatisfied bool              `json:"predicate_satisfied"`
	IssuerVerified     bool              `json:"issuer_verified"`
	IntegrityVerified  bool              `json:"integrity_verified"`
	Summary            string            `json:"summary"`
	VerifiedClaims     map[string]string `json:"verified_claims,omitempty"`
	CheckedAt          time.Time         `json:"checked_at"`
}
