package main

import (
	"context"
	"crypto/ed25519"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"time"

	"edu-platform/internal/database"
	"edu-platform/internal/identity"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

func main() {
	ctx := context.Background()
	dbURL := "postgres://postgres:postgres@localhost:5432/edu_db?sslmode=disable"
	pool, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		log.Fatalf("Failed to connect to db: %v", err)
	}
	defer pool.Close()

	studentID, _ := uuid.Parse("a7693ce7-d65f-40a6-b8ab-ddcb75ed8435")
	schoolID, _ := uuid.Parse("0ac3f6b3-ce6d-4d15-bb4c-9b868f41aeb4")
	schoolCode := "MMR013035-BEHS01"
	schoolName := "အခြေခံပညာအထက်တန်းကျောင်း အင်းတိုင်"
	diplomaDID := "did:edu:mm:diploma:MMR013035-2026-DIP0088"

	// Derive school private key
	seed := sha256.Sum256([]byte("edu-school-authority-signing-key:" + schoolCode))
	schoolPriv := ed25519.NewKeyFromSeed(seed[:])

	subject := identity.StudentIdentitySubject{
		ID:                diplomaDID,
		StudentID:         studentID.String(),
		StudentRollNumber: "DIP-KG-GRAD-2026",
		SchoolCode:        schoolCode,
		SchoolName:        schoolName,
		Region:            "Yangon Region",
		Township:          "Hlegu",
		AcademicYear:      "2026-2027",
	}

	hashHex, hashBytes, err := identity.ComputeCredentialHash(subject)
	if err != nil {
		log.Fatalf("Failed to hash subject: %v", err)
	}

	sigBytes := ed25519.Sign(schoolPriv, hashBytes)
	sigHex := hex.EncodeToString(sigBytes)

	vc := identity.VerifiableCredential{
		Context: []string{
			"https://www.w3.org/ns/credentials/v2",
			"https://schema.edu.gov.mm/credentials/diploma/v1",
		},
		ID:         fmt.Sprintf("urn:uuid:%s", uuid.New().String()),
		Type:       []string{"VerifiableCredential", "HighSchoolDiploma"},
		Issuer:     fmt.Sprintf("did:web:moe.gov.mm:schools:%s", schoolCode),
		ValidFrom:  time.Now().UTC().Format(time.RFC3339),
		CredentialSubject: subject,
		Proof: identity.CredentialProof{
			Type:               "DataIntegrityProof",
			CryptoSuite:        "eddsa-jcs-2022",
			Created:            time.Now().UTC().Format(time.RFC3339),
			VerificationMethod: fmt.Sprintf("did:web:moe.gov.mm:schools:%s#key-1", schoolCode),
			ProofPurpose:       "assertionMethod",
			ProofValue:         sigHex,
		},
	}

	rawJSON, err := json.Marshal(vc)
	if err != nil {
		log.Fatalf("Failed to marshal raw VC: %v", err)
	}

	queries := database.New(pool)
	// Upsert diploma
	_, err = pool.Exec(ctx, `
		INSERT INTO verifiable_credentials (
			id, student_id, issuer_school_id, did, credential_type, credential_hash,
			merkle_root, merkle_proof, polygon_tx_hash, polygon_block_number,
			raw_credential_json, signature, is_revoked, revocation_reason, issued_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
		) ON CONFLICT (credential_hash) DO UPDATE SET
			merkle_root = EXCLUDED.merkle_root,
			polygon_tx_hash = EXCLUDED.polygon_tx_hash,
			credential_type = EXCLUDED.credential_type
	`,
		uuid.New(),
		studentID,
		pgtype.UUID{Bytes: schoolID, Valid: true},
		diplomaDID,
		"HighSchoolDiploma",
		hashHex,
		pgtype.Text{String: hashHex, Valid: true}, // Single-leaf batch root is leaf hash
		[]byte("[]"),
		pgtype.Text{String: "0xa92f87c10b4279e8a719d363b7e774fcfb297a7c06ebba4392cf99a84e27f015", Valid: true},
		pgtype.Int8{Int64: 14892301, Valid: true},
		rawJSON,
		sigHex,
		false,
		pgtype.Text{String: "", Valid: true},
		time.Now().UTC(),
	)
	if err != nil {
		log.Fatalf("Failed to insert diploma credential: %v", err)
	}

	_ = queries
	fmt.Printf("Successfully seeded HighSchoolDiploma:\nDID: %s\nHash: %s\n", diplomaDID, hashHex)
}
