-- name: CreateLessonPlan :one
INSERT INTO lesson_plans (teacher_id, subject, grade_level, topic, duration_minutes, generated_markdown)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING id, teacher_id, subject, grade_level, topic, duration_minutes, generated_markdown, created_at;

-- name: GetLessonPlanByID :one
SELECT id, teacher_id, subject, grade_level, topic, duration_minutes, generated_markdown, created_at
FROM lesson_plans
WHERE id = $1;

-- name: ListLessonPlansByTeacherID :many
SELECT id, teacher_id, subject, grade_level, topic, duration_minutes, generated_markdown, created_at
FROM lesson_plans
WHERE teacher_id = $1
ORDER BY created_at DESC;

-- name: DeleteLessonPlan :exec
DELETE FROM lesson_plans
WHERE id = $1;
