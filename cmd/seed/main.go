package main

import (
	"context"
	"fmt"
	"log"
	"time"

	"edu-platform/internal/auth"
	"edu-platform/internal/config"
	"edu-platform/internal/database"

	"github.com/jackc/pgx/v5/pgtype"
)

type pcodeItem struct {
	PCode       string
	ParentPCode string
	AdminLevel  int32
	NameEn      string
	NameMy      string
	SRPCode     string
	TSPCode     string
	PCodeType   string
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
	seedMyanmarPCodes(ctx, queries)

	// 2. Seed Well-Known Prestigious Schools using Option A: {pcode_ward_vt}-{category}{seq}
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
		Code:            "MMR013001001-HS01",
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
		SchoolCategory:  pgtype.Text{String: "HS", Valid: true},
	})

	// Yangon: BEHS 2 Kamayut (St. Augustine)
	behs2Kamayut := seedSchool(ctx, queries, database.CreateSchoolParams{
		Name:            "Basic Education High School No. 2 Kamayut (အ.ထ.က ၂ ကမာရွတ်)",
		Code:            "MMR013003002-HS02",
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
		SchoolCategory:  pgtype.Text{String: "HS", Valid: true},
	})

	// Mandalay: BEHS 16 Mandalay
	behs16Mdy := seedSchool(ctx, queries, database.CreateSchoolParams{
		Name:            "Basic Education High School No. 16 Mandalay (အ.ထ.က ၁၆ မန္တလေး)",
		Code:            "MMR009002004-HS16",
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
		SchoolCategory:  pgtype.Text{String: "HS", Valid: true},
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
		Code:            "MMR018001001-HS01",
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
		SchoolCategory:  pgtype.Text{String: "HS", Valid: true},
	})

	log.Printf("Schools ready with Option A P-Codes: %s (%s), %s (%s), %s (%s), %s (%s)",
		ygnAcademy.Name, ygnAcademy.Code,
		behs1Dagon.Name, behs1Dagon.Code,
		behs16Mdy.Name, behs16Mdy.Code,
		behs1Npt.Name, behs1Npt.Code,
	)

	ygnSchoolUUID := pgtype.UUID{Bytes: [16]byte(ygnAcademy.ID), Valid: true}
	mdySchoolUUID := pgtype.UUID{Bytes: [16]byte(mdyTech.ID), Valid: true}
	tgiSchoolUUID := pgtype.UUID{Bytes: [16]byte(tgiHigh.ID), Valid: true}
	nptSchoolUUID := pgtype.UUID{Bytes: [16]byte(behs1Npt.ID), Valid: true}

	// 3. User Accounts (Nationwide Hubs: Yangon, Mandalay, Shan, Nay Pyi Taw)
	log.Println("Seeding role-based user hierarchy for key nationwide educational hubs...")
	sysAdminHash, _ := auth.HashPassword("SysAdmin123!")
	schoolAdminHash, _ := auth.HashPassword("Admin123!")
	teacherHash, _ := auth.HashPassword("Teacher123!")
	studentHash, _ := auth.HashPassword("Student123!")
	parentHash, _ := auth.HashPassword("Parent123!")

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
	fmt.Printf("  3. %s [%s] - %s, %s\n", behs2Kamayut.Name, behs2Kamayut.Code, behs2Kamayut.City, behs2Kamayut.Region)
	fmt.Printf("  4. %s [%s] - %s, %s\n", behs16Mdy.Name, behs16Mdy.Code, behs16Mdy.City, behs16Mdy.Region)
	fmt.Printf("  5. %s [%s] - %s, %s\n", mdyTech.Name, mdyTech.Code, mdyTech.City, mdyTech.Region)
	fmt.Printf("  6. %s [%s] - %s, %s\n", tgiHigh.Name, tgiHigh.Code, tgiHigh.City, tgiHigh.Region)
	fmt.Printf("  7. %s [%s] - %s, %s\n", behs1Npt.Name, behs1Npt.Code, behs1Npt.City, behs1Npt.Region)
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

func seedMyanmarPCodes(ctx context.Context, queries *database.Queries) {
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
