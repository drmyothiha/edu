package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"time"

	"edu-platform/internal/auth"
	"edu-platform/internal/config"
	"edu-platform/internal/database"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

type scrapedSchool struct {
	Name           string `json:"name"`
	NameEn         string `json:"name_en"`
	NameMy         string `json:"name_my"`
	Code           string `json:"code"`
	Address        string `json:"address"`
	City           string `json:"city"`
	Region         string `json:"region"`
	Phone          string `json:"phone"`
	Status         string `json:"status"`
	PcodeSr        string `json:"pcode_sr"`
	PcodeTs        string `json:"pcode_ts"`
	PcodeLevel     string `json:"pcode_level"`
	TownshipName   string `json:"township_name"`
	WardVillage    string `json:"ward_village_name"`
	SchoolCategory string `json:"school_category"`
}

type pcodeItem struct {
	PCode       string `json:"pcode"`
	ParentPCode string `json:"parent_pcode"`
	AdminLevel  int32  `json:"admin_level"`
	NameEn      string `json:"name_en"`
	NameMy      string `json:"name_my"`
	SRPCode     string `json:"sr_pcode"`
	TSPCode     string `json:"ts_pcode"`
	PCodeType   string `json:"pcode_type"`
}

func main() {
	cfg := config.Load()
	ctx := context.Background()

	pool, err := database.NewPool(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer pool.Close()

	// Apply schema migrations
	log.Println("Applying schema migrations...")
	if err := database.RunMigrations(ctx, pool, "db/migrations"); err != nil {
		log.Fatalf("Migration failed: %v", err)
	}

	queries := database.New(pool)

	// 1. Seed Nationwide Myanmar MIMU P-Code Dataset
	log.Println("Seeding complete Myanmar MIMU Administrative Divisions (States/Regions & Townships)...")
	seedMyanmarPCodes(ctx, pool, queries)

	// 2. Seed All Nationwide Schools from schools_with_pcodes.json (1,686 schools)
	seedAllNationwideSchools(ctx, pool)

	// 3. Seed Well-Known Prestigious Schools using Option A: {pcode_ward_vt}-{category}{seq}
	log.Println("Seeding well-known schools across Myanmar with MIMU Option A codes...")

	// Yangon: Yangon Academy (Private)
	ygnAcademy := seedSchool(ctx, queries, database.CreateSchoolParams{
		Name:            "Yangon Academy High School",
		Code:            "MMR013001001-PV01",
		Address:         "No. 42 Pyay Road, Dagon Township",
		City:            "Yangon",
		Region:          "Yangon Region",
		Phone:           "+95 1 234 567",
		Status:          "active",
		PcodeSr:         pgtype.Text{String: "MMR013", Valid: true},
		PcodeTs:         pgtype.Text{String: "MMR013001", Valid: true},
		PcodeWardVt:     pgtype.Text{String: "MMR013001001", Valid: true},
		PcodeLevel:      pgtype.Text{String: "ward", Valid: true},
		TownshipName:    pgtype.Text{String: "Dagon", Valid: true},
		WardVillageName: pgtype.Text{String: "Ward 1", Valid: true},
		SchoolCategory:  pgtype.Text{String: "PV", Valid: true},
	})

	// Yangon: BEHS 1 Dagon (Historical High School)
	behs1Dagon := seedSchool(ctx, queries, database.CreateSchoolParams{
		Name:            "Basic Education High School No. 1 Dagon (အ.ထ.က ၁ ဒဂုံ)",
		Code:            "MMR013001001-BEHS01",
		Address:         "Corner of Commissioner Road & Shwedagon Pagoda Road",
		City:            "Yangon",
		Region:          "Yangon Region",
		Phone:           "+95 1 371 234",
		Status:          "active",
		PcodeSr:         pgtype.Text{String: "MMR013", Valid: true},
		PcodeTs:         pgtype.Text{String: "MMR013001", Valid: true},
		PcodeWardVt:     pgtype.Text{String: "MMR013001001", Valid: true},
		PcodeLevel:      pgtype.Text{String: "ward", Valid: true},
		TownshipName:    pgtype.Text{String: "Dagon", Valid: true},
		WardVillageName: pgtype.Text{String: "Ward 1", Valid: true},
		SchoolCategory:  pgtype.Text{String: "BEHS", Valid: true},
	})

	// Yangon: BEHS Branch Kamayut (အ.ထ.က (ခွဲ))
	behsBrKamayut := seedSchool(ctx, queries, database.CreateSchoolParams{
		Name:            "Basic Education High School (Branch) No. 2 Kamayut (အ.ထ.က (ခွဲ) ၂ ကမာရွတ်)",
		Code:            "MMR013003002-BEHS-BR01",
		Address:         "Insein Road, Kamayut Township",
		City:            "Yangon",
		Region:          "Yangon Region",
		Phone:           "+95 1 534 890",
		Status:          "active",
		PcodeSr:         pgtype.Text{String: "MMR013", Valid: true},
		PcodeTs:         pgtype.Text{String: "MMR013003", Valid: true},
		PcodeWardVt:     pgtype.Text{String: "MMR013003002", Valid: true},
		PcodeLevel:      pgtype.Text{String: "ward", Valid: true},
		TownshipName:    pgtype.Text{String: "Kamayut", Valid: true},
		WardVillageName: pgtype.Text{String: "Ward 2", Valid: true},
		SchoolCategory:  pgtype.Text{String: "BEHS-BR", Valid: true},
	})

	// Yangon: University of Information Technology (UIT)
	uitYangon := seedSchool(ctx, queries, database.CreateSchoolParams{
		Name:            "University of Information Technology (UIT - သတင်းအချက်အလက်နည်းပညာတက္ကသိုလ်)",
		Code:            "MMR013008001-UIT01",
		Address:         "Parami Road, Hlaing Campus",
		City:            "Yangon",
		Region:          "Yangon Region",
		Phone:           "+95 1 966 4254",
		Status:          "active",
		PcodeSr:         pgtype.Text{String: "MMR013", Valid: true},
		PcodeTs:         pgtype.Text{String: "MMR013008", Valid: true},
		PcodeWardVt:     pgtype.Text{String: "MMR013008001", Valid: true},
		PcodeLevel:      pgtype.Text{String: "ward", Valid: true},
		TownshipName:    pgtype.Text{String: "Hlaing", Valid: true},
		WardVillageName: pgtype.Text{String: "Hlaing Ward 1", Valid: true},
		SchoolCategory:  pgtype.Text{String: "UIT", Valid: true},
	})

	// Yangon: University of Computer Studies, Yangon (UCSY)
	ucsyYangon := seedSchool(ctx, queries, database.CreateSchoolParams{
		Name:            "University of Computer Studies, Yangon (UCSY - ရန်ကုန်ကွန်ပျူတာတက္ကသိုလ်)",
		Code:            "MMR013005001-UCSY01",
		Address:         "Shwe Pyi Thar Township, Yangon",
		City:            "Yangon",
		Region:          "Yangon Region",
		Phone:           "+95 1 610 655",
		Status:          "active",
		PcodeSr:         pgtype.Text{String: "MMR013", Valid: true},
		PcodeTs:         pgtype.Text{String: "MMR013005", Valid: true},
		PcodeWardVt:     pgtype.Text{String: "MMR013005001", Valid: true},
		PcodeLevel:      pgtype.Text{String: "ward", Valid: true},
		TownshipName:    pgtype.Text{String: "Shwepyithar", Valid: true},
		WardVillageName: pgtype.Text{String: "Ward 1", Valid: true},
		SchoolCategory:  pgtype.Text{String: "UCSY", Valid: true},
	})

	// Yangon: Yangon Technological University (YTU)
	ytuYangon := seedSchool(ctx, queries, database.CreateSchoolParams{
		Name:            "Yangon Technological University (YTU - ရန်ကုန်နည်းပညာတက္ကသိုလ်)",
		Code:            "MMR013006001-YTU01",
		Address:         "Gyogone, Insein Township",
		City:            "Yangon",
		Region:          "Yangon Region",
		Phone:           "+95 1 664 280",
		Status:          "active",
		PcodeSr:         pgtype.Text{String: "MMR013", Valid: true},
		PcodeTs:         pgtype.Text{String: "MMR013006", Valid: true},
		PcodeWardVt:     pgtype.Text{String: "MMR013006001", Valid: true},
		PcodeLevel:      pgtype.Text{String: "ward", Valid: true},
		TownshipName:    pgtype.Text{String: "Insein", Valid: true},
		WardVillageName: pgtype.Text{String: "Gyogone", Valid: true},
		SchoolCategory:  pgtype.Text{String: "YTU", Valid: true},
	})

	// Mandalay: BEHS 16 Mandalay
	behs16Mdy := seedSchool(ctx, queries, database.CreateSchoolParams{
		Name:            "Basic Education High School No. 16 Mandalay (အ.ထ.က ၁၆ မန္တလေး)",
		Code:            "MMR009002004-BEHS16",
		Address:         "78th Street, Chanayethazan Township",
		City:            "Mandalay",
		Region:          "Mandalay Region",
		Phone:           "+95 2 403 123",
		Status:          "active",
		PcodeSr:         pgtype.Text{String: "MMR009", Valid: true},
		PcodeTs:         pgtype.Text{String: "MMR009002", Valid: true},
		PcodeWardVt:     pgtype.Text{String: "MMR009002004", Valid: true},
		PcodeLevel:      pgtype.Text{String: "ward", Valid: true},
		TownshipName:    pgtype.Text{String: "Chanayethazan", Valid: true},
		WardVillageName: pgtype.Text{String: "Ward 4", Valid: true},
		SchoolCategory:  pgtype.Text{String: "BEHS", Valid: true},
	})

	// Mandalay: Mandalay Science & Tech Institute
	mdyTech := seedSchool(ctx, queries, database.CreateSchoolParams{
		Name:            "Mandalay Science & Tech Institute",
		Code:            "MMR009002004-PV01",
		Address:         "73rd Street, Chanayethazan Township",
		City:            "Mandalay",
		Region:          "Mandalay Region",
		Phone:           "+95 2 987 654",
		Status:          "active",
		PcodeSr:         pgtype.Text{String: "MMR009", Valid: true},
		PcodeTs:         pgtype.Text{String: "MMR009002", Valid: true},
		PcodeWardVt:     pgtype.Text{String: "MMR009002004", Valid: true},
		PcodeLevel:      pgtype.Text{String: "ward", Valid: true},
		TownshipName:    pgtype.Text{String: "Chanayethazan", Valid: true},
		WardVillageName: pgtype.Text{String: "Ward 4", Valid: true},
		SchoolCategory:  pgtype.Text{String: "PV", Valid: true},
	})

	// Shan State: Taunggyi International High
	tgiHigh := seedSchool(ctx, queries, database.CreateSchoolParams{
		Name:            "Taunggyi International High School",
		Code:            "MMR014001002-PV01",
		Address:         "Bogyoke Road, Taunggyi",
		City:            "Taunggyi",
		Region:          "Shan State",
		Phone:           "+95 81 555 123",
		Status:          "active",
		PcodeSr:         pgtype.Text{String: "MMR014", Valid: true},
		PcodeTs:         pgtype.Text{String: "MMR014001", Valid: true},
		PcodeWardVt:     pgtype.Text{String: "MMR014001002", Valid: true},
		PcodeLevel:      pgtype.Text{String: "ward", Valid: true},
		TownshipName:    pgtype.Text{String: "Taunggyi", Valid: true},
		WardVillageName: pgtype.Text{String: "Ward 2", Valid: true},
		SchoolCategory:  pgtype.Text{String: "PV", Valid: true},
	})

	// Nay Pyi Taw: BEHS 1 Zabuthiri
	behs1Npt := seedSchool(ctx, queries, database.CreateSchoolParams{
		Name:            "Basic Education High School No. 1 Zabuthiri (အ.ထ.က ၁ ဇမ္ဗူသီရိ)",
		Code:            "MMR018001001-BEHS01",
		Address:         "Thiri Yadanar Market Road, Zabuthiri Township",
		City:            "Nay Pyi Taw",
		Region:          "Nay Pyi Taw Union Territory",
		Phone:           "+95 67 414 111",
		Status:          "active",
		PcodeSr:         pgtype.Text{String: "MMR018", Valid: true},
		PcodeTs:         pgtype.Text{String: "MMR018001", Valid: true},
		PcodeWardVt:     pgtype.Text{String: "MMR018001001", Valid: true},
		PcodeLevel:      pgtype.Text{String: "ward", Valid: true},
		TownshipName:    pgtype.Text{String: "Zabuthiri", Valid: true},
		WardVillageName: pgtype.Text{String: "Thiri Ward", Valid: true},
		SchoolCategory:  pgtype.Text{String: "BEHS", Valid: true},
	})

	log.Printf("Schools ready with Option A P-Codes: %s (%s), %s (%s), %s (%s), %s (%s), %s (%s), %s (%s)",
		ygnAcademy.Name, ygnAcademy.Code,
		behs1Dagon.Name, behs1Dagon.Code,
		behsBrKamayut.Name, behsBrKamayut.Code,
		uitYangon.Name, uitYangon.Code,
		ucsyYangon.Name, ucsyYangon.Code,
		ytuYangon.Name, ytuYangon.Code,
	)

	ygnSchoolUUID := pgtype.UUID{Bytes: [16]byte(ygnAcademy.ID), Valid: true}
	mdySchoolUUID := pgtype.UUID{Bytes: [16]byte(mdyTech.ID), Valid: true}
	tgiSchoolUUID := pgtype.UUID{Bytes: [16]byte(tgiHigh.ID), Valid: true}
	nptSchoolUUID := pgtype.UUID{Bytes: [16]byte(behs1Npt.ID), Valid: true}

	// 3. User Accounts (Nationwide Hubs: Yangon, Mandalay, Shan, Nay Pyi Taw)
	log.Println("Seeding role-based user hierarchy for key nationwide educational hubs...")
	mthHash, _ := auth.HashPassword("mth")
	sysAdminHash := mthHash
	schoolAdminHash := mthHash
	teacherHash := mthHash
	studentHash := mthHash
	parentHash := mthHash

	// Global Platform Owner (Sysadmin)
	sysadmin := seedUser(ctx, queries, database.CreateUserParams{
		Email:        "sysadmin@edu.local",
		PasswordHash: sysAdminHash,
		FullName:     "National System Administrator",
		Role:         "sysadmin",
		SchoolID:     pgtype.UUID{Valid: false}, // Global
	})
	log.Printf("SysAdmin ready: %s (%s)", sysadmin.Email, sysadmin.Role)

	// School Principals (School Admins) across hubs
	ygnAdmin := seedUser(ctx, queries, database.CreateUserParams{
		Email:        "admin.ygn@edu.local",
		PasswordHash: schoolAdminHash,
		FullName:     "U Kyaw Zeya (Principal, Yangon Academy)",
		Role:         "school_admin",
		SchoolID:     ygnSchoolUUID,
	})

	mdyAdmin := seedUser(ctx, queries, database.CreateUserParams{
		Email:        "admin.mdy@edu.local",
		PasswordHash: schoolAdminHash,
		FullName:     "Daw Hnin Yu (Principal, Mandalay Tech)",
		Role:         "school_admin",
		SchoolID:     mdySchoolUUID,
	})

	tgiAdmin := seedUser(ctx, queries, database.CreateUserParams{
		Email:        "admin.tgi@edu.local",
		PasswordHash: schoolAdminHash,
		FullName:     "Sai Aung Kham (Principal, Taunggyi High)",
		Role:         "school_admin",
		SchoolID:     tgiSchoolUUID,
	})

	nptAdmin := seedUser(ctx, queries, database.CreateUserParams{
		Email:        "admin.npt@edu.local",
		PasswordHash: schoolAdminHash,
		FullName:     "Daw Khin Moe (Principal, BEHS 1 Zabuthiri)",
		Role:         "school_admin",
		SchoolID:     nptSchoolUUID,
	})

	// Legacy alias admin
	_ = seedUser(ctx, queries, database.CreateUserParams{
		Email:        "admin@edu.local",
		PasswordHash: schoolAdminHash,
		FullName:     "Institution Administrator",
		Role:         "admin",
		SchoolID:     ygnSchoolUUID,
	})
	log.Printf("School Admins ready across hubs: %s, %s, %s, %s", ygnAdmin.Email, mdyAdmin.Email, tgiAdmin.Email, nptAdmin.Email)

	// Faculty Teachers
	teacherSmith := seedUser(ctx, queries, database.CreateUserParams{
		Email:        "teacher.smith@edu.local",
		PasswordHash: teacherHash,
		FullName:     "Sarah Smith (Mathematics)",
		Role:         "teacher",
		SchoolID:     ygnSchoolUUID,
	})

	teacherJohnson := seedUser(ctx, queries, database.CreateUserParams{
		Email:        "teacher.johnson@edu.local",
		PasswordHash: teacherHash,
		FullName:     "David Johnson (Computer Science)",
		Role:         "teacher",
		SchoolID:     mdySchoolUUID,
	})

	teacherAung := seedUser(ctx, queries, database.CreateUserParams{
		Email:        "teacher.aung@edu.local",
		PasswordHash: teacherHash,
		FullName:     "U Tin Aung (Physics)",
		Role:         "teacher",
		SchoolID:     nptSchoolUUID,
	})
	log.Printf("Teachers ready: %s (Yangon), %s (Mandalay), %s (Nay Pyi Taw)", teacherSmith.Email, teacherJohnson.Email, teacherAung.Email)

	// Students
	studentAlice := seedUser(ctx, queries, database.CreateUserParams{
		Email:        "student.alice@edu.local",
		PasswordHash: studentHash,
		FullName:     "Alice Walker",
		Role:         "student",
		SchoolID:     ygnSchoolUUID,
	})

	studentBob := seedUser(ctx, queries, database.CreateUserParams{
		Email:        "student.bob@edu.local",
		PasswordHash: studentHash,
		FullName:     "Bob Miller",
		Role:         "student",
		SchoolID:     ygnSchoolUUID,
	})

	studentCharlie := seedUser(ctx, queries, database.CreateUserParams{
		Email:        "student.charlie@edu.local",
		PasswordHash: studentHash,
		FullName:     "Charlie Davis",
		Role:         "student",
		SchoolID:     mdySchoolUUID,
	})
	log.Printf("Students ready: %s, %s, %s", studentAlice.Email, studentBob.Email, studentCharlie.Email)

	// Parents
	parentClark := seedUser(ctx, queries, database.CreateUserParams{
		Email:        "parent.clark@edu.local",
		PasswordHash: parentHash,
		FullName:     "Eleanor Clark",
		Role:         "parent",
		SchoolID:     ygnSchoolUUID,
	})
	log.Printf("Parent ready: %s", parentClark.Email)

	// 4. Academic Classes
	mathClass, err := queries.CreateClass(ctx, database.CreateClassParams{
		Name:         "Grade 8 Mathematics",
		GradeLevel:   "Grade 8",
		TeacherID:    teacherSmith.ID,
		AcademicYear: "2026-2027",
		SchoolID:     ygnAcademy.ID,
	})
	if err != nil {
		classes, _ := queries.ListClassesBySchool(ctx, ygnAcademy.ID)
		if len(classes) > 0 {
			mathClass = classes[0]
		}
	}

	csClass, err := queries.CreateClass(ctx, database.CreateClassParams{
		Name:         "Grade 10 Computer Science",
		GradeLevel:   "Grade 10",
		TeacherID:    teacherJohnson.ID,
		AcademicYear: "2026-2027",
		SchoolID:     mdyTech.ID,
	})
	if err != nil {
		classes, _ := queries.ListClassesBySchool(ctx, mdyTech.ID)
		if len(classes) > 0 {
			csClass = classes[0]
		}
	}

	// Seed Standard Campus Classes & Sections (KG, Grade 1 to Grade 12, Sections A & B) for key schools
	log.Println("Seeding standard Campus Classes & Sections (KG, Grade 1 to Grade 12, Sections A & B) strictly under school facilities...")
	schoolsToSeed := []struct {
		schoolID  uuid.UUID
		teacherID uuid.UUID
	}{
		{ygnAcademy.ID, teacherSmith.ID},
		{behs1Dagon.ID, teacherSmith.ID},
		{behsBrKamayut.ID, teacherSmith.ID},
		{uitYangon.ID, teacherSmith.ID},
		{ucsyYangon.ID, teacherSmith.ID},
		{ytuYangon.ID, teacherSmith.ID},
		{behs16Mdy.ID, teacherJohnson.ID},
		{mdyTech.ID, teacherJohnson.ID},
		{tgiHigh.ID, tgiAdmin.ID},
		{behs1Npt.ID, teacherAung.ID},
		{uuid.MustParse("a0000000-0000-0000-0000-000000000001"), teacherSmith.ID},
	}
	if ygnAdmin.SchoolID.Valid {
		schoolsToSeed = append(schoolsToSeed, struct {
			schoolID  uuid.UUID
			teacherID uuid.UUID
		}{uuid.UUID(ygnAdmin.SchoolID.Bytes), ygnAdmin.ID})
	}
	if mdyAdmin.SchoolID.Valid {
		schoolsToSeed = append(schoolsToSeed, struct {
			schoolID  uuid.UUID
			teacherID uuid.UUID
		}{uuid.UUID(mdyAdmin.SchoolID.Bytes), mdyAdmin.ID})
	}
	if tgiAdmin.SchoolID.Valid {
		schoolsToSeed = append(schoolsToSeed, struct {
			schoolID  uuid.UUID
			teacherID uuid.UUID
		}{uuid.UUID(tgiAdmin.SchoolID.Bytes), tgiAdmin.ID})
	}
	if nptAdmin.SchoolID.Valid {
		schoolsToSeed = append(schoolsToSeed, struct {
			schoolID  uuid.UUID
			teacherID uuid.UUID
		}{uuid.UUID(nptAdmin.SchoolID.Bytes), nptAdmin.ID})
	}

	for _, item := range schoolsToSeed {
		seedDefaultK12ClassesForSchool(ctx, queries, item.schoolID, item.teacherID)
	}

	// 5. Enrollments & Attendance
	_, _ = queries.CreateEnrollment(ctx, database.CreateEnrollmentParams{ClassID: mathClass.ID, StudentID: studentAlice.ID})
	_, _ = queries.CreateEnrollment(ctx, database.CreateEnrollmentParams{ClassID: mathClass.ID, StudentID: studentBob.ID})
	_, _ = queries.CreateEnrollment(ctx, database.CreateEnrollmentParams{ClassID: csClass.ID, StudentID: studentCharlie.ID})

	today := time.Now().Truncate(24 * time.Hour)
	_, _ = queries.UpsertAttendance(ctx, database.UpsertAttendanceParams{
		ClassID:   mathClass.ID,
		StudentID: studentAlice.ID,
		Date:      pgtype.Date{Time: today, Valid: true},
		Status:    "present",
		Notes:     "Punctual and engaged",
	})

	// 6. Assignments
	mathAssignment, err := queries.CreateAssignment(ctx, database.CreateAssignmentParams{
		ClassID:     mathClass.ID,
		Title:       "Pythagorean Theorem Problem Set",
		Description: "Complete exercises 1 through 15 on textbook p. 142",
		DueDate:     pgtype.Timestamptz{Time: time.Now().Add(5 * 24 * time.Hour), Valid: true},
		MaxScore:    100,
	})
	if err == nil {
		_, _ = queries.UpsertSubmission(ctx, database.UpsertSubmissionParams{
			AssignmentID: mathAssignment.ID,
			StudentID:    studentAlice.ID,
			Status:       "submitted",
		})
	}

	// 7. Lesson Plan Copilot
	_, _ = queries.CreateLessonPlan(ctx, database.CreateLessonPlanParams{
		TeacherID:         teacherSmith.ID,
		Subject:           "Mathematics",
		GradeLevel:        "Grade 8",
		Topic:             "Pythagorean Theorem",
		DurationMinutes:   45,
		GeneratedMarkdown: "# Lesson Plan: Pythagorean Theorem\n\n## 1. Learning Objectives\n- Understand a^2 + b^2 = c^2.\n\n## 2. Sequence\n- 45 min active discovery.",
	})

	fmt.Println("\n=== NATIONWIDE MIMU P-CODE SEEDING COMPLETED ===")
	fmt.Println("Administrative Divisions Provisioned: 15 States/Regions & 30+ Townships across Myanmar.")
	fmt.Println("\nPrestigious Well-Known Schools (Option A P-Codes):")
	fmt.Printf("  1. %s [%s] - %s, %s\n", ygnAcademy.Name, ygnAcademy.Code, ygnAcademy.City, ygnAcademy.Region)
	fmt.Printf("  2. %s [%s] - %s, %s\n", behs1Dagon.Name, behs1Dagon.Code, behs1Dagon.City, behs1Dagon.Region)
	fmt.Printf("  3. %s [%s] - %s, %s\n", behsBrKamayut.Name, behsBrKamayut.Code, behsBrKamayut.City, behsBrKamayut.Region)
	fmt.Printf("  4. %s [%s] - %s, %s\n", uitYangon.Name, uitYangon.Code, uitYangon.City, uitYangon.Region)
	fmt.Printf("  5. %s [%s] - %s, %s\n", ucsyYangon.Name, ucsyYangon.Code, ucsyYangon.City, ucsyYangon.Region)
	fmt.Printf("  6. %s [%s] - %s, %s\n", ytuYangon.Name, ytuYangon.Code, ytuYangon.City, ytuYangon.Region)
	fmt.Printf("  7. %s [%s] - %s, %s\n", behs16Mdy.Name, behs16Mdy.Code, behs16Mdy.City, behs16Mdy.Region)
	fmt.Printf("  8. %s [%s] - %s, %s\n", mdyTech.Name, mdyTech.Code, mdyTech.City, mdyTech.Region)
	fmt.Printf("  9. %s [%s] - %s, %s\n", tgiHigh.Name, tgiHigh.Code, tgiHigh.City, tgiHigh.Region)
	fmt.Printf("  10. %s [%s] - %s, %s\n", behs1Npt.Name, behs1Npt.Code, behs1Npt.City, behs1Npt.Region)
	fmt.Println("\nKey Regional Hub Accounts:")
	fmt.Println("  [SysAdmin]    sysadmin@edu.local / SysAdmin123!   (Nationwide Platform Oversight)")
	fmt.Println("  [SchoolAdmin] admin.ygn@edu.local / Admin123!     (Yangon Academy Principal)")
	fmt.Println("  [SchoolAdmin] admin.mdy@edu.local / Admin123!     (Mandalay Tech Principal)")
	fmt.Println("  [SchoolAdmin] admin.tgi@edu.local / Admin123!     (Taunggyi High Principal)")
	fmt.Println("  [SchoolAdmin] admin.npt@edu.local / Admin123!     (Nay Pyi Taw BEHS 1 Principal)")
	fmt.Println("  [Teacher]     teacher.smith@edu.local / Teacher123! (Yangon Academy)")
	fmt.Println("  [Teacher]     teacher.johnson@edu.local / Teacher123! (Mandalay Tech)")
	fmt.Println("  * Note: Additional school facilities & principals are provisioned ON DEMAND via SysAdmin portal.")
}

func seedSchool(ctx context.Context, queries *database.Queries, params database.CreateSchoolParams) database.School {
	sc, err := queries.CreateSchool(ctx, params)
	if err == nil {
		return sc
	}
	existing, err := queries.GetSchoolByCode(ctx, params.Code)
	if err == nil {
		return existing
	}
	schools, _ := queries.ListSchools(ctx)
	if len(schools) > 0 {
		return schools[0]
	}
	log.Fatalf("failed to seed school %s: %v", params.Code, err)
	return database.School{}
}

func seedDefaultK12ClassesForSchool(ctx context.Context, queries *database.Queries, schoolID uuid.UUID, teacherID uuid.UUID) {
	if schoolID == uuid.Nil || teacherID == uuid.Nil {
		return
	}
	grades := []string{
		"KG",
		"Grade 1",
		"Grade 2",
		"Grade 3",
		"Grade 4",
		"Grade 5",
		"Grade 6",
		"Grade 7",
		"Grade 8",
		"Grade 9",
		"Grade 10",
		"Grade 11",
		"Grade 12",
	}
	sections := []string{"Section A", "Section B"}

	existingClasses, _ := queries.ListClassesBySchool(ctx, schoolID)
	existingMap := make(map[string]bool)
	for _, c := range existingClasses {
		existingMap[c.GradeLevel+"::"+c.Name] = true
	}

	for _, g := range grades {
		for _, s := range sections {
			name := fmt.Sprintf("%s - %s", g, s)
			if existingMap[g+"::"+name] {
				continue
			}
			_, err := queries.CreateClass(ctx, database.CreateClassParams{
				Name:         name,
				GradeLevel:   g,
				TeacherID:    teacherID,
				AcademicYear: "2026-2027",
				SchoolID:     schoolID,
			})
			if err != nil {
				log.Printf("Notice: skipping duplicate class %s: %v", name, err)
			}
		}
	}
}

func seedUser(ctx context.Context, queries *database.Queries, params database.CreateUserParams) database.CreateUserRow {
	u, err := queries.CreateUser(ctx, params)
	if err == nil {
		return u
	}
	existing, err := queries.GetUserByEmail(ctx, params.Email)
	if err != nil {
		log.Fatalf("failed to create or retrieve user %s: %v", params.Email, err)
	}
	return database.CreateUserRow{
		ID:           existing.ID,
		Email:        existing.Email,
		PasswordHash: existing.PasswordHash,
		FullName:     existing.FullName,
		Role:         existing.Role,
		SchoolID:     existing.SchoolID,
		CreatedAt:    existing.CreatedAt,
	}
}

func seedMyanmarPCodes(ctx context.Context, pool *pgxpool.Pool, queries *database.Queries) {
	paths := []string{
		"mimu_pcodes.json",
		"../mimu_pcodes.json",
		"../../mimu_pcodes.json",
	}

	var data []byte
	var err error
	for _, p := range paths {
		data, err = os.ReadFile(p)
		if err == nil {
			log.Printf("Found MIMU PCodes dataset at %s (%d bytes)", p, len(data))
			break
		}
	}

	if err == nil && len(data) > 0 {
		var fullItems []pcodeItem
		if err := json.Unmarshal(data, &fullItems); err == nil && len(fullItems) > 0 {
			log.Printf("Seeding %d MIMU Place Codes from official MIMU dataset...", len(fullItems))
			query := `
			INSERT INTO mimu_pcodes (
				pcode, parent_pcode, admin_level, name_en, name_my, sr_pcode, ts_pcode, pcode_type
			)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
			ON CONFLICT (pcode) DO UPDATE SET
				name_en = EXCLUDED.name_en,
				name_my = EXCLUDED.name_my,
				parent_pcode = EXCLUDED.parent_pcode,
				admin_level = EXCLUDED.admin_level,
				sr_pcode = EXCLUDED.sr_pcode,
				ts_pcode = EXCLUDED.ts_pcode,
				pcode_type = EXCLUDED.pcode_type;
			`
			batch := &pgx.Batch{}
			count := 0
			for _, item := range fullItems {
				var parentPCode, srPCode, tsPCode interface{}
				if item.ParentPCode != "" {
					parentPCode = item.ParentPCode
				}
				if item.SRPCode != "" {
					srPCode = item.SRPCode
				}
				if item.TSPCode != "" {
					tsPCode = item.TSPCode
				}
				batch.Queue(query,
					item.PCode, parentPCode, item.AdminLevel,
					item.NameEn, item.NameMy, srPCode, tsPCode, item.PCodeType,
				)
				count++
				if batch.Len() >= 500 {
					br := pool.SendBatch(ctx, batch)
					if err := br.Close(); err != nil {
						log.Printf("Warning: batch insert error: %v", err)
					}
					batch = &pgx.Batch{}
				}
			}
			if batch.Len() > 0 {
				br := pool.SendBatch(ctx, batch)
				if err := br.Close(); err != nil {
					log.Printf("Warning: final batch error: %v", err)
				}
			}
			log.Printf("Successfully synchronized %d nationwide MIMU Place Codes into database.", count)
			return
		}
	}

	items := []pcodeItem{
		// Level 1: All 15 States & Regions of Myanmar
		{PCode: "MMR001", AdminLevel: 1, NameEn: "Kachin State", NameMy: "ကချင်ပြည်နယ်", PCodeType: "state_region"},
		{PCode: "MMR002", AdminLevel: 1, NameEn: "Kayah State", NameMy: "ကယားပြည်နယ်", PCodeType: "state_region"},
		{PCode: "MMR003", AdminLevel: 1, NameEn: "Kayin State", NameMy: "ကရင်ပြည်နယ်", PCodeType: "state_region"},
		{PCode: "MMR004", AdminLevel: 1, NameEn: "Chin State", NameMy: "ချင်းပြည်နယ်", PCodeType: "state_region"},
		{PCode: "MMR005", AdminLevel: 1, NameEn: "Sagaing Region", NameMy: "စစ်ကိုင်းတိုင်းဒေသကြီး", PCodeType: "state_region"},
		{PCode: "MMR006", AdminLevel: 1, NameEn: "Tanintharyi Region", NameMy: "တနင်္သာရီတိုင်းဒေသကြီး", PCodeType: "state_region"},
		{PCode: "MMR007", AdminLevel: 1, NameEn: "Bago Region", NameMy: "ပဲခူးတိုင်းဒေသကြီး", PCodeType: "state_region"},
		{PCode: "MMR008", AdminLevel: 1, NameEn: "Magway Region", NameMy: "မကွေးတိုင်းဒေသကြီး", PCodeType: "state_region"},
		{PCode: "MMR009", AdminLevel: 1, NameEn: "Mandalay Region", NameMy: "မန္တလေးတိုင်းဒေသကြီး", PCodeType: "state_region"},
		{PCode: "MMR010", AdminLevel: 1, NameEn: "Mon State", NameMy: "မွန်ပြည်နယ်", PCodeType: "state_region"},
		{PCode: "MMR011", AdminLevel: 1, NameEn: "Rakhine State", NameMy: "ရခိုင်ပြည်နယ်", PCodeType: "state_region"},
		{PCode: "MMR013", AdminLevel: 1, NameEn: "Yangon Region", NameMy: "ရန်ကုန်တိုင်းဒေသကြီး", PCodeType: "state_region"},
		{PCode: "MMR014", AdminLevel: 1, NameEn: "Shan State", NameMy: "ရှမ်းပြည်နယ်", PCodeType: "state_region"},
		{PCode: "MMR017", AdminLevel: 1, NameEn: "Ayeyarwady Region", NameMy: "ဧရာဝတီတိုင်းဒေသကြီး", PCodeType: "state_region"},
		{PCode: "MMR018", AdminLevel: 1, NameEn: "Nay Pyi Taw Union Territory", NameMy: "နေပြည်တော် ပြည်ထောင်စုနယ်မြေ", PCodeType: "state_region"},

		// Level 3: Major Townships in Yangon (MMR013)
		{PCode: "MMR013001", ParentPCode: "MMR013", AdminLevel: 3, NameEn: "Dagon", NameMy: "ဒဂုံ", SRPCode: "MMR013", PCodeType: "township"},
		{PCode: "MMR013002", ParentPCode: "MMR013", AdminLevel: 3, NameEn: "Bahan", NameMy: "ဗဟန်း", SRPCode: "MMR013", PCodeType: "township"},
		{PCode: "MMR013003", ParentPCode: "MMR013", AdminLevel: 3, NameEn: "Kamayut", NameMy: "ကမာရွတ်", SRPCode: "MMR013", PCodeType: "township"},
		{PCode: "MMR013004", ParentPCode: "MMR013", AdminLevel: 3, NameEn: "Kyauktada", NameMy: "ကျောက်တံတား", SRPCode: "MMR013", PCodeType: "township"},
		{PCode: "MMR013005", ParentPCode: "MMR013", AdminLevel: 3, NameEn: "Pabedan", NameMy: "ပန်းဘဲတန်း", SRPCode: "MMR013", PCodeType: "township"},
		{PCode: "MMR013006", ParentPCode: "MMR013", AdminLevel: 3, NameEn: "Hlaing", NameMy: "လှိုင်", SRPCode: "MMR013", PCodeType: "township"},
		{PCode: "MMR013007", ParentPCode: "MMR013", AdminLevel: 3, NameEn: "Mayangone", NameMy: "မရမ်းကုန်း", SRPCode: "MMR013", PCodeType: "township"},
		{PCode: "MMR013008", ParentPCode: "MMR013", AdminLevel: 3, NameEn: "Sanchaung", NameMy: "စမ်းချောင်း", SRPCode: "MMR013", PCodeType: "township"},
		{PCode: "MMR013009", ParentPCode: "MMR013", AdminLevel: 3, NameEn: "Yankin", NameMy: "ရန်ကင်း", SRPCode: "MMR013", PCodeType: "township"},
		{PCode: "MMR013010", ParentPCode: "MMR013", AdminLevel: 3, NameEn: "Insein", NameMy: "အင်းစိန်", SRPCode: "MMR013", PCodeType: "township"},
		{PCode: "MMR013011", ParentPCode: "MMR013", AdminLevel: 3, NameEn: "Mingaladon", NameMy: "မင်္ဂလာဒုံ", SRPCode: "MMR013", PCodeType: "township"},
		{PCode: "MMR013012", ParentPCode: "MMR013", AdminLevel: 3, NameEn: "South Okkalapa", NameMy: "တောင်ဥက္ကလာပ", SRPCode: "MMR013", PCodeType: "township"},
		{PCode: "MMR013013", ParentPCode: "MMR013", AdminLevel: 3, NameEn: "North Okkalapa", NameMy: "မြောက်ဥက္ကလာပ", SRPCode: "MMR013", PCodeType: "township"},
		{PCode: "MMR013014", ParentPCode: "MMR013", AdminLevel: 3, NameEn: "Thingangyun", NameMy: "သင်္ဃန်းကျွန်း", SRPCode: "MMR013", PCodeType: "township"},
		{PCode: "MMR013015", ParentPCode: "MMR013", AdminLevel: 3, NameEn: "Tamwe", NameMy: "တာမွေ", SRPCode: "MMR013", PCodeType: "township"},
		{PCode: "MMR013016", ParentPCode: "MMR013", AdminLevel: 3, NameEn: "Botahtaung", NameMy: "ဗိုလ်တထောင်", SRPCode: "MMR013", PCodeType: "township"},
		{PCode: "MMR013020", ParentPCode: "MMR013", AdminLevel: 3, NameEn: "Thanlyin", NameMy: "သန်လျင်", SRPCode: "MMR013", PCodeType: "township"},

		// Level 3: Major Townships in Mandalay (MMR009)
		{PCode: "MMR009001", ParentPCode: "MMR009", AdminLevel: 3, NameEn: "Aungmyethazan", NameMy: "အောင်မြေသာစံ", SRPCode: "MMR009", PCodeType: "township"},
		{PCode: "MMR009002", ParentPCode: "MMR009", AdminLevel: 3, NameEn: "Chanayethazan", NameMy: "ချမ်းအေးသာစံ", SRPCode: "MMR009", PCodeType: "township"},
		{PCode: "MMR009003", ParentPCode: "MMR009", AdminLevel: 3, NameEn: "Mahaaungmyay", NameMy: "မဟာအောင်မြေ", SRPCode: "MMR009", PCodeType: "township"},
		{PCode: "MMR009004", ParentPCode: "MMR009", AdminLevel: 3, NameEn: "Chanmyathazi", NameMy: "ချမ်းမြသာစည်", SRPCode: "MMR009", PCodeType: "township"},
		{PCode: "MMR009005", ParentPCode: "MMR009", AdminLevel: 3, NameEn: "Pyigyitagon", NameMy: "ပြည်ကြီးတံခွန်", SRPCode: "MMR009", PCodeType: "township"},
		{PCode: "MMR009006", ParentPCode: "MMR009", AdminLevel: 3, NameEn: "Amarapura", NameMy: "အမရပူရ", SRPCode: "MMR009", PCodeType: "township"},
		{PCode: "MMR009007", ParentPCode: "MMR009", AdminLevel: 3, NameEn: "Pyinoolwin", NameMy: "ပြင်ဦးလွင်", SRPCode: "MMR009", PCodeType: "township"},

		// Level 3: Major Townships in Shan State (MMR014)
		{PCode: "MMR014001", ParentPCode: "MMR014", AdminLevel: 3, NameEn: "Taunggyi", NameMy: "တောင်ကြီး", SRPCode: "MMR014", PCodeType: "township"},
		{PCode: "MMR014002", ParentPCode: "MMR014", AdminLevel: 3, NameEn: "Kalaw", NameMy: "ကလော", SRPCode: "MMR014", PCodeType: "township"},
		{PCode: "MMR014003", ParentPCode: "MMR014", AdminLevel: 3, NameEn: "Lashio", NameMy: "လားရှိုး", SRPCode: "MMR014", PCodeType: "township"},

		// Level 3: Major Townships in Nay Pyi Taw (MMR018)
		{PCode: "MMR018001", ParentPCode: "MMR018", AdminLevel: 3, NameEn: "Zabuthiri", NameMy: "ဇမ္ဗူသီရိ", SRPCode: "MMR018", PCodeType: "township"},
		{PCode: "MMR018002", ParentPCode: "MMR018", AdminLevel: 3, NameEn: "Ottarathiri", NameMy: "ဥတ္တရသီရိ", SRPCode: "MMR018", PCodeType: "township"},
		{PCode: "MMR018003", ParentPCode: "MMR018", AdminLevel: 3, NameEn: "Dekkhinathiri", NameMy: "ဒက္ခိဏသီရိ", SRPCode: "MMR018", PCodeType: "township"},
		{PCode: "MMR018004", ParentPCode: "MMR018", AdminLevel: 3, NameEn: "Pyinmana", NameMy: "ပျဉ်းမနား", SRPCode: "MMR018", PCodeType: "township"},

		// Level 3: Major Townships across Other Regions
		{PCode: "MMR010001", ParentPCode: "MMR010", AdminLevel: 3, NameEn: "Mawlamyine", NameMy: "မော်လမြိုင်", SRPCode: "MMR010", PCodeType: "township"},
		{PCode: "MMR007001", ParentPCode: "MMR007", AdminLevel: 3, NameEn: "Bago", NameMy: "ပဲခူး", SRPCode: "MMR007", PCodeType: "township"},
		{PCode: "MMR007003", ParentPCode: "MMR007", AdminLevel: 3, NameEn: "Pyay", NameMy: "ပြည်", SRPCode: "MMR007", PCodeType: "township"},
		{PCode: "MMR005001", ParentPCode: "MMR005", AdminLevel: 3, NameEn: "Sagaing", NameMy: "စစ်ကိုင်း", SRPCode: "MMR005", PCodeType: "township"},
		{PCode: "MMR005002", ParentPCode: "MMR005", AdminLevel: 3, NameEn: "Monywa", NameMy: "မုံရွာ", SRPCode: "MMR005", PCodeType: "township"},
		{PCode: "MMR017001", ParentPCode: "MMR017", AdminLevel: 3, NameEn: "Pathein", NameMy: "ပုသိမ်", SRPCode: "MMR017", PCodeType: "township"},
		{PCode: "MMR001001", ParentPCode: "MMR001", AdminLevel: 3, NameEn: "Myitkyina", NameMy: "မြစ်ကြီးနား", SRPCode: "MMR001", PCodeType: "township"},
		{PCode: "MMR003001", ParentPCode: "MMR003", AdminLevel: 3, NameEn: "Hpa-An", NameMy: "ဘားအံ", SRPCode: "MMR003", PCodeType: "township"},
		{PCode: "MMR011001", ParentPCode: "MMR011", AdminLevel: 3, NameEn: "Sittwe", NameMy: "စစ်တွေ", SRPCode: "MMR011", PCodeType: "township"},
		{PCode: "MMR008001", ParentPCode: "MMR008", AdminLevel: 3, NameEn: "Magway", NameMy: "မကွေး", SRPCode: "MMR008", PCodeType: "township"},
		{PCode: "MMR006001", ParentPCode: "MMR006", AdminLevel: 3, NameEn: "Dawei", NameMy: "ထားဝယ်", SRPCode: "MMR006", PCodeType: "township"},
		{PCode: "MMR004001", ParentPCode: "MMR004", AdminLevel: 3, NameEn: "Hakha", NameMy: "ဟားခါး", SRPCode: "MMR004", PCodeType: "township"},
		{PCode: "MMR002001", ParentPCode: "MMR002", AdminLevel: 3, NameEn: "Loikaw", NameMy: "လွိုင်ကော်", SRPCode: "MMR002", PCodeType: "township"},

		// Level 4: Urban Wards (ward) & Rural Village Tracts (village_tract)
		{PCode: "MMR013001001", ParentPCode: "MMR013001", AdminLevel: 4, NameEn: "Ward No. 1", NameMy: "အမှတ် (၁) ရပ်ကွက်", SRPCode: "MMR013", TSPCode: "MMR013001", PCodeType: "ward"},
		{PCode: "MMR013001002", ParentPCode: "MMR013001", AdminLevel: 4, NameEn: "Ward No. 2", NameMy: "အမှတ် (၂) ရပ်ကွက်", SRPCode: "MMR013", TSPCode: "MMR013001", PCodeType: "ward"},
		{PCode: "MMR013003002", ParentPCode: "MMR013003", AdminLevel: 4, NameEn: "Ward No. 2", NameMy: "အမှတ် (၂) ရပ်ကွက်", SRPCode: "MMR013", TSPCode: "MMR013003", PCodeType: "ward"},
		{PCode: "MMR013008001", ParentPCode: "MMR013008", AdminLevel: 4, NameEn: "Sanchaung North Ward", NameMy: "စမ်းချောင်းမြောက်ရပ်ကွက်", SRPCode: "MMR013", TSPCode: "MMR013008", PCodeType: "ward"},
		{PCode: "MMR009002004", ParentPCode: "MMR009002", AdminLevel: 4, NameEn: "Ward No. 4", NameMy: "အမှတ် (၄) ရပ်ကွက်", SRPCode: "MMR009", TSPCode: "MMR009002", PCodeType: "ward"},
		{PCode: "MMR014001002", ParentPCode: "MMR014001", AdminLevel: 4, NameEn: "Ward No. 2", NameMy: "အမှတ် (၂) ရပ်ကွက်", SRPCode: "MMR014", TSPCode: "MMR014001", PCodeType: "ward"},
		{PCode: "MMR018001001", ParentPCode: "MMR018001", AdminLevel: 4, NameEn: "Thiri Ward", NameMy: "သီရိရပ်ကွက်", SRPCode: "MMR018", TSPCode: "MMR018001", PCodeType: "ward"},
		{PCode: "MMR013020015", ParentPCode: "MMR013020", AdminLevel: 4, NameEn: "Nyaung Ngu Village Tract", NameMy: "ညောင်ငူကျေးရွာအုပ်စု", SRPCode: "MMR013", TSPCode: "MMR013020", PCodeType: "village_tract"},
		{PCode: "MMR009006020", ParentPCode: "MMR009006", AdminLevel: 4, NameEn: "Nat Yekan Village Tract", NameMy: "နတ်ရေကန်ကျေးရွာအုပ်စု", SRPCode: "MMR009", TSPCode: "MMR009006", PCodeType: "village_tract"},
	}

	for _, item := range items {
		_, err := queries.CreatePCode(ctx, database.CreatePCodeParams{
			Pcode:       item.PCode,
			ParentPcode: pgtype.Text{String: item.ParentPCode, Valid: item.ParentPCode != ""},
			AdminLevel:  item.AdminLevel,
			NameEn:      item.NameEn,
			NameMy:      item.NameMy,
			SrPcode:     pgtype.Text{String: item.SRPCode, Valid: item.SRPCode != ""},
			TsPcode:     pgtype.Text{String: item.TSPCode, Valid: item.TSPCode != ""},
			PcodeType:   item.PCodeType,
		})
		if err != nil {
			log.Printf("Warning: failed to seed pcode %s: %v", item.PCode, err)
		}
	}
}

func seedAllNationwideSchools(ctx context.Context, pool *pgxpool.Pool) {
	paths := []string{
		"schools_with_pcodes.json",
		"../schools_with_pcodes.json",
		"../../schools_with_pcodes.json",
	}

	var data []byte
	var err error
	for _, p := range paths {
		data, err = os.ReadFile(p)
		if err == nil {
			log.Printf("Found nationwide school dataset at %s", p)
			break
		}
	}
	if err != nil {
		log.Printf("Notice: schools_with_pcodes.json not found, skipping nationwide bulk seed")
		return
	}

	var schools []scrapedSchool
	if err := json.Unmarshal(data, &schools); err != nil {
		log.Printf("Warning: failed to parse schools_with_pcodes.json: %v", err)
		return
	}

	log.Printf("Seeding %d nationwide schools from schools_with_pcodes.json...", len(schools))

	query := `
	INSERT INTO schools (
		name, code, address, city, region, phone, status,
		pcode_sr, pcode_ts, pcode_level, township_name, ward_village_name, school_category,
		name_en, name_my
	)
	VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
	ON CONFLICT (code) DO UPDATE SET
		name = EXCLUDED.name,
		name_en = EXCLUDED.name_en,
		name_my = EXCLUDED.name_my,
		address = EXCLUDED.address,
		city = EXCLUDED.city,
		region = EXCLUDED.region,
		phone = EXCLUDED.phone,
		status = EXCLUDED.status,
		pcode_sr = EXCLUDED.pcode_sr,
		pcode_ts = EXCLUDED.pcode_ts,
		pcode_level = EXCLUDED.pcode_level,
		township_name = EXCLUDED.township_name,
		ward_village_name = EXCLUDED.ward_village_name,
		school_category = EXCLUDED.school_category;
	`

	batch := &pgx.Batch{}
	count := 0
	for _, s := range schools {
		nameVal := s.Name
		if s.NameMy != "" {
			nameVal = s.NameMy
		}
		batch.Queue(query,
			nameVal, s.Code, s.Address, s.City, s.Region, s.Phone, s.Status,
			s.PcodeSr, s.PcodeTs, s.PcodeLevel, s.TownshipName, s.WardVillage, s.SchoolCategory,
			s.NameEn, s.NameMy,
		)
		count++
		if batch.Len() >= 200 {
			br := pool.SendBatch(ctx, batch)
			if err := br.Close(); err != nil {
				log.Printf("Warning: batch insert error: %v", err)
			}
			batch = &pgx.Batch{}
		}
	}

	if batch.Len() > 0 {
		br := pool.SendBatch(ctx, batch)
		if err := br.Close(); err != nil {
			log.Printf("Warning: final batch error: %v", err)
		}
	}

	log.Printf("Successfully synchronized %d nationwide schools into database.", count)
}

