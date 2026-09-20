-- name: CreateAssignment :one
INSERT INTO assignments (class_id, title, description, due_date, max_score)
VALUES ($1, $2, $3, $4, $5)
RETURNING id, class_id, title, description, due_date, max_score, created_at;

-- name: GetAssignmentByID :one
SELECT id, class_id, title, description, due_date, max_score, created_at
FROM assignments
WHERE id = $1;

-- name: ListAssignmentsByClassID :many
SELECT id, class_id, title, description, due_date, max_score, created_at
FROM assignments
WHERE class_id = $1
ORDER BY due_date ASC;

-- name: ListPendingAssignmentsByStudentID :many
SELECT 
    a.id,
    a.class_id,
    c.name AS class_name,
    a.title,
    a.description,
    a.due_date,
    a.max_score,
    a.created_at
FROM assignments a
JOIN classes c ON a.class_id = c.id
JOIN class_enrollments ce ON ce.class_id = c.id
LEFT JOIN submissions s ON s.assignment_id = a.id AND s.student_id = ce.student_id
WHERE ce.student_id = $1 
  AND s.id IS NULL
ORDER BY a.due_date ASC;

-- name: DeleteAssignment :exec
DELETE FROM assignments
WHERE id = $1;
