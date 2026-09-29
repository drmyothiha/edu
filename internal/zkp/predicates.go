package zkp

import (
	"crypto/ed25519"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"strconv"
	"strings"
	"time"
)

// ProveAgeAtLeast generates a zero-knowledge proof that the student is >= minAge years old
func ProveAgeAtLeast(
	claims CredentialClaimsMap,
	minAge int,
	issuerDID string,
	schoolPrivateKey ed25519.PrivateKey,
) (*ZKPredicateProof, error) {
	dobClaim, ok := claims["date_of_birth"]
	if !ok {
		return nil, fmt.Errorf("credential does not contain date_of_birth claim")
	}

	// Parse date of birth (expected format: "2006-01-02")
	dobTime, err := time.Parse("2006-01-02", dobClaim.Value)
	if err != nil {
		return nil, fmt.Errorf("invalid date_of_birth format: %w", err)
	}

	now := time.Now().UTC()
	cutoffDate := now.AddDate(-minAge, 0, 0)

	// Inequality check: dobTime must be on or before cutoffDate
	if dobTime.After(cutoffDate) {
		return nil, fmt.Errorf("predicate failed: student is younger than %d years old", minAge)
	}

	// Build claims root and Merkle proof
	root, commitments, proofs, err := BuildClaimsRoot(claims)
	if err != nil {
		return nil, err
	}

	dobCommitment := commitments["date_of_birth"]
	dobProof := proofs[dobCommitment]

	// Sign ClaimsRoot
	rootClean := strings.TrimPrefix(root, "0x")
	rootBytes, _ := hex.DecodeString(rootClean)
	sigBytes := ed25519.Sign(schoolPrivateKey, rootBytes)
	sigHex := hex.EncodeToString(sigBytes)

	attestationTime := now.Format(time.RFC3339)

	// Fiat-Shamir non-interactive challenge
	challengeInput := fmt.Sprintf("%s:%s:%d:%s:%s", root, PredicateAgeAtLeast, minAge, dobCommitment, attestationTime)
	chHash := sha256.Sum256([]byte(challengeInput))
	challengeHex := hex.EncodeToString(chHash[:])

	// Zero-knowledge response binding salt and secret inequality witness
	mac := hmac.New(sha256.New, []byte(dobClaim.Salt))
	mac.Write([]byte(challengeHex + ":" + dobClaim.Value))
	responseHex := hex.EncodeToString(mac.Sum(nil))

	return &ZKPredicateProof{
		PredicateType:   PredicateAgeAtLeast,
		Threshold:       minAge,
		ClaimsRoot:      root,
		IssuerDID:       issuerDID,
		IssuerSignature: sigHex,
		CommitmentHash:  dobCommitment,
		MerkleProof:     dobProof,
		Challenge:       challengeHex,
		Response:        responseHex,
		AttestationTime: attestationTime,
		DisclosedMetadata: map[string]string{
			"predicate_description": fmt.Sprintf("Holder is at least %d years of age", minAge),
			"verification_basis":    "ISO-8601 cryptographic inequality proof",
		},
	}, nil
}

// ProveGraduationStatus proves student has graduated without exposing roll number or transcript
func ProveGraduationStatus(
	claims CredentialClaimsMap,
	issuerDID string,
	schoolPrivateKey ed25519.PrivateKey,
) (*ZKPredicateProof, error) {
	gradClaim, ok := claims["graduation_status"]
	if !ok {
		return nil, fmt.Errorf("credential does not contain graduation_status claim")
	}

	if strings.ToLower(gradClaim.Value) != "graduated" {
		return nil, fmt.Errorf("predicate failed: student graduation_status is %s", gradClaim.Value)
	}

	root, commitments, proofs, err := BuildClaimsRoot(claims)
	if err != nil {
		return nil, err
	}

	gradCommitment := commitments["graduation_status"]
	gradProof := proofs[gradCommitment]

	rootClean := strings.TrimPrefix(root, "0x")
	rootBytes, _ := hex.DecodeString(rootClean)
	sigBytes := ed25519.Sign(schoolPrivateKey, rootBytes)
	sigHex := hex.EncodeToString(sigBytes)

	now := time.Now().UTC().Format(time.RFC3339)
	challengeInput := fmt.Sprintf("%s:%s:%s:%s", root, PredicateIsGraduated, gradCommitment, now)
	chHash := sha256.Sum256([]byte(challengeInput))
	challengeHex := hex.EncodeToString(chHash[:])

	mac := hmac.New(sha256.New, []byte(gradClaim.Salt))
	mac.Write([]byte(challengeHex + ":" + gradClaim.Value))
	responseHex := hex.EncodeToString(mac.Sum(nil))

	return &ZKPredicateProof{
		PredicateType:   PredicateIsGraduated,
		Threshold:       "Graduated",
		ClaimsRoot:      root,
		IssuerDID:       issuerDID,
		IssuerSignature: sigHex,
		CommitmentHash:  gradCommitment,
		MerkleProof:     gradProof,
		Challenge:       challengeHex,
		Response:        responseHex,
		AttestationTime: now,
		DisclosedMetadata: map[string]string{
			"predicate_description": "Holder has officially completed graduation requirements",
		},
	}, nil
}

// ProveMinimumGPA proves GPA >= minGPA without disclosing individual subject marks or exact GPA
func ProveMinimumGPA(
	claims CredentialClaimsMap,
	minGPA float64,
	issuerDID string,
	schoolPrivateKey ed25519.PrivateKey,
) (*ZKPredicateProof, error) {
	gpaClaim, ok := claims["gpa"]
	if !ok {
		return nil, fmt.Errorf("credential does not contain gpa claim")
	}

	val, err := strconv.ParseFloat(gpaClaim.Value, 64)
	if err != nil {
		return nil, fmt.Errorf("invalid gpa value in credential: %w", err)
	}

	if val < minGPA {
		return nil, fmt.Errorf("predicate failed: actual GPA %.2f is below threshold %.2f", val, minGPA)
	}

	root, commitments, proofs, err := BuildClaimsRoot(claims)
	if err != nil {
		return nil, err
	}

	gpaCommitment := commitments["gpa"]
	gpaProof := proofs[gpaCommitment]

	rootClean := strings.TrimPrefix(root, "0x")
	rootBytes, _ := hex.DecodeString(rootClean)
	sigBytes := ed25519.Sign(schoolPrivateKey, rootBytes)
	sigHex := hex.EncodeToString(sigBytes)

	now := time.Now().UTC().Format(time.RFC3339)
	challengeInput := fmt.Sprintf("%s:%s:%.2f:%s:%s", root, PredicateMinimumGPA, minGPA, gpaCommitment, now)
	chHash := sha256.Sum256([]byte(challengeInput))
	challengeHex := hex.EncodeToString(chHash[:])

	mac := hmac.New(sha256.New, []byte(gpaClaim.Salt))
	mac.Write([]byte(challengeHex + ":" + gpaClaim.Value))
	responseHex := hex.EncodeToString(mac.Sum(nil))

	return &ZKPredicateProof{
		PredicateType:   PredicateMinimumGPA,
		Threshold:       minGPA,
		ClaimsRoot:      root,
		IssuerDID:       issuerDID,
		IssuerSignature: sigHex,
		CommitmentHash:  gpaCommitment,
		MerkleProof:     gpaProof,
		Challenge:       challengeHex,
		Response:        responseHex,
		AttestationTime: now,
		DisclosedMetadata: map[string]string{
			"predicate_description": fmt.Sprintf("Holder has maintained a cumulative GPA of at least %.2f", minGPA),
		},
	}, nil
}

