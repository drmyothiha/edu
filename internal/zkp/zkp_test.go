package zkp

import (
	"crypto/ed25519"
	"crypto/rand"
	"testing"
)

func generateTestKeyPair(t *testing.T) (ed25519.PublicKey, ed25519.PrivateKey) {
	pub, priv, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatalf("failed to generate ed25519 keypair: %v", err)
	}
	return pub, priv
}

func getSampleStudentClaims() CredentialClaimsMap {
	return CredentialClaimsMap{
		"student_id":        {Name: "student_id", Value: "e8b2a1c0-1234-4567-89ab-cdef01234567", Salt: GenerateRandomSalt()},
		"full_name":         {Name: "full_name", Value: "Aung Kyaw", Salt: GenerateRandomSalt()},
		"date_of_birth":     {Name: "date_of_birth", Value: "2006-03-15", Salt: GenerateRandomSalt()}, // 20 years old in 2026
		"school_code":       {Name: "school_code", Value: "MMR013001001-BEHS01", Salt: GenerateRandomSalt()},
		"graduation_status": {Name: "graduation_status", Value: "Graduated", Salt: GenerateRandomSalt()},
		"gpa":               {Name: "gpa", Value: "3.85", Salt: GenerateRandomSalt()},
		"academic_year":     {Name: "academic_year", Value: "2026-2027", Salt: GenerateRandomSalt()},
	}
}

func TestSelectiveAttributeDisclosure(t *testing.T) {
	pubKey, privKey := generateTestKeyPair(t)
	claims := getSampleStudentClaims()
	verifier := NewVerifier()

	// Student only discloses school_code and graduation_status
	discloseKeys := []string{"school_code", "graduation_status"}

	proof, err := CreateSelectiveDisclosureProof(
		claims,
		discloseKeys,
		"did:edu:school:MMR013001001-BEHS01",
		"2026-09-28T00:00:00Z",
		privKey,
	)
	if err != nil {
		t.Fatalf("failed to create selective disclosure proof: %v", err)
	}

	if len(proof.DisclosedClaims) != 2 {
		t.Errorf("expected 2 disclosed claims, got %d", len(proof.DisclosedClaims))
	}
	if len(proof.BlindedClaims) != 5 {
		t.Errorf("expected 5 blinded claims, got %d", len(proof.BlindedClaims))
	}

	// Verify proof
	res := verifier.VerifySelectiveDisclosure(proof, pubKey)
	if !res.IsValid {
		t.Fatalf("verification failed: %s", res.Summary)
	}
	if res.VerifiedClaims["school_code"] != "MMR013001001-BEHS01" {
		t.Errorf("expected school_code verified")
	}
	if res.VerifiedClaims["full_name"] != "" {
		t.Errorf("full_name should NOT be in verified claims (it was blinded!)")
	}

	// Tamper test: alter a disclosed claim
	proof.DisclosedClaims[0].Value = "HACKED_SCHOOL"
	tamperedRes := verifier.VerifySelectiveDisclosure(proof, pubKey)
	if tamperedRes.IsValid {
		t.Errorf("expected tampered proof to fail verification")
	}
}

func TestProveAgeAtLeast18(t *testing.T) {
	pubKey, privKey := generateTestKeyPair(t)
	claims := getSampleStudentClaims()
	verifier := NewVerifier()

	// Prove Age >= 18 (DOB is 2006-03-15, current year is 2026 -> 20 years old)
	proof, err := ProveAgeAtLeast(claims, 18, "did:edu:school:MMR013001001-BEHS01", privKey)
	if err != nil {
		t.Fatalf("failed to generate age proof: %v", err)
	}

	res := verifier.VerifyZKPredicate(proof, pubKey)
	if !res.IsValid {
		t.Fatalf("age proof verification failed: %s", res.Summary)
	}
	if !res.PredicateSatisfied {
		t.Errorf("expected predicate satisfied")
	}

	// Underage failure test: Try to prove Age >= 25 (student is ~20)
	_, errUnderage := ProveAgeAtLeast(claims, 25, "did:edu:school:MMR013001001-BEHS01", privKey)
	if errUnderage == nil {
		t.Errorf("expected underage proof generation to fail for age >= 25")
	}
}

func TestProveGraduationAndGPA(t *testing.T) {
	pubKey, privKey := generateTestKeyPair(t)
	claims := getSampleStudentClaims()
	verifier := NewVerifier()

	// 1. Prove Graduation
	gradProof, err := ProveGraduationStatus(claims, "did:edu:school:MMR013001001-BEHS01", privKey)
	if err != nil {
		t.Fatalf("failed to generate graduation proof: %v", err)
	}

	resGrad := verifier.VerifyZKPredicate(gradProof, pubKey)
	if !resGrad.IsValid {
		t.Fatalf("graduation verification failed: %s", resGrad.Summary)
	}

	// 2. Prove GPA >= 3.5 (Actual is 3.85)
	gpaProof, err := ProveMinimumGPA(claims, 3.5, "did:edu:school:MMR013001001-BEHS01", privKey)
	if err != nil {
		t.Fatalf("failed to generate gpa proof: %v", err)
	}

	resGPA := verifier.VerifyZKPredicate(gpaProof, pubKey)
	if !resGPA.IsValid {
		t.Fatalf("GPA verification failed: %s", resGPA.Summary)
	}

	// High GPA failure: Prove GPA >= 3.9 (Actual is 3.85)
	_, errHighGPA := ProveMinimumGPA(claims, 3.9, "did:edu:school:MMR013001001-BEHS01", privKey)
	if errHighGPA == nil {
		t.Errorf("expected proof generation to fail when gpa < 3.9")
	}
}
