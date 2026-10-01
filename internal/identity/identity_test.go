package identity

import (
	"crypto/ed25519"
	"testing"

	"github.com/google/uuid"
)

func TestKeyPairGeneration(t *testing.T) {
	kp, err := GenerateKeyPair()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(kp.PublicKeyHex) != 64 {
		t.Errorf("expected 64 char public key hex, got %d", len(kp.PublicKeyHex))
	}
	if len(kp.PrivateKeyHex) != 128 {
		t.Errorf("expected 128 char private key hex, got %d", len(kp.PrivateKeyHex))
	}
	if len(kp.EthAddress) != 42 {
		t.Errorf("expected 42 char eth address, got %d (%s)", len(kp.EthAddress), kp.EthAddress)
	}
}

func TestIssueAndVerifyVerifiableCredential(t *testing.T) {
	// Generate mock school authority key
	schoolPub, schoolPriv, err := ed25519.GenerateKey(nil)
	if err != nil {
		t.Fatalf("failed to generate school key: %v", err)
	}

	studentID := uuid.New()
	studentKP, _ := GenerateKeyPair()
	did := FormatStudentDID("MMR013", "MMR013001001-BEHS01", "2026", 1)

	vc, hashHex, err := IssueStudentCredential(
		studentID,
		did,
		"STU-001",
		"MMR013001001-BEHS01",
		"BEHS 1 Dagon",
		"Yangon Region",
		"Dagon",
		"2026",
		studentKP.PublicKeyHex,
		schoolPriv,
	)
	if err != nil {
		t.Fatalf("failed to issue credential: %v", err)
	}

	if hashHex == "" || len(hashHex) != 66 {
		t.Errorf("expected valid 66-char 0x sha256 hash, got %s", hashHex)
	}

	valid, err := VerifyCredentialSignature(vc, schoolPub)
	if err != nil {
		t.Fatalf("signature verification returned error: %v", err)
	}
	if !valid {
		t.Errorf("expected signature to be valid")
	}

	// Tamper test
	vc.CredentialSubject.SchoolName = "Fake International School"
	validTampered, _ := VerifyCredentialSignature(vc, schoolPub)
	if validTampered {
		t.Errorf("expected tampered credential to fail verification")
	}
}

func TestMerkleTreeBatchAndProof(t *testing.T) {
	leaves := []string{
		"0x1111111111111111111111111111111111111111111111111111111111111111",
		"0x2222222222222222222222222222222222222222222222222222222222222222",
		"0x3333333333333333333333333333333333333333333333333333333333333333",
		"0x4444444444444444444444444444444444444444444444444444444444444444",
		"0x5555555555555555555555555555555555555555555555555555555555555555",
	}

	root, proofs, err := BuildMerkleTree(leaves)
	if err != nil {
		t.Fatalf("unexpected error building Merkle tree: %v", err)
	}

	if root == "" || len(root) != 66 {
		t.Errorf("expected 66 char hex root, got %s", root)
	}

	for _, leaf := range leaves {
		proof := proofs[leaf]
		if len(proof) == 0 {
			t.Errorf("expected proof for leaf %s", leaf)
		}
		if !VerifyMerkleProof(leaf, root, proof) {
			t.Errorf("Merkle proof verification failed for leaf %s", leaf)
		}
	}

	// Verify fake leaf fails
	fakeLeaf := "0x9999999999999999999999999999999999999999999999999999999999999999"
	if VerifyMerkleProof(fakeLeaf, root, proofs[leaves[0]]) {
		t.Errorf("fake leaf should fail Merkle verification")
	}
}

func TestHashPairNonStandardLength(t *testing.T) {
	left := "0x1234"
	right := "0x567890"
	got := HashPair(left, right)
	expected := "0x6c450e037e79b76f231a71a22ff40403f7d9b74b15e014e52fe1156d3666c3e6"
	if got != expected {
		t.Errorf("expected %s, got %s", expected, got)
	}
}

func TestCredentialSchemaAndStatus(t *testing.T) {
	_, schoolPriv, err := ed25519.GenerateKey(nil)
	if err != nil {
		t.Fatalf("failed to generate key: %v", err)
	}

	studentID := uuid.New()
	vc, _, err := IssueStudentCredential(
		studentID,
		"did:edu:mm:013:MMR013001001-PV01-2026-STU5779",
		"ROLL-5779",
		"MMR013001001-PV01",
		"Yangon Academy High School",
		"Yangon Region",
		"Dagon",
		"2026-2027",
		"",
		schoolPriv,
	)
	if err != nil {
		t.Fatalf("failed to issue: %v", err)
	}

	if vc.CredentialSchema == nil || vc.CredentialSchema.Type != "JsonSchema" {
		t.Errorf("expected JsonSchema credentialSchema, got %+v", vc.CredentialSchema)
	}

	vc.AttachCredentialStatus("https://registry.edu.gov.mm/status/1", 42)
	if vc.CredentialStatus == nil {
		t.Fatalf("expected non-nil credentialStatus")
	}
	if vc.CredentialStatus.StatusListIndex != "42" {
		t.Errorf("expected index 42, got %s", vc.CredentialStatus.StatusListIndex)
	}
	if vc.CredentialStatus.Type != "BitstringStatusListEntry" {
		t.Errorf("expected BitstringStatusListEntry, got %s", vc.CredentialStatus.Type)
	}
}

