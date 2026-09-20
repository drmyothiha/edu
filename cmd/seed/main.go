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

func main() {
	cfg := config.Load()
	ctx := context.Background()

	pool, err := database.NewPool(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer pool.Close()

	// Apply migrations
	log.Println("Applying schema migrations...")
	if err := database.RunMigrations(ctx, pool, "db/migrations"); err != nil {
		log.Fatalf("Migration failed: %v", err)
	}

	queries := database.New(pool)

	log.Println("Seeding users...")
	adminHash, _ := auth.HashPassword("Admin123!")
	teacherHash, _ := auth.HashPassword("Teacher123!")
	studentHash, _ := auth.HashPassword("Student123!")
	parentHash, _ := auth.HashPassword("Parent123!")

	// 1. Admin
	admin, err := queries.CreateUser(ctx, database.CreateUserParams{
		Email:        "admin@edu.local",
		PasswordHash: adminHash,
		FullName:     "System Administrator",
		Role:         "admin",
	})
	if err != nil {
		admin, _ = queries.GetUserByEmail(ctx, "admin@edu.local")
	}
	log.Printf("Admin user ready: %s (%s)", admin.Email, admin.ID)

	// 2. Teachers
	teacherSmith, err := queries.CreateUser(ctx, database.CreateUserParams{
		Email:        "teacher.smith@edu.local",
		PasswordHash: teacherHash,
		FullName:     "Sarah Smith",
		Role:         "teacher",
	})
	if err != nil {
		teacherSmith, _ = queries.GetUserByEmail(ctx, "teacher.smith@edu.local")
	}

	teacherJohnson, err := queries.CreateUser(ctx, database.CreateUserParams{
		Email:        "teacher.johnson@edu.local",
		PasswordHash: teacherHash,
		FullName:     "David Johnson",
		Role:         "teacher",
	})
	if err != nil {
		teacherJohnson, _ = queries.GetUserByEmail(ctx, "teacher.johnson@edu.local")
	}
	log.Printf("Teachers ready: %s, %s", teacherSmith.Email, teacherJohnson.Email)

	// 3. Students
	studentAlice, err := queries.CreateUser(ctx, database.CreateUserParams{
		Email:        "student.alice@edu.local",
		PasswordHash: studentHash,
		FullName:     "Alice Walker",
		Role:         "student",
	})
	if err != nil {
		studentAlice, _ = queries.GetUserByEmail(ctx, "student.alice@edu.local")
	}

	studentBob, err := queries.CreateUser(ctx, database.CreateUserParams{
		Email:        "student.bob@edu.local",
		PasswordHash: studentHash,
		FullName:     "Bob Miller",
		Role:         "student",
	})
	if err != nil {
		studentBob, _ = queries.GetUserByEmail(ctx, "student.bob@edu.local")
	}

	studentCharlie, err := queries.CreateUser(ctx, database.CreateUserParams{
		Email:        "student.charlie@edu.local",
		PasswordHash: studentHash,
		FullName:     "Charlie Davis",
		Role:         "student",
	})
	if err != nil {
		studentCharlie, _ = queries.GetUserByEmail(ctx, "student.charlie@edu.local")
	}
	log.Printf("Students ready: %s, %s, %s", studentAlice.Email, studentBob.Email, studentCharlie.Email)

	// 4. Parent
	parentClark, err := queries.CreateUser(ctx, database.CreateUserParams{
		Email:        "parent.clark@edu.local",
		PasswordHash: parentHash,
		FullName:     "Eleanor Clark",
		Role:         "parent",
	})
	if err != nil {
		parentClark, _ = queries.GetUserByEmail(ctx, "parent.clark@edu.local")
	}
	log.Printf("Parent ready: %s", parentClark.Email)

	// 5. Classes
	mathClass, err := queries.CreateClass(ctx, database.CreateClassParams{
		Name:         "Grade 8 Mathematics",
		GradeLevel:   "Grade 8",
		TeacherID:    teacherSmith.ID,
		AcademicYear: "2026-2027",
	})
	if err != nil {
		classes, _ := queries.ListClassesByTeacher(ctx, teacherSmith.ID)
		if len(classes) > 0 {
			mathClass = classes[0]
		}
	}

	scienceClass, err := queries.CreateClass(ctx, database.CreateClassParams{
		Name:         "Grade 8 General Science",
		GradeLevel:   "Grade 8",
		TeacherID:    teacherJohnson.ID,
		AcademicYear: "2026-2027",
	})
	if err != nil {
		classes, _ := queries.ListClassesByTeacher(ctx, teacherJohnson.ID)
		if len(classes) > 0 {
			scienceClass = classes[0]
		}
	}
	log.Printf("Classes ready: %s (%s), %s (%s)", mathClass.Name, mathClass.ID, scienceClass.Name, scienceClass.ID)

	// 6. Enrollments
	_, _ = queries.CreateEnrollment(ctx, database.CreateEnrollmentParams{ClassID: mathClass.ID, StudentID: studentAlice.ID})
	_, _ = queries.CreateEnrollment(ctx, database.CreateEnrollmentParams{ClassID: mathClass.ID, StudentID: studentBob.ID})
	_, _ = queries.CreateEnrollment(ctx, database.CreateEnrollmentParams{ClassID: mathClass.ID, StudentID: studentCharlie.ID})

	_, _ = queries.CreateEnrollment(ctx, database.CreateEnrollmentParams{ClassID: scienceClass.ID, StudentID: studentAlice.ID})
	_, _ = queries.CreateEnrollment(ctx, database.CreateEnrollmentParams{ClassID: scienceClass.ID, StudentID: studentBob.ID})
	log.Println("Enrollments created successfully")

	// 7. Attendance records
	today := time.Now().Truncate(24 * time.Hour)
	yesterday := today.AddDate(0, 0, -1)

	_, _ = queries.UpsertAttendance(ctx, database.UpsertAttendanceParams{
		ClassID:   mathClass.ID,
		StudentID: studentAlice.ID,
		Date:      pgtype.Date{Time: today, Valid: true},
		Status:    "present",
		Notes:     "Attentive and participated in discussion",
	})
	_, _ = queries.UpsertAttendance(ctx, database.UpsertAttendanceParams{
		ClassID:   mathClass.ID,
		StudentID: studentBob.ID,
		Date:      pgtype.Date{Time: today, Valid: true},
		Status:    "late",
		Notes:     "Arrived 10 mins late with excuse pass",
	})
	_, _ = queries.UpsertAttendance(ctx, database.UpsertAttendanceParams{
		ClassID:   mathClass.ID,
		StudentID: studentAlice.ID,
		Date:      pgtype.Date{Time: yesterday, Valid: true},
		Status:    "present",
		Notes:     "",
	})
	log.Println("Sample attendance records inserted")

	// 8. Assignments
	mathAssignment, err := queries.CreateAssignment(ctx, database.CreateAssignmentParams{
		ClassID:     mathClass.ID,
		Title:       "Pythagorean Theorem Problem Set",
		Description: "Complete exercises 1 through 15 on page 142 of the textbook.",
		DueDate:     pgtype.Timestamptz{Time: time.Now().Add(5 * 24 * time.Hour), Valid: true},
		MaxScore:    100,
	})
	if err == nil {
		log.Printf("Assignment created: %s (%s)", mathAssignment.Title, mathAssignment.ID)

		// Student Alice submits
		_, _ = queries.UpsertSubmission(ctx, database.UpsertSubmissionParams{
			AssignmentID: mathAssignment.ID,
			StudentID:    studentAlice.ID,
			Status:       "submitted",
		})
	}

	scienceAssignment, err := queries.CreateAssignment(ctx, database.CreateAssignmentParams{
		ClassID:     scienceClass.ID,
		Title:       "Cell Structure and Function Lab Report",
		Description: "Write a 2-page report detailing microscopic observations of plant vs animal cells.",
		DueDate:     pgtype.Timestamptz{Time: time.Now().Add(7 * 24 * time.Hour), Valid: true},
		MaxScore:    100,
	})
	if err == nil {
		log.Printf("Assignment created: %s (%s)", scienceAssignment.Title, scienceAssignment.ID)
	}

	// 9. Lesson Plan
	_, _ = queries.CreateLessonPlan(ctx, database.CreateLessonPlanParams{
		TeacherID:         teacherSmith.ID,
		Subject:           "Mathematics",
		GradeLevel:        "Grade 8",
		Topic:             "Pythagorean Theorem",
		DurationMinutes:   45,
		GeneratedMarkdown: "# Lesson Plan: Pythagorean Theorem\n\n## 1. Learning Objectives\n- Understand a^2 + b^2 = c^2.\n\n## 2. Activities\n- Hands-on square triangle modeling.",
	})
	log.Println("Sample lesson plan created")

	fmt.Println("\n=== SEEDING COMPLETED SUCCESSFULLY ===")
	fmt.Println("Test accounts:")
	fmt.Println("  Teacher: teacher.smith@edu.local / Teacher123!")
	fmt.Println("  Teacher: teacher.johnson@edu.local / Teacher123!")
	fmt.Println("  Student: student.alice@edu.local / Student123!")
	fmt.Println("  Student: student.bob@edu.local / Student123!")
	fmt.Println("  Parent:  parent.clark@edu.local / Parent123!")
	fmt.Println("  Admin:   admin@edu.local / Admin123!")
}
