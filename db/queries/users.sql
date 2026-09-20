-- name: CreateUser :one
INSERT INTO users (email, password_hash, full_name, role)
VALUES ($1, $2, $3, $4)
RETURNING id, email, password_hash, full_name, role, created_at;

-- name: GetUserByID :one
SELECT id, email, password_hash, full_name, role, created_at
FROM users
WHERE id = $1;

-- name: GetUserByEmail :one
SELECT id, email, password_hash, full_name, role, created_at
FROM users
WHERE email = $1;

-- name: ListUsers :many
SELECT id, email, full_name, role, created_at
FROM users
ORDER BY created_at DESC;

-- name: ListUsersByRole :many
SELECT id, email, full_name, role, created_at
FROM users
WHERE role = $1
ORDER BY full_name ASC;

-- name: UpdateUser :one
UPDATE users
SET full_name = COALESCE($2, full_name),
    email = COALESCE($3, email)
WHERE id = $1
RETURNING id, email, password_hash, full_name, role, created_at;

-- name: DeleteUser :exec
DELETE FROM users
WHERE id = $1;
