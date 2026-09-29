-- name: UpsertWholeChildProfile :one
INSERT INTO whole_child_profiles (
    student_id,
    school_id,
    class_id,
    academic_year,
    period,
    attendance_rate_pct,
    academic_profile,
    physical_growth_profile,
    health_visibility_profile,
    wellbeing_profile,
    social_citizenship_profile,
    sync_source,
    sync_record_hash,
    updated_at
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW()
)
ON CONFLICT (student_id, period) DO UPDATE
SET 
    school_id = EXCLUDED.school_id,
    class_id = EXCLUDED.class_id,
    academic_year = EXCLUDED.academic_year,
    attendance_rate_pct = EXCLUDED.attendance_rate_pct,
    academic_profile = EXCLUDED.academic_profile,
    physical_growth_profile = EXCLUDED.physical_growth_profile,
    health_visibility_profile = EXCLUDED.health_visibility_profile,
    wellbeing_profile = EXCLUDED.wellbeing_profile,
    social_citizenship_profile = EXCLUDED.social_citizenship_profile,
    sync_source = EXCLUDED.sync_source,
    sync_record_hash = EXCLUDED.sync_record_hash,
    updated_at = NOW()
RETURNING *;

-- name: GetWholeChildProfileByStudentAndPeriod :one
SELECT 
    wcp.*,
    u.full_name AS student_name,
    u.email AS student_email,
    u.did AS student_did
FROM whole_child_profiles wcp
JOIN users u ON u.id = wcp.student_id
WHERE wcp.student_id = $1 AND wcp.period = $2;

-- name: GetLatestWholeChildProfileByStudent :one
SELECT 
    wcp.*,
    u.full_name AS student_name,
    u.email AS student_email,
    u.did AS student_did
FROM whole_child_profiles wcp
JOIN users u ON u.id = wcp.student_id
WHERE wcp.student_id = $1
ORDER BY wcp.period DESC, wcp.updated_at DESC
LIMIT 1;

-- name: ListWholeChildProfilesByClassAndPeriod :many
SELECT 
    wcp.*,
    u.full_name AS student_name,
    u.email AS student_email,
    u.did AS student_did
FROM whole_child_profiles wcp
JOIN users u ON u.id = wcp.student_id
WHERE wcp.class_id = $1 AND wcp.period = $2
ORDER BY u.full_name ASC;

-- name: CreateOfflineSyncBatch :one
INSERT INTO offline_sync_batches (
    batch_checksum,
    school_id,
    class_id,
    teacher_id,
    period,
    protocol_version,
    total_students,
    raw_payload,
    sync_method
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9
)
RETURNING *;

-- name: GetOfflineSyncBatchByChecksum :one
SELECT * FROM offline_sync_batches
WHERE batch_checksum = $1;

-- name: ListOfflineSyncBatchesBySchool :many
SELECT * FROM offline_sync_batches
WHERE school_id = $1
ORDER BY synced_at DESC
LIMIT $2 OFFSET $3;
