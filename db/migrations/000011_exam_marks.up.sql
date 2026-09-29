CREATE TABLE IF NOT EXISTS exam_marks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    exam_name VARCHAR(150) NOT NULL,
    academic_year VARCHAR(50) NOT NULL DEFAULT '2026-2027',
    myanmar NUMERIC(5,2),
    english NUMERIC(5,2),
    maths NUMERIC(5,2),
    phy NUMERIC(5,2),
    chem NUMERIC(5,2),
    bio NUMERIC(5,2),
    geo NUMERIC(5,2),
    his NUMERIC(5,2),
    eco NUMERIC(5,2),
    social NUMERIC(5,2),
    remarks TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_class_student_exam UNIQUE (class_id, student_id, exam_name)
);

CREATE INDEX IF NOT EXISTS idx_exam_marks_class_exam ON exam_marks(class_id, exam_name);
CREATE INDEX IF NOT EXISTS idx_exam_marks_student ON exam_marks(student_id);
