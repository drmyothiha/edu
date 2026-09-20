-- name: CreatePCode :one
INSERT INTO mimu_pcodes (
    pcode, parent_pcode, admin_level, name_en, name_my, sr_pcode, ts_pcode, pcode_type
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
ON CONFLICT (pcode) DO UPDATE SET
    name_en = EXCLUDED.name_en,
    name_my = EXCLUDED.name_my
RETURNING *;

-- name: GetPCode :one
SELECT *
FROM mimu_pcodes
WHERE pcode = $1;

-- name: ListStateRegions :many
SELECT *
FROM mimu_pcodes
WHERE admin_level = 1
ORDER BY name_en ASC;

-- name: ListTownshipsBySR :many
SELECT *
FROM mimu_pcodes
WHERE admin_level = 3 AND sr_pcode = $1
ORDER BY name_en ASC;

-- name: ListWardsByTownship :many
SELECT *
FROM mimu_pcodes
WHERE admin_level = 4 AND ts_pcode = $1
ORDER BY name_en ASC;

-- name: SearchPCodes :many
SELECT *
FROM mimu_pcodes
WHERE name_en ILIKE '%' || $1 || '%' OR name_my ILIKE '%' || $1 || '%' OR pcode ILIKE '%' || $1 || '%'
ORDER BY admin_level ASC, name_en ASC
LIMIT 50;

-- name: CountPCodes :one
SELECT COUNT(*)::bigint AS total_pcodes
FROM mimu_pcodes;
