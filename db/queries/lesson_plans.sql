-- name: CreateLessonPlan :one
INSERT INTO lesson_plans (teacher_id, subject, grade_level, topic, duration_minutes, generated_markdown, generated_markdown_burmese)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING *;

-- name: GetLessonPlanByID :one
SELECT *
FROM lesson_plans
WHERE id = $1;

-- name: ListLessonPlansByTeacherID :many
SELECT *
FROM lesson_plans
WHERE teacher_id = $1
ORDER BY created_at DESC;

-- name: UpdateLessonPlanBurmese :one
UPDATE lesson_plans
SET generated_markdown_burmese = $2
WHERE id = $1
RETURNING *;

-- name: DeleteLessonPlan :exec
DELETE FROM lesson_plans
WHERE id = $1;
