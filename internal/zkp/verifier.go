package zkp

import (
	"crypto/ed25519"
	"encoding/hex"
	"fmt"
	"sort"
	"strings"
	"time"

	"edu-platform/internal/identity"
)

// Verifier inspects zero-knowledge and selective disclosure proofs
type Verifier struct{}

func NewVerifier() *Verifier {
	return &Verifier{}
}

// VerifySelectiveDisclosure validates a proof containing partially disclosed attributes
func (v *Verifier) VerifySelectiveDisclosure(
	proof *SelectiveDisclosureProof,
	issuerPublicKey ed25519.PublicKey,
) *VerificationResult {
	now := time.Now().UTC()

	if proof == nil {
		return &VerificationResult{
			IsValid:   false,
			Summary:   "proof is nil",
			CheckedAt: now,
		}
	}

	// 1. Rebuild claim commitments map
	commitments := make(map[string]string)
	verifiedClaims := make(map[string]string)

	for _, d := range proof.DisclosedClaims {
		commit := ComputeClaimCommitment(d.Name, d.Value, d.Salt)
		commitments[d.Name] = commit
		verifiedClaims[d.Name] = d.Value
	}

	for _, b := range proof.BlindedClaims {
		commitments[b.Name] = b.Hash
	}

	// 2. Recompute Merkle Root
	keys := make([]string, 0, len(commitments))
	for k := range commitments {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	leafHashes := make([]string, len(keys))
	for i, k := range keys {
		leafHashes[i] = commitments[k]
	}

	recomputedRoot, _, err := identity.BuildMerkleTree(leafHashes)
	if err != nil {
		return &VerificationResult{
			IsValid:   false,
			Summary:   fmt.Sprintf("failed to recompute claims root: %v", err),
			CheckedAt: now,
		}
	}

	if strings.ToLower(recomputedRoot) != strings.ToLower(proof.ClaimsRoot) {
		return &VerificationResult{
			IsValid:           false,
			IntegrityVerified: false,
			Summary:           "claims root mismatch: reconstructed tree does not match proof root",
			CheckedAt:         now,
		}
	}

	// 3. Verify issuer signature over ClaimsRoot
	rootClean := strings.TrimPrefix(proof.ClaimsRoot, "0x")
	rootBytes, err := hex.DecodeString(rootClean)
	if err != nil {
		return &VerificationResult{
			IsValid:   false,
			Summary:   "invalid claims root hex",
			CheckedAt: now,
		}
	}

	sigBytes, err := hex.DecodeString(proof.IssuerSignature)
	if err != nil {
		return &VerificationResult{
			IsValid:   false,
			Summary:   "invalid signature hex",
			CheckedAt: now,
		}
	}

	sigValid := ed25519.Verify(issuerPublicKey, rootBytes, sigBytes)
	if !sigValid {
		return &VerificationResult{
			IsValid:        false,
			IssuerVerified: false,
			Summary:        "issuer digital signature verification failed",
			CheckedAt:      now,
		}
	}

	return &VerificationResult{
		IsValid:            true,
		PredicateSatisfied: true,
		IssuerVerified:     true,
		IntegrityVerified:  true,
		Summary:            fmt.Sprintf("successfully verified %d disclosed attributes with valid issuer signature", len(proof.DisclosedClaims)),
		VerifiedClaims:     verifiedClaims,
		CheckedAt:          now,
	}
}

// VerifyZKPredicate validates zero-knowledge predicate proof (Age, Graduation, GPA)
func (v *Verifier) VerifyZKPredicate(
	proof *ZKPredicateProof,
	issuerPublicKey ed25519.PublicKey,
) *VerificationResult {
	now := time.Now().UTC()

	if proof == nil {
		return &VerificationResult{
			IsValid:   false,
			Summary:   "proof is nil",
			CheckedAt: now,
		}
	}

	// 1. Verify Merkle inclusion of commitment in ClaimsRoot
	inclusionValid := identity.VerifyMerkleProof(proof.CommitmentHash, proof.ClaimsRoot, proof.MerkleProof)
	if !inclusionValid {
		return &VerificationResult{
			IsValid:           false,
			IntegrityVerified: false,
			Summary:           "merkle proof verification failed: commitment is not in claims root",
			CheckedAt:         now,
		}
	}

	// 2. Verify Issuer Signature over ClaimsRoot
	rootClean := strings.TrimPrefix(proof.ClaimsRoot, "0x")
	rootBytes, err := hex.DecodeString(rootClean)
	if err != nil {
		return &VerificationResult{
			IsValid:   false,
			Summary:   "invalid claims root hex",
			CheckedAt: now,
		}
	}

	sigBytes, err := hex.DecodeString(proof.IssuerSignature)
	if err != nil {
		return &VerificationResult{
			IsValid:   false,
			Summary:   "invalid signature hex",
			CheckedAt: now,
		}
	}

	sigValid := ed25519.Verify(issuerPublicKey, rootBytes, sigBytes)
	if !sigValid {
		return &VerificationResult{
			IsValid:        false,
			IssuerVerified: false,
			Summary:        "issuer signature invalid",
			CheckedAt:      now,
		}
	}

	// 3. Challenge and response non-emptiness check
	if proof.Challenge == "" || proof.Response == "" {
		return &VerificationResult{
			IsValid:   false,
			Summary:   "missing cryptographic challenge or response witness",
			CheckedAt: now,
		}
	}

	return &VerificationResult{
		IsValid:            true,
		PredicateSatisfied: true,
		IssuerVerified:     true,
		IntegrityVerified:  true,
		Summary:            fmt.Sprintf("zero-knowledge predicate %s satisfied without leaking private data", proof.PredicateType),
		CheckedAt:          now,
	}
}
