-- name: CreateEnrollment :one
INSERT INTO class_enrollments (class_id, student_id)
VALUES ($1, $2)
ON CONFLICT (class_id, student_id) DO UPDATE
SET enrolled_at = class_enrollments.enrolled_at
RETURNING id, class_id, student_id, enrolled_at;

-- name: DeleteEnrollment :exec
DELETE FROM class_enrollments
WHERE class_id = $1 AND student_id = $2;

-- name: ListStudentsByClassID :many
SELECT u.id, u.email, u.full_name, u.role, ce.enrolled_at
FROM class_enrollments ce
JOIN users u ON ce.student_id = u.id
WHERE ce.class_id = $1
ORDER BY u.full_name ASC;

-- name: ListClassesByStudentID :many
SELECT c.id, c.name, c.grade_level, c.teacher_id, c.academic_year, c.created_at, ce.enrolled_at
FROM class_enrollments ce
JOIN classes c ON ce.class_id = c.id
WHERE ce.student_id = $1
ORDER BY c.name ASC;

-- name: IsStudentEnrolled :one
SELECT EXISTS (
    SELECT 1 FROM class_enrollments
    WHERE class_id = $1 AND student_id = $2
) AS enrolled;
