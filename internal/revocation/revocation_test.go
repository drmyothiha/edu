package revocation

import (
	"context"
	"testing"
)

func TestBitSetCompressionRoundTrip(t *testing.T) {
	bs := NewBitSet(1024)

	// Set multiple bits
	_ = bs.Set(5, true)
	_ = bs.Set(42, true)
	_ = bs.Set(100, true)
	_ = bs.Set(1023, true)

	// Encode to compressed string
	encoded, err := bs.EncodeCompressed()
	if err != nil {
		t.Fatalf("failed to encode compressed bitset: %v", err)
	}

	if encoded == "" {
		t.Fatalf("encoded bitstring cannot be empty")
	}

	// Decode back
	decoded, err := DecodeCompressed(encoded, 1024)
	if err != nil {
		t.Fatalf("failed to decode compressed bitset: %v", err)
	}

	// Verify bits in decoded
	val5, _ := decoded.Get(5)
	val42, _ := decoded.Get(42)
	val100, _ := decoded.Get(100)
	val1023, _ := decoded.Get(1023)
	val99, _ := decoded.Get(99) // should be false

	if !val5 || !val42 || !val100 || !val1023 {
		t.Errorf("bits set to true were not recovered after compression")
	}
	if val99 {
		t.Errorf("bit 99 should be false")
	}
}

func TestRevocationRegistryLifecycle(t *testing.T) {
	reg := NewRegistry("did:edu:school:MMR013001001-BEHS01", 1024)
	ctx := context.Background()

	credHash1 := "0x4a9b2c8a1e30d7f5a8b9c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2"
	credHash2 := "0x11223344556677889900aabbccddeeff11223344556677889900aabbccddeeff"

	// 1. Register credentials
	pos1, err := reg.RegisterCredential(credHash1, "did:edu:mm:01:BEHS01-2026-STU0001")
	if err != nil {
		t.Fatalf("failed to register cred1: %v", err)
	}
	pos2, err := reg.RegisterCredential(credHash2, "did:edu:mm:01:BEHS01-2026-STU0002")
	if err != nil {
		t.Fatalf("failed to register cred2: %v", err)
	}

	if pos1 == pos2 {
		t.Errorf("positions must be distinct")
	}

	// 2. Both should initially be NOT revoked
	status1, _ := reg.CheckStatus(credHash1)
	if status1.IsRevoked {
		t.Errorf("cred1 should not be revoked initially")
	}

	status2, _ := reg.CheckStatus(credHash2)
	if status2.IsRevoked {
		t.Errorf("cred2 should not be revoked initially")
	}

	// 3. Revoke cred1 with AcademicMisconduct
	rec, err := reg.RevokeCredential(ctx, credHash1, ReasonAcademicMisconduct, "Forged mid-term transcript", nil)
	if err != nil {
		t.Fatalf("failed to revoke cred1: %v", err)
	}

	if rec.Reason != ReasonAcademicMisconduct {
		t.Errorf("expected ReasonAcademicMisconduct, got %s", rec.Reason)
	}

	// 4. Verify cred1 is now revoked and cred2 remains valid
	status1After, _ := reg.CheckStatus(credHash1)
	if !status1After.IsRevoked {
		t.Errorf("cred1 should now be revoked")
	}
	if status1After.Reason != ReasonAcademicMisconduct {
		t.Errorf("expected reason to be reported, got %s", status1After.Reason)
	}

	status2After, _ := reg.CheckStatus(credHash2)
	if status2After.IsRevoked {
		t.Errorf("cred2 should still be valid")
	}

	// 5. Export W3C Status List Credential
	slCred, err := reg.ExportStatusListCredential()
	if err != nil {
		t.Fatalf("failed to export status list cred: %v", err)
	}

	if slCred.CredentialSubject.Type != "BitstringStatusList" {
		t.Errorf("expected BitstringStatusList type, got %s", slCred.CredentialSubject.Type)
	}
	if slCred.CredentialSubject.EncodedList == "" {
		t.Errorf("expected non-empty encoded bitstring")
	}
}
