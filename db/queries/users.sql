-- name: CreateUser :one
INSERT INTO users (email, password_hash, full_name, role, school_id)
VALUES ($1, $2, $3, $4, $5)
RETURNING id, email, password_hash, full_name, role, school_id, created_at;

-- name: GetUserByID :one
SELECT id, email, password_hash, full_name, role, school_id, created_at,
       did, blockchain_address, public_key, credential_hash, merkle_root, blockchain_tx_hash, anchor_status,
       parent_id
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

-- name: ListStudentsByParentID :many
WITH latest_enrollments AS (
    SELECT DISTINCT ON (student_id) student_id, class_id, enrolled_at
    FROM class_enrollments
    ORDER BY student_id, enrolled_at DESC
)
SELECT u.id, u.email, u.full_name, u.role, u.school_id, u.created_at,
       u.did, u.blockchain_address, u.public_key, u.credential_hash, u.merkle_root, u.blockchain_tx_hash, u.anchor_status,
       c.id as class_id, c.name as class_name, c.grade_level,
       COALESCE(NULLIF(s.name_my, ''), s.name) as school_name,
       s.name_en as school_name_en, s.name_my as school_name_my,
       s.code as school_code, s.region as school_region, s.township_name as school_township
FROM users u
LEFT JOIN latest_enrollments le ON le.student_id = u.id
LEFT JOIN classes c ON c.id = le.class_id
LEFT JOIN schools s ON s.id = u.school_id
WHERE u.parent_id = $1 AND u.role = 'student'
ORDER BY 
    CASE WHEN c.grade_level = 'KG' THEN 0 ELSE 1 END,
    c.grade_level ASC,
    u.full_name ASC;

-- name: LinkStudentToParent :exec
UPDATE users
SET parent_id = $2
WHERE id = $1;

-- name: ListStudentsBySchool :many
WITH latest_enrollments AS (
    SELECT DISTINCT ON (student_id) student_id, class_id, enrolled_at
    FROM class_enrollments
    ORDER BY student_id, enrolled_at DESC
)
SELECT u.id, u.email, u.full_name, u.role, u.school_id, u.created_at,
       c.id as class_id, c.name as class_name, c.grade_level,
       COALESCE(NULLIF(s.name_my, ''), s.name) as school_name
FROM users u
LEFT JOIN latest_enrollments le ON le.student_id = u.id
LEFT JOIN classes c ON c.id = le.class_id
LEFT JOIN schools s ON s.id = u.school_id
WHERE u.school_id = $1 AND u.role = 'student'
ORDER BY 
    CASE 
        WHEN c.grade_level = 'KG' THEN 0
        WHEN c.grade_level = 'Grade 1' THEN 1
        WHEN c.grade_level = 'Grade 2' THEN 2
        WHEN c.grade_level = 'Grade 3' THEN 3
        WHEN c.grade_level = 'Grade 4' THEN 4
        WHEN c.grade_level = 'Grade 5' THEN 5
        WHEN c.grade_level = 'Grade 6' THEN 6
        WHEN c.grade_level = 'Grade 7' THEN 7
        WHEN c.grade_level = 'Grade 8' THEN 8
        WHEN c.grade_level = 'Grade 9' THEN 9
        WHEN c.grade_level = 'Grade 10' THEN 10
        WHEN c.grade_level = 'Grade 11' THEN 11
        WHEN c.grade_level = 'Grade 12' THEN 12
        ELSE 13
    END,
    c.name ASC,
    u.full_name ASC;

-- name: GetUserProfileByID :one
SELECT u.id, u.email, u.password_hash, u.full_name, u.role, u.school_id, u.created_at,
       u.did, u.blockchain_address, u.public_key, u.credential_hash, u.merkle_root, u.blockchain_tx_hash, u.anchor_status,
       u.parent_id, u.avatar_url, u.phone, u.bio,
       COALESCE(s.name_my, s.name, '') as school_name,
       COALESCE(s.name_en, '') as school_name_en,
       COALESCE(s.code, '') as school_code,
       COALESCE(s.region, '') as school_region,
       COALESCE(s.township_name, '') as school_township
FROM users u
LEFT JOIN schools s ON s.id = u.school_id
WHERE u.id = $1;

-- name: UpdateUserProfile :one
UPDATE users
SET full_name = COALESCE($2, full_name),
    email = COALESCE($3, email),
    avatar_url = CASE WHEN $4::boolean THEN $5::text ELSE avatar_url END,
    phone = CASE WHEN $6::boolean THEN $7::text ELSE phone END,
    bio = CASE WHEN $8::boolean THEN $9::text ELSE bio END
WHERE id = $1
RETURNING id, email, password_hash, full_name, role, school_id, created_at, avatar_url, phone, bio;

-- name: UpdateUserPassword :exec
UPDATE users
SET password_hash = $2
WHERE id = $1;


