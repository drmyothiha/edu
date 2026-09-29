package zkp

import (
	"crypto/ed25519"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"sort"
	"strings"

	"edu-platform/internal/identity"
)

// GenerateRandomSalt produces a 32-byte hex salt
func GenerateRandomSalt() string {
	b := make([]byte, 32)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

// ComputeClaimCommitment calculates SHA-256("name:value:salt")
func ComputeClaimCommitment(name, value, salt string) string {
	raw := fmt.Sprintf("%s:%s:%s", name, value, salt)
	h := sha256.Sum256([]byte(raw))
	return "0x" + hex.EncodeToString(h[:])
}

// CredentialClaimsMap represents all attributes in a student's credential
type CredentialClaimsMap map[string]ClaimValue

// BuildClaimsRoot calculates the Merkle Root across all claim commitments
func BuildClaimsRoot(claims CredentialClaimsMap) (string, map[string]string, map[string][]identity.MerkleProof, error) {
	if len(claims) == 0 {
		return "", nil, nil, fmt.Errorf("claims cannot be empty")
	}

	keys := make([]string, 0, len(claims))
	for k := range claims {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	leafHashes := make([]string, len(keys))
	commitments := make(map[string]string)

	for i, k := range keys {
		cv := claims[k]
		commit := ComputeClaimCommitment(cv.Name, cv.Value, cv.Salt)
		commitments[k] = commit
		leafHashes[i] = commit
	}

	root, proofs, err := identity.BuildMerkleTree(leafHashes)
	if err != nil {
		return "", nil, nil, fmt.Errorf("failed to build claims merkle tree: %w", err)
	}

	return root, commitments, proofs, nil
}

// CreateSelectiveDisclosureProof creates a proof revealing only `discloseKeys`
func CreateSelectiveDisclosureProof(
	claims CredentialClaimsMap,
	discloseKeys []string,
	issuerDID string,
	issuedAt string,
	schoolPrivateKey ed25519.PrivateKey,
) (*SelectiveDisclosureProof, error) {
	root, commitments, _, err := BuildClaimsRoot(claims)
	if err != nil {
		return nil, err
	}

	// Sign the ClaimsRoot with school private key
	rootClean := strings.TrimPrefix(root, "0x")
	rootBytes, err := hex.DecodeString(rootClean)
	if err != nil {
		return nil, fmt.Errorf("invalid root bytes: %w", err)
	}

	sigBytes := ed25519.Sign(schoolPrivateKey, rootBytes)
	sigHex := hex.EncodeToString(sigBytes)

	discloseSet := make(map[string]bool)
	for _, k := range discloseKeys {
		discloseSet[k] = true
	}

	var disclosed []DisclosedClaim
	var blinded []BlindedClaim

	keys := make([]string, 0, len(claims))
	for k := range claims {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	for _, k := range keys {
		cv := claims[k]
		if discloseSet[k] {
			disclosed = append(disclosed, DisclosedClaim{
				Name:  cv.Name,
				Value: cv.Value,
				Salt:  cv.Salt,
			})
		} else {
			blinded = append(blinded, BlindedClaim{
				Name: cv.Name,
				Hash: commitments[k],
			})
		}
	}

	return &SelectiveDisclosureProof{
		IssuerDID:       issuerDID,
		ClaimsRoot:      root,
		DisclosedClaims: disclosed,
		BlindedClaims:   blinded,
		IssuerSignature: sigHex,
		IssuedAt:        issuedAt,
	}, nil
}
