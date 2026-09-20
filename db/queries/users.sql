-- name: CreateUser :one
INSERT INTO users (email, password_hash, full_name, role, school_id)
VALUES ($1, $2, $3, $4, $5)
RETURNING id, email, password_hash, full_name, role, school_id, created_at;

-- name: GetUserByID :one
SELECT id, email, password_hash, full_name, role, school_id, created_at
FROM users
WHERE id = $1;

-- name: GetUserByEmail :one
SELECT id, email, password_hash, full_name, role, school_id, created_at
FROM users
WHERE email = $1;

-- name: ListUsers :many
SELECT id, email, full_name, role, school_id, created_at
FROM users
ORDER BY created_at DESC;

-- name: ListUsersByRole :many
SELECT id, email, full_name, role, school_id, created_at
FROM users
WHERE role = $1
ORDER BY full_name ASC;

-- name: ListUsersBySchool :many
SELECT id, email, full_name, role, school_id, created_at
FROM users
WHERE school_id = $1
ORDER BY full_name ASC;

-- name: ListUsersBySchoolAndRole :many
SELECT id, email, full_name, role, school_id, created_at
FROM users
WHERE school_id = $1 AND role = $2
ORDER BY full_name ASC;

-- name: CountUsersBySchoolAndRole :one
SELECT COUNT(*)::bigint AS total
FROM users
WHERE school_id = $1 AND role = $2;

-- name: UpdateUser :one
UPDATE users
SET full_name = COALESCE($2, full_name),
    email = COALESCE($3, email),
    school_id = COALESCE($4, school_id)
WHERE id = $1
RETURNING id, email, password_hash, full_name, role, school_id, created_at;

-- name: DeleteUser :exec
DELETE FROM users
WHERE id = $1;
