// Command seed_demo_kiosk upserts the 4 demo students shipped as offline
// defaults inside the Gate Kiosk PWA (edu/web/src/services/offlineGateStorage.ts).
// Their DIDs match the kiosk defaults exactly so offline NFC tap events
// (student-demo-001..004) resolve against verifiable_credentials and can be
// synced via POST /api/v1/gate/sync-batch.
//
// Idempotent: users are keyed by email, credentials are keyed by DID.
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

	"edu-platform/internal/auth"
	"edu-platform/internal/config"
	"edu-platform/internal/database"
	"edu-platform/internal/identity"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

type demoStudent struct {
	Email    string
	FullName string
	RollNo   string
	DIDSeq   int
}

func main() {
	cfg := config.Load()
	ctx := context.Background()

	pool, err := database.NewPool(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer pool.Close()

	queries := database.New(pool)

	// 1. Locate the school and the Grade 5-A class the kiosk demo students belong to.
	intaingSchool, err := queries.GetSchoolByCode(ctx, "MMR013035-BEHS01")
	if err != nil {
		log.Fatalf("School MMR013035-BEHS01 not found: %v", err)
	}
	log.Printf("School ready: %s [%s]", intaingSchool.Name, intaingSchool.Code)

	classes, err := queries.ListClassesBySchool(ctx, intaingSchool.ID)
	if err != nil {
		log.Fatalf("Failed to list classes: %v", err)
	}
	var g5Class database.Class
	for _, c := range classes {
		if c.GradeLevel == "Grade 5" && (c.Name == "Grade 5-A (Primary)" || c.Name == "Grade 5-A") {
			g5Class = c
			break
		}
	}
	if g5Class.ID == uuid.Nil {
		log.Fatalf("Grade 5-A class not found at %s; run seed_intaing first", intaingSchool.Code)
	}
	log.Printf("Grade 5-A class ready: %s [ID: %v]", g5Class.Name, g5Class.ID)

	passHash, err := auth.HashPassword("mth")
	if err != nil {
		log.Fatalf("Failed to hash password: %v", err)
	}

	// Optional parent linkage: reuse parent 0922222 if present.
	var parentID pgtype.UUID
	if parent, pErr := queries.GetUserByEmail(ctx, "0922222"); pErr == nil {
		parentID = pgtype.UUID{Bytes: [16]byte(parent.ID), Valid: true}
		log.Println("Parent 0922222 found; demo students will be linked to this parent.")
	} else {
		log.Println("Parent 0922222 not found; demo students will be parentless.")
	}

	// 2. Upsert each demo student with an exact DID matching the kiosk defaults.
	demoStudents := []demoStudent{
		{"aungkyaw.g5@intaing.edu.local", "Maung Aung Kyaw", "၅-က-၁၂", 42},
		{"thidawin.g5@intaing.edu.local", "Ma Thida Win", "၅-က-၀၃", 43},
		{"zawlin.g5@intaing.edu.local", "Maung Zaw Lin", "၅-က-၁၈", 44},
		{"khinswewin.g5@intaing.edu.local", "Ma Khin Swe Win", "၅-က-၀၇", 45},
	}

	year := fmt.Sprintf("%d", time.Now().Year())
	for _, ds := range demoStudents {
		did := identity.FormatStudentDID("MMR013", intaingSchool.Code, year, ds.DIDSeq)
		if err := seedDemoStudent(ctx, pool, queries, ds, did, intaingSchool, g5Class, parentID, passHash); err != nil {
			log.Fatalf("Failed to seed %s (%s): %v", ds.FullName, did, err)
		}
	}

	log.Println("Demo kiosk students seeded successfully.")
}

func seedDemoStudent(
	ctx context.Context,
	pool *pgxpool.Pool,
	queries *database.Queries,
	ds demoStudent,
	did string,
	school database.School,
	class database.Class,
	parentID pgtype.UUID,
	passHash string,
) error {
	schoolUUID := pgtype.UUID{Bytes: [16]byte(school.ID), Valid: true}

	// Upsert user by email.
	var user database.GetUserByIDRow
	row, err := queries.CreateUser(ctx, database.CreateUserParams{
		Email:        ds.Email,
		PasswordHash: passHash,
		FullName:     ds.FullName,
		Role:         "student",
		SchoolID:     schoolUUID,
	})
	if err != nil {
		if _, updateErr := pool.Exec(ctx, `
			UPDATE users
			SET password_hash = $1, school_id = $2, role = $3, full_name = $4
			WHERE email = $5
		`, passHash, school.ID, "student", ds.FullName, ds.Email); updateErr != nil {
			return fmt.Errorf("upsert user %s: %w", ds.Email, updateErr)
		}
		byEmail, _ := queries.GetUserByEmail(ctx, ds.Email)
		user, err = queries.GetUserByID(ctx, byEmail.ID)
		if err != nil {
			return fmt.Errorf("get user %s: %w", ds.Email, err)
		}
	} else {
		user, err = queries.GetUserByID(ctx, row.ID)
		if err != nil {
			return fmt.Errorf("get user %s: %w", ds.Email, err)
		}
	}

	// Link to school (and parent when available).
	if parentID.Valid {
		if _, err := pool.Exec(ctx, `UPDATE users SET parent_id = $1, school_id = $2 WHERE id = $3`,
			parentID, school.ID, user.ID); err != nil {
			return fmt.Errorf("link parent for %s: %w", ds.Email, err)
		}
	} else {
		if _, err := pool.Exec(ctx, `UPDATE users SET school_id = $1 WHERE id = $2`,
			school.ID, user.ID); err != nil {
			return fmt.Errorf("link school for %s: %w", ds.Email, err)
		}
	}

	// Enroll into Grade 5-A.
	if _, err := pool.Exec(ctx, `DELETE FROM class_enrollments WHERE student_id = $1`, user.ID); err != nil {
		return fmt.Errorf("clear enrollments for %s: %w", ds.Email, err)
	}
	if _, err := queries.CreateEnrollment(ctx, database.CreateEnrollmentParams{
		ClassID:   class.ID,
		StudentID: user.ID,
	}); err != nil {
		return fmt.Errorf("enroll %s: %w", ds.Email, err)
	}

	// Issue W3C Verifiable Credential keyed to the exact kiosk DID.
	kp, err := identity.GenerateKeyPair()
	if err != nil {
		return fmt.Errorf("keypair for %s: %w", ds.Email, err)
	}
	schoolSeed := sha256.Sum256([]byte("edu-school-authority-signing-key:" + school.Code))
	schoolPriv := ed25519.NewKeyFromSeed(schoolSeed[:])

	vc, hashHex, err := identity.IssueStudentCredential(
		user.ID,
		did,
		ds.RollNo,
		school.Code,
		school.Name,
		school.Region,
		"Hlegu",
		"2026-2027",
		kp.PublicKeyHex,
		schoolPriv,
	)
	if err != nil {
		return fmt.Errorf("issue VC for %s: %w", ds.Email, err)
	}
	vcJSON, _ := json.Marshal(vc)

	txPayload := fmt.Sprintf("polygon-amoy-anchor:%s:%s", hashHex, time.Now().String())
	txBytes := sha256.Sum256([]byte(txPayload))
	txHash := "0x" + hex.EncodeToString(txBytes[:])
	merkleRoot := hashHex
	proofJSON, _ := json.Marshal([]map[string]string{{"position": "left", "data": hashHex}})

	// One VC per DID: drop any stale credential row for this student, then insert.
	if _, err := pool.Exec(ctx, `DELETE FROM verifiable_credentials WHERE student_id = $1`, user.ID); err != nil {
		return fmt.Errorf("clear old VC for %s: %w", ds.Email, err)
	}
	if _, err := queries.CreateVerifiableCredential(ctx, database.CreateVerifiableCredentialParams{
		StudentID:          user.ID,
		IssuerSchoolID:     schoolUUID,
		Did:                did,
		CredentialType:     "MyanmarStudentIdentityCredential",
		CredentialHash:     hashHex,
		RawCredentialJson:  vcJSON,
		Signature:          vc.Proof.ProofValue,
		MerkleRoot:         pgtype.Text{String: merkleRoot, Valid: true},
		MerkleProof:        proofJSON,
		PolygonTxHash:      pgtype.Text{String: txHash, Valid: true},
		PolygonBlockNumber: pgtype.Int8{Int64: 14286120 + int64(ds.DIDSeq), Valid: true},
	}); err != nil {
		return fmt.Errorf("save VC for %s: %w", ds.Email, err)
	}

	if _, err := pool.Exec(ctx, `
		UPDATE users
		SET did = $1,
		    blockchain_address = $2,
		    public_key = $3,
		    credential_hash = $4,
		    merkle_root = $5,
		    blockchain_tx_hash = $6,
		    anchor_status = 'anchored'
		WHERE id = $7
	`, did, kp.EthAddress, kp.PublicKeyHex, hashHex, merkleRoot, txHash, user.ID); err != nil {
		return fmt.Errorf("update identity for %s: %w", ds.Email, err)
	}

	log.Printf("Demo student ready: %-22s | Roll: %-10s | DID: %s", ds.FullName, ds.RollNo, did)
	return nil
}
