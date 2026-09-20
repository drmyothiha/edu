-- name: CreateSchool :one
INSERT INTO schools (
    name, code, address, city, region, phone, status,
    pcode_sr, pcode_ts, pcode_ward_vt, pcode_level, township_name, ward_village_name, school_category
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
RETURNING *;

-- name: GetSchoolByID :one
SELECT *
FROM schools
WHERE id = $1;

-- name: GetSchoolByCode :one
SELECT *
FROM schools
WHERE code = $1;

-- name: ListSchools :many
SELECT *
FROM schools
ORDER BY name ASC;

-- name: ListSchoolsByPCodeSR :many
SELECT *
FROM schools
WHERE pcode_sr = $1
ORDER BY name ASC;

-- name: ListSchoolsByPCodeTS :many
SELECT *
FROM schools
WHERE pcode_ts = $1
ORDER BY name ASC;

-- name: UpdateSchool :one
UPDATE schools
SET name = COALESCE($2, name),
    address = COALESCE($3, address),
    city = COALESCE($4, city),
    region = COALESCE($5, region),
    phone = COALESCE($6, phone),
    status = COALESCE($7, status),
    pcode_sr = COALESCE($8, pcode_sr),
    pcode_ts = COALESCE($9, pcode_ts),
    pcode_ward_vt = COALESCE($10, pcode_ward_vt),
    pcode_level = COALESCE($11, pcode_level),
    township_name = COALESCE($12, township_name),
    ward_village_name = COALESCE($13, ward_village_name),
    school_category = COALESCE($14, school_category)
WHERE id = $1
RETURNING *;

-- name: DeleteSchool :exec
DELETE FROM schools
WHERE id = $1;

-- name: CountSchools :one
SELECT COUNT(*)::bigint AS total_schools
FROM schools;
