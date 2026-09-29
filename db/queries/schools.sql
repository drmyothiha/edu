-- name: CreateSchool :one
INSERT INTO schools (
    name, code, address, city, region, phone, status,
    pcode_sr, pcode_ts, pcode_ward_vt, pcode_level, township_name, ward_village_name, school_category,
    name_en, name_my
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
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
    school_category = COALESCE($14, school_category),
    name_en = COALESCE($15, name_en),
    name_my = COALESCE($16, name_my)
WHERE id = $1
RETURNING *;

-- name: DeleteSchool :exec
DELETE FROM schools
WHERE id = $1;

-- name: CountSchools :one
SELECT COUNT(*)::bigint AS total_schools
FROM schools;

-- name: ListSchoolsPaginated :many
SELECT *
FROM schools
WHERE
    (sqlc.narg('search')::text IS NULL OR name ILIKE '%' || sqlc.narg('search')::text || '%' OR name_en ILIKE '%' || sqlc.narg('search')::text || '%' OR name_my ILIKE '%' || sqlc.narg('search')::text || '%' OR code ILIKE '%' || sqlc.narg('search')::text || '%' OR city ILIKE '%' || sqlc.narg('search')::text || '%' OR township_name ILIKE '%' || sqlc.narg('search')::text || '%')
    AND (sqlc.narg('region')::text IS NULL OR region ILIKE '%' || sqlc.narg('region')::text || '%' OR pcode_sr = sqlc.narg('region')::text)
    AND (sqlc.narg('pcode_sr')::text IS NULL OR pcode_sr = sqlc.narg('pcode_sr')::text)
    AND (sqlc.narg('pcode_ts')::text IS NULL OR pcode_ts = sqlc.narg('pcode_ts')::text)
    AND (sqlc.narg('category')::text IS NULL OR school_category = sqlc.narg('category')::text)
ORDER BY name ASC
LIMIT $1 OFFSET $2;

-- name: CountSchoolsFiltered :one
SELECT COUNT(*)::bigint AS total_count
FROM schools
WHERE
    (sqlc.narg('search')::text IS NULL OR name ILIKE '%' || sqlc.narg('search')::text || '%' OR name_en ILIKE '%' || sqlc.narg('search')::text || '%' OR name_my ILIKE '%' || sqlc.narg('search')::text || '%' OR code ILIKE '%' || sqlc.narg('search')::text || '%' OR city ILIKE '%' || sqlc.narg('search')::text || '%' OR township_name ILIKE '%' || sqlc.narg('search')::text || '%')
    AND (sqlc.narg('region')::text IS NULL OR region ILIKE '%' || sqlc.narg('region')::text || '%' OR pcode_sr = sqlc.narg('region')::text)
    AND (sqlc.narg('pcode_sr')::text IS NULL OR pcode_sr = sqlc.narg('pcode_sr')::text)
    AND (sqlc.narg('pcode_ts')::text IS NULL OR pcode_ts = sqlc.narg('pcode_ts')::text)
    AND (sqlc.narg('category')::text IS NULL OR school_category = sqlc.narg('category')::text);

