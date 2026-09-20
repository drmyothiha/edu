-- name: UpsertSubmission :one
INSERT INTO submissions (assignment_id, student_id, status, submitted_at)
VALUES ($1, $2, $3, NOW())
ON CONFLICT (assignment_id, student_id)
DO UPDATE SET
    status = EXCLUDED.status,
    submitted_at = NOW()
RETURNING id, assignment_id, student_id, status, grade, feedback, submitted_at;

-- name: GradeSubmission :one
UPDATE submissions
SET grade = $2,
    feedback = $3,
    status = 'graded'
WHERE id = $1
RETURNING id, assignment_id, student_id, status, grade, feedback, submitted_at;

-- name: GetSubmissionByID :one
SELECT id, assignment_id, student_id, status, grade, feedback, submitted_at
FROM submissions
WHERE id = $1;

-- name: GetSubmissionByAssignmentAndStudent :one
SELECT id, assignment_id, student_id, status, grade, feedback, submitted_at
FROM submissions
WHERE assignment_id = $1 AND student_id = $2;

-- name: ListSubmissionsByAssignmentID :many
SELECT s.id, s.assignment_id, s.student_id, u.full_name AS student_name, u.email AS student_email, s.status, s.grade, s.feedback, s.submitted_at
FROM submissions s
JOIN users u ON s.student_id = u.id
WHERE s.assignment_id = $1
ORDER BY s.submitted_at DESC;

-- name: ListSubmissionsByStudentID :many
SELECT s.id, s.assignment_id, a.title AS assignment_title, s.student_id, s.status, s.grade, s.feedback, s.submitted_at
FROM submissions s
JOIN assignments a ON s.assignment_id = a.id
WHERE s.student_id = $1
ORDER BY s.submitted_at DESC;
