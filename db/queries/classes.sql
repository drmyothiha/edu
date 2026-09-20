-- name: CreateClass :one
INSERT INTO classes (name, grade_level, teacher_id, academic_year, school_id)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;

-- name: GetClassByID :one
SELECT *
FROM classes
WHERE id = $1;

-- name: ListClasses :many
SELECT *
FROM classes
ORDER BY name ASC;

-- name: ListClassesBySchool :many
SELECT *
FROM classes
WHERE school_id = $1
ORDER BY name ASC;

-- name: ListClassesByTeacher :many
SELECT *
FROM classes
WHERE teacher_id = $1
ORDER BY name ASC;

-- name: CountClassesBySchool :one
SELECT COUNT(*)::bigint AS total_classes
FROM classes
WHERE school_id = $1;

-- name: UpdateClass :one
UPDATE classes
SET name = COALESCE($2, name),
    grade_level = COALESCE($3, grade_level),
    academic_year = COALESCE($4, academic_year)
WHERE id = $1
RETURNING *;

-- name: DeleteClass :exec
DELETE FROM classes
WHERE id = $1;
