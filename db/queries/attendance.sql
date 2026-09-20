-- name: UpsertAttendance :one
INSERT INTO attendance_records (class_id, student_id, date, status, notes)
VALUES ($1, $2, $3, $4, $5)
ON CONFLICT (class_id, student_id, date)
DO UPDATE SET
    status = EXCLUDED.status,
    notes = EXCLUDED.notes
RETURNING id, class_id, student_id, date, status, notes, created_at;

-- name: GetClassAttendanceRoster :many
SELECT 
    u.id AS student_id,
    u.full_name AS student_name,
    u.email AS student_email,
    ar.id AS attendance_id,
    COALESCE(ar.status, 'unrecorded')::text AS status,
    COALESCE(ar.notes, '')::text AS notes,
    ar.date
FROM class_enrollments ce
JOIN users u ON ce.student_id = u.id
LEFT JOIN attendance_records ar 
    ON ce.class_id = ar.class_id 
    AND ce.student_id = ar.student_id 
    AND ar.date = sqlc.arg('date')::date
WHERE ce.class_id = $1
ORDER BY u.full_name ASC;

-- name: ListAttendanceByClassAndDate :many
SELECT ar.id, ar.class_id, ar.student_id, u.full_name AS student_name, ar.date, ar.status, ar.notes, ar.created_at
FROM attendance_records ar
JOIN users u ON ar.student_id = u.id
WHERE ar.class_id = $1 AND ar.date = $2
ORDER BY u.full_name ASC;

-- name: GetStudentAttendanceSummary :many
SELECT 
    status,
    COUNT(*)::bigint AS count
FROM attendance_records
WHERE student_id = $1
GROUP BY status;

-- name: ListAttendanceByStudentID :many
SELECT ar.id, ar.class_id, c.name AS class_name, ar.date, ar.status, ar.notes, ar.created_at
FROM attendance_records ar
JOIN classes c ON ar.class_id = c.id
WHERE ar.student_id = $1
ORDER BY ar.date DESC;
