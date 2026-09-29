-- name: UpsertExamMark :one
INSERT INTO exam_marks (
    class_id,
    student_id,
    exam_name,
    academic_year,
    myanmar,
    english,
    maths,
    phy,
    chem,
    bio,
    geo,
    his,
    eco,
    social,
    remarks,
    updated_at
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW()
)
ON CONFLICT (class_id, student_id, exam_name)
DO UPDATE SET
    academic_year = EXCLUDED.academic_year,
    myanmar = EXCLUDED.myanmar,
    english = EXCLUDED.english,
    maths = EXCLUDED.maths,
    phy = EXCLUDED.phy,
    chem = EXCLUDED.chem,
    bio = EXCLUDED.bio,
    geo = EXCLUDED.geo,
    his = EXCLUDED.his,
    eco = EXCLUDED.eco,
    social = EXCLUDED.social,
    remarks = EXCLUDED.remarks,
    updated_at = NOW()
RETURNING *;

-- name: GetClassExamRoster :many
SELECT 
    u.id AS student_id,
    u.full_name AS student_name,
    u.email AS student_email,
    em.id AS exam_mark_id,
    COALESCE(em.exam_name, sqlc.arg('exam_name'))::varchar AS exam_name,
    COALESCE(em.academic_year, '')::varchar AS academic_year,
    em.myanmar,
    em.english,
    em.maths,
    em.phy,
    em.chem,
    em.bio,
    em.geo,
    em.his,
    em.eco,
    em.social,
    COALESCE(em.remarks, '')::text AS remarks,
    em.updated_at
FROM class_enrollments ce
JOIN users u ON ce.student_id = u.id
LEFT JOIN exam_marks em ON em.class_id = ce.class_id AND em.student_id = ce.student_id AND em.exam_name = sqlc.arg('exam_name')
WHERE ce.class_id = $1
ORDER BY u.full_name ASC;

-- name: ListDistinctExamsByClass :many
SELECT 
    exam_name, 
    academic_year, 
    MAX(updated_at) AS last_updated,
    COUNT(DISTINCT student_id) AS student_count
FROM exam_marks
WHERE class_id = $1
GROUP BY exam_name, academic_year
ORDER BY last_updated DESC;

-- name: DeleteExamMarksByClassAndExam :exec
DELETE FROM exam_marks
WHERE class_id = $1 AND exam_name = $2;
