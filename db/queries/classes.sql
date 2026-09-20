-- name: CreateClass :one
INSERT INTO classes (name, grade_level, teacher_id, academic_year)
VALUES ($1, $2, $3, $4)
RETURNING id, name, grade_level, teacher_id, academic_year, created_at;

-- name: GetClassByID :one
SELECT id, name, grade_level, teacher_id, academic_year, created_at
FROM classes
WHERE id = $1;

-- name: ListClasses :many
SELECT id, name, grade_level, teacher_id, academic_year, created_at
FROM classes
ORDER BY name ASC;

-- name: ListClassesByTeacher :many
SELECT id, name, grade_level, teacher_id, academic_year, created_at
FROM classes
WHERE teacher_id = $1
ORDER BY name ASC;

-- name: UpdateClass :one
UPDATE classes
SET name = COALESCE($2, name),
    grade_level = COALESCE($3, grade_level),
    academic_year = COALESCE($4, academic_year)
WHERE id = $1
RETURNING id, name, grade_level, teacher_id, academic_year, created_at;

-- name: DeleteClass :exec
DELETE FROM classes
WHERE id = $1;
