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
)

func main() {
	cfg := config.Load()
	ctx := context.Background()

	pool, err := database.NewPool(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer pool.Close()

	queries := database.New(pool)

	// 1. Seed or Upsert Intaing BEHS
	log.Println("1. Seeding Intaing BEHS in Hlegu Township...")
	intaingSchool, err := queries.CreateSchool(ctx, database.CreateSchoolParams{
		Name:            "အခြေခံပညာအထက်တန်းကျောင်း အင်းတိုင်",
		NameEn:          pgtype.Text{String: "Basic Education High School Intaing", Valid: true},
		NameMy:          pgtype.Text{String: "အခြေခံပညာအထက်တန်းကျောင်း အင်းတိုင်", Valid: true},
		Code:            "MMR013035-BEHS01",
		Address:         "Yangon-Mandalay Highway, Intaing Village, Hlegu Township, Yangon Region",
		City:            "Hlegu",
		Region:          "Yangon Region",
		Phone:           "0911111",
		Status:          "active",
		PcodeSr:         pgtype.Text{String: "MMR013", Valid: true},
		PcodeTs:         pgtype.Text{String: "MMR013035", Valid: true},
		PcodeWardVt:     pgtype.Text{String: "MMR013035001", Valid: true},
		PcodeLevel:      pgtype.Text{String: "township", Valid: true},
		TownshipName:    pgtype.Text{String: "Hlegu", Valid: true},
		WardVillageName: pgtype.Text{String: "Intaing Village", Valid: true},
		SchoolCategory:  pgtype.Text{String: "BEHS", Valid: true},
	})
	if err != nil {
		intaingSchool, err = queries.GetSchoolByCode(ctx, "MMR013035-BEHS01")
		if err != nil {
			log.Fatalf("Failed to create or retrieve Intaing BEHS: %v", err)
		}
	}
	log.Printf("School ready: %s [%s] (ID: %s)", intaingSchool.Name, intaingSchool.Code, intaingSchool.ID)

	schoolUUID := pgtype.UUID{Bytes: [16]byte(intaingSchool.ID), Valid: true}

	// 2. Generate bcrypt hash for password "mth"
	passHash, err := auth.HashPassword("mth")
	if err != nil {
		log.Fatalf("Failed to hash password: %v", err)
	}

	// Ensure all existing users in the system have password 'mth'
	if _, err := pool.Exec(ctx, "UPDATE users SET password_hash = $1", passHash); err != nil {
		log.Printf("Warning: failed to update all users password: %v", err)
	} else {
		log.Println("Successfully reset password to 'mth' for all users in database.")
	}

	// Helper to upsert user and return user object
	upsertUser := func(email, fullName, role string) database.GetUserByIDRow {
		var user database.GetUserByIDRow
		row, err := queries.CreateUser(ctx, database.CreateUserParams{
			Email:        email,
			PasswordHash: passHash,
			FullName:     fullName,
			Role:         role,
			SchoolID:     schoolUUID,
		})
		if err != nil {
			_, updateErr := pool.Exec(ctx, `
				UPDATE users 
				SET password_hash = $1, school_id = $2, role = $3, full_name = $4 
				WHERE email = $5
			`, passHash, intaingSchool.ID, role, fullName, email)
			if updateErr != nil {
				log.Fatalf("Failed to upsert user %s: %v", email, updateErr)
			}
			byEmail, _ := queries.GetUserByEmail(ctx, email)
			user, _ = queries.GetUserByID(ctx, byEmail.ID)
		} else {
			user, _ = queries.GetUserByID(ctx, row.ID)
		}
		log.Printf("User ready: %-35s | Role: %-12s | Pass: mth", email, role)
		return user
	}

	log.Println("\n2. Creating Admin, Teacher, and Parent accounts for Intaing BEHS...")

	// 2a. Admin account
	upsertUser("admin@mmr013035-behs01.edu.local", "U Zaw Min (Principal, Intaing BEHS)", "school_admin")
	upsertUser("admin.intaing@edu.local", "U Zaw Min (Principal, Intaing BEHS)", "school_admin")

	// 2b. Teacher account: Daw Thida (phone 0911111)
	teacherUser := upsertUser("0911111", "Daw Thida (Teacher, Intaing BEHS)", "teacher")
	upsertUser("0911111@edu.local", "Daw Thida (Teacher, Intaing BEHS)", "teacher")

	// 2c. Parent account: Daw Khin Mar (phone 0922222)
	parentUser := upsertUser("0922222", "Daw Khin Mar (Parent)", "parent")
	upsertUser("0922222@edu.local", "Daw Khin Mar (Parent)", "parent")

	// 3. Classes at Intaing BEHS (KG & Grade 5)
	log.Println("\n3. Creating KG and Grade 5 Classes at Intaing BEHS...")

	// Check existing classes to prevent duplicate class creation
	existingClasses, _ := queries.ListClassesBySchool(ctx, intaingSchool.ID)

	// Class 1: KG Class
	var kgClass database.Class
	for _, c := range existingClasses {
		if c.GradeLevel == "KG" && c.Name == "Kindergarten (KG-A)" {
			kgClass = c
			break
		}
	}
	if kgClass.ID == uuid.Nil {
		var err error
		kgClass, err = queries.CreateClass(ctx, database.CreateClassParams{
			Name:         "Kindergarten (KG-A)",
			GradeLevel:   "KG",
			TeacherID:    teacherUser.ID,
			AcademicYear: "2026-2027",
			SchoolID:     intaingSchool.ID,
		})
		if err != nil {
			log.Fatalf("Failed to create KG class: %v", err)
		}
	}
	log.Printf("KG Class ready: %s [ID: %s]", kgClass.Name, kgClass.ID)

	// Class 2: Grade 5 Class
	var g5Class database.Class
	for _, c := range existingClasses {
		if c.GradeLevel == "Grade 5" && c.Name == "Grade 5-A (Primary)" {
			g5Class = c
			break
		}
	}
	if g5Class.ID == uuid.Nil {
		var err error
		g5Class, err = queries.CreateClass(ctx, database.CreateClassParams{
			Name:         "Grade 5-A (Primary)",
			GradeLevel:   "Grade 5",
			TeacherID:    teacherUser.ID,
			AcademicYear: "2026-2027",
			SchoolID:     intaingSchool.ID,
		})
		if err != nil {
			log.Fatalf("Failed to create Grade 5 class: %v", err)
		}
	}
	log.Printf("Grade 5 Class ready: %s [ID: %s]", g5Class.Name, g5Class.ID)

	// Helper to seed child student with W3C Blockchain ID credential
	seedChild := func(email, fullName, rollNumber string, class database.Class, seqVal int) database.GetUserByIDRow {
		student := upsertUser(email, fullName, "student")

		// Link child to parent (0922222)
		_, err := pool.Exec(ctx, `UPDATE users SET parent_id = $1, school_id = $2 WHERE id = $3`, parentUser.ID, intaingSchool.ID, student.ID)
		if err != nil {
			log.Fatalf("Failed to link child to parent: %v", err)
		}

		// Clean up any stale enrollments for this student, then enroll into target class
		_, _ = pool.Exec(ctx, `DELETE FROM class_enrollments WHERE student_id = $1`, student.ID)
		_, _ = queries.CreateEnrollment(ctx, database.CreateEnrollmentParams{ClassID: class.ID, StudentID: student.ID})

		// Generate Keypair and W3C Verifiable Credential
		kp, err := identity.GenerateKeyPair()
		if err != nil {
			log.Fatalf("Failed to generate keypair: %v", err)
		}

		did := identity.FormatStudentDID("MMR013", intaingSchool.Code, fmt.Sprintf("%d", time.Now().Year()), seqVal)
		schoolSeed := sha256.Sum256([]byte("edu-school-authority-signing-key:" + intaingSchool.Code))
		schoolPriv := ed25519.NewKeyFromSeed(schoolSeed[:])

		vc, hashHex, err := identity.IssueStudentCredential(
			student.ID,
			did,
			rollNumber,
			intaingSchool.Code,
			intaingSchool.Name,
			intaingSchool.Region,
			"Hlegu",
			"2026-2027",
			kp.PublicKeyHex,
			schoolPriv,
		)
		if err != nil {
			log.Fatalf("Failed to issue VC: %v", err)
		}

		vcJSON, _ := json.Marshal(vc)

		// Create mock Layer-2 Merkle proof & Polygon Amoy anchor
		txPayload := fmt.Sprintf("polygon-amoy-anchor:%s:%s", hashHex, time.Now().String())
		txBytes := sha256.Sum256([]byte(txPayload))
		txHash := "0x" + hex.EncodeToString(txBytes[:])
		merkleRoot := hashHex // single leaf root or paired
		proofJSON, _ := json.Marshal([]map[string]string{{"position": "left", "data": hashHex}})

		// Save into verifiable_credentials table
		_, _ = pool.Exec(ctx, `DELETE FROM verifiable_credentials WHERE student_id = $1`, student.ID)
		_, err = queries.CreateVerifiableCredential(ctx, database.CreateVerifiableCredentialParams{
			StudentID:          student.ID,
			IssuerSchoolID:     schoolUUID,
			Did:                did,
			CredentialType:     "MyanmarStudentIdentityCredential",
			CredentialHash:     hashHex,
			RawCredentialJson:  vcJSON,
			Signature:          vc.Proof.ProofValue,
			MerkleRoot:         pgtype.Text{String: merkleRoot, Valid: true},
			MerkleProof:        proofJSON,
			PolygonTxHash:      pgtype.Text{String: txHash, Valid: true},
			PolygonBlockNumber: pgtype.Int8{Int64: 14286120 + int64(seqVal), Valid: true},
		})
		if err != nil {
			log.Printf("Note: credential upsert: %v", err)
		}

		// Update user record with blockchain assignment
		_, err = pool.Exec(ctx, `
			UPDATE users 
			SET did = $1, 
			    blockchain_address = $2, 
			    public_key = $3, 
			    credential_hash = $4, 
			    merkle_root = $5, 
			    blockchain_tx_hash = $6, 
			    anchor_status = 'anchored' 
			WHERE id = $7
		`, did, kp.EthAddress, kp.PublicKeyHex, hashHex, merkleRoot, txHash, student.ID)
		if err != nil {
			log.Fatalf("Failed to update user blockchain identity: %v", err)
		}

		// Add today's attendance record
		today := time.Now().Truncate(24 * time.Hour)
		_, _ = queries.UpsertAttendance(ctx, database.UpsertAttendanceParams{
			ClassID:   class.ID,
			StudentID: student.ID,
			Date:      pgtype.Date{Time: today, Valid: true},
			Status:    "present",
			Notes:     "Active and on time",
		})

		updatedUser, _ := queries.GetUserByID(ctx, student.ID)
		log.Printf("Child enrolled: %-25s | Grade: %-7s | DID: %s", fullName, class.GradeLevel, did)
		return updatedUser
	}

	log.Println("\n4. Seeding 2 Children for Parent 0922222 at Intaing BEHS...")
	// Child 1: KG (Kindergarten)
	child1 := seedChild("aung.kg@intaing.edu.local", "Maung Aung Kaung Myat", "ROLL-KG-001", kgClass, 1)

	// Child 2: Grade 5
	child2 := seedChild("su.g5@intaing.edu.local", "Ma Su Myat Noe", "ROLL-G5-001", g5Class, 2)

	// Child 3: Grade 5 - Maung Kyaw Kyaw
	child3 := seedChild("kyaw.g5@intaing.edu.local", "Maung Kyaw Kyaw", "ROLL-G5-002", g5Class, 3)

	// Add an assignment for Grade 5
	g5Assignment, err := queries.CreateAssignment(ctx, database.CreateAssignmentParams{
		ClassID:     g5Class.ID,
		Title:       "Myanmar Language & Reading - Lesson 3",
		Description: "Complete reading comprehension exercises on pages 22-25",
		DueDate:     pgtype.Timestamptz{Time: time.Now().Add(3 * 24 * time.Hour), Valid: true},
		MaxScore:    100,
	})
	if err == nil {
		_, _ = queries.UpsertSubmission(ctx, database.UpsertSubmissionParams{
			AssignmentID: g5Assignment.ID,
			StudentID:    child2.ID,
			Status:       "submitted",
		})
		_, _ = queries.UpsertSubmission(ctx, database.UpsertSubmissionParams{
			AssignmentID: g5Assignment.ID,
			StudentID:    child3.ID,
			Status:       "submitted",
		})
	}

	// 5. Seed Whole-Child Development Profiles (Framework 9.1 - 9.5)
	log.Println("\n5. Seeding Whole-Child Development Framework Profiles for Grade 5-A...")
	seedWholeChild := func(student database.GetUserByIDRow, rollNo string, attRate float64, acad, phys, health, well, social map[string]interface{}) {
		acadJSON, _ := json.Marshal(acad)
		physJSON, _ := json.Marshal(phys)
		healthJSON, _ := json.Marshal(health)
		wellJSON, _ := json.Marshal(well)
		socialJSON, _ := json.Marshal(social)

		var num pgtype.Numeric
		_ = num.Scan(fmt.Sprintf("%.2f", attRate))

		_, err := queries.UpsertWholeChildProfile(ctx, database.UpsertWholeChildProfileParams{
			StudentID:                student.ID,
			SchoolID:                 intaingSchool.ID,
			ClassID:                  g5Class.ID,
			AcademicYear:             "2026-2027",
			Period:                   "2026-10",
			AttendanceRatePct:        num,
			AcademicProfile:          acadJSON,
			PhysicalGrowthProfile:    physJSON,
			HealthVisibilityProfile:  healthJSON,
			WellbeingProfile:         wellJSON,
			SocialCitizenshipProfile: socialJSON,
			SyncSource:               pgtype.Text{String: "offline_mobile_kiosk", Valid: true},
			SyncRecordHash:           pgtype.Text{String: fmt.Sprintf("sha256:sync_%s_202610", rollNo), Valid: true},
		})
		if err != nil {
			log.Printf("Error upserting whole child profile for %s: %v", student.FullName, err)
		} else {
			log.Printf("Whole-Child Profile seeded: %-25s [Att: %.1f%%]", student.FullName, attRate)
		}
	}

	// Student 1: Ma Su Myat Noe
	seedWholeChild(
		child2,
		"5A-01",
		97.5,
		map[string]interface{}{
			"attendance": map[string]interface{}{
				"total_possible_sessions": 44,
				"sessions_present":        43,
				"sessions_absent":         1,
				"attendance_rate_pct":     97.72,
			},
			"assignment_completion": map[string]interface{}{
				"assigned_count":      8,
				"submitted_count":     8,
				"completion_rate_pct": 100.0,
			},
			"assessments": map[string]interface{}{
				"monthly_exam": map[string]interface{}{
					"myanmar":          88.0,
					"english":          82.0,
					"mathematics":      95.0,
					"general_science":  90.0,
					"social_studies":   86.0,
				},
				"term_grade_point": "A+",
			},
			"competency_mastery": []map[string]string{
				{"code": "G5-MATH-FRAC", "domain": "Fractions & Decimals", "status": "mastered"},
				{"code": "G5-MYAN-COMP", "domain": "Reading Comprehension", "status": "mastered"},
				{"code": "G5-ENG-SPEAK", "domain": "Conversational English", "status": "mastered"},
			},
		},
		map[string]interface{}{
			"measurements": map[string]interface{}{
				"height_cm":                  138.0,
				"weight_kg":                  31.2,
				"calculated_bmi":             16.4,
				"growth_percentile_category": "standard_healthy",
			},
			"milestones_and_development": map[string]string{
				"gross_motor_skills":     "age_appropriate",
				"fine_motor_penmanship": "excellent_cursive",
			},
			"physical_fitness_activity": map[string]interface{}{
				"pe_class_participation": "consistent",
				"preferred_sports":       []string{"Badminton", "Traditional Dance"},
			},
		},
		map[string]interface{}{
			"confidentiality_level": "school_internal_restricted",
			"routine_screenings": map[string]string{
				"vision_check":       "normal_20_20",
				"hearing_check":      "normal",
				"oral_dental_health": "satisfactory",
			},
			"national_campaign_markers": map[string]interface{}{
				"annual_deworming_completed": true,
				"deworming_date":             "2026-07-20",
				"vitamin_a_distributed":      true,
			},
		},
		map[string]interface{}{
			"monthly_checkin_summary": map[string]interface{}{
				"dominant_emotional_state":    "joyful_curious",
				"classroom_engagement_index": 4.9,
				"peer_relational_harmony":    "harmonious",
			},
			"teacher_observations": map[string]string{
				"focus_attention_span": "high",
				"notes":                "Attentive student, helps organize library corner",
			},
		},
		map[string]interface{}{
			"governance_model": "positive_affirmation_appealable",
			"leadership_and_roles": []map[string]string{
				{"role": "Class Monitor (Primary)", "tenure": "Term 1"},
			},
			"clubs_and_extracurriculars": []map[string]string{
				{"club_name": "School Reading Club", "standing": "head_reader"},
			},
			"teamwork_and_peer_conduct": map[string]interface{}{
				"collaboration_rating": 5,
				"citizenship_badges_awarded": []string{
					"Punctuality Star (အချိန်တိကျမှုဆု)",
					"Peer Supporter Badge (သူငယ်ချင်းကူညီမှုဆု)",
				},
			},
		},
	)

	// Student 2: Maung Kyaw Kyaw
	seedWholeChild(
		child3,
		"5A-02",
		95.5,
		map[string]interface{}{
			"attendance": map[string]interface{}{
				"total_possible_sessions": 44,
				"sessions_present":        42,
				"sessions_absent":         2,
				"attendance_rate_pct":     95.45,
			},
			"assignment_completion": map[string]interface{}{
				"assigned_count":      8,
				"submitted_count":     8,
				"completion_rate_pct": 100.0,
			},
			"assessments": map[string]interface{}{
				"monthly_exam": map[string]interface{}{
					"myanmar":          84.0,
					"english":          76.0,
					"mathematics":      92.5,
					"general_science":  88.0,
					"social_studies":   82.0,
				},
				"term_grade_point": "A",
			},
			"competency_mastery": []map[string]string{
				{"code": "G5-MATH-FRAC", "domain": "Fractions & Decimals", "status": "mastered"},
				{"code": "G5-MYAN-COMP", "domain": "Reading Comprehension", "status": "mastered"},
				{"code": "G5-ENG-SPEAK", "domain": "Conversational English", "status": "progressing"},
			},
		},
		map[string]interface{}{
			"measurements": map[string]interface{}{
				"height_cm":                  136.5,
				"weight_kg":                  29.8,
				"calculated_bmi":             16.0,
				"growth_percentile_category": "standard_healthy",
			},
			"physical_fitness_activity": map[string]interface{}{
				"pe_class_participation": "consistent",
				"preferred_sports":       []string{"Football", "Chinlon (ခြင်းလုံး)"},
			},
		},
		map[string]interface{}{
			"confidentiality_level": "school_internal_restricted",
			"routine_screenings": map[string]string{
				"vision_check": "normal_20_20",
				"hearing_check": "normal",
			},
			"national_campaign_markers": map[string]interface{}{
				"annual_deworming_completed": true,
				"deworming_date":             "2026-07-20",
				"vitamin_a_distributed":      true,
			},
		},
		map[string]interface{}{
			"monthly_checkin_summary": map[string]interface{}{
				"dominant_emotional_state":    "content_enthusiastic",
				"classroom_engagement_index": 4.8,
			},
			"teacher_observations": map[string]string{
				"focus_attention_span": "high",
				"notes":                "High energy, actively participates in group discussions",
			},
		},
		map[string]interface{}{
			"leadership_and_roles": []map[string]string{
				{"role": "Table Group Leader (Row 2)", "tenure": "Term 1"},
			},
			"clubs_and_extracurriculars": []map[string]string{
				{"club_name": "Junior Red Cross (ကြက်ခြေနီ အသင်းခွဲ)", "standing": "active_member"},
			},
			"teamwork_and_peer_conduct": map[string]interface{}{
				"collaboration_rating": 5,
				"citizenship_badges_awarded": []string{
					"Helpful Classmate Badge",
					"Green Campus Gardener",
				},
			},
		},
	)

	fmt.Println("\n=======================================================")
	fmt.Println("    INTAING BEHS WHOLE-CHILD SEEDING SUCCESSFUL        ")
	fmt.Println("=======================================================")
	fmt.Printf("School : %s [%s]\n", intaingSchool.Name, intaingSchool.Code)
	fmt.Printf("Teacher: Daw Thida (Phone: 0911111, ID: %s)\n", teacherUser.ID)
	fmt.Printf("Class  : %s (Grade 5)\n", g5Class.Name)
	fmt.Printf("Parent : Daw Khin Mar (Phone: 0922222, ID: %s)\n", parentUser.ID)
	fmt.Println("\nEnrolled Children with Blockchain IDs & Whole-Child Profiles:")
	fmt.Printf("  1. %s (KG-A)\n", child1.FullName)
	fmt.Printf("  2. %s (Grade 5-A, Roll: 5A-01)\n", child2.FullName)
	fmt.Printf("  3. %s (Grade 5-A, Roll: 5A-02)\n", child3.FullName)
	fmt.Println("=======================================================")
}
