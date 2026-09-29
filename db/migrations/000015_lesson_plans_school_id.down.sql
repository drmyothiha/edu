DROP INDEX IF EXISTS idx_lesson_plans_school_grade;
DROP INDEX IF EXISTS idx_lesson_plans_school;
ALTER TABLE lesson_plans DROP COLUMN IF EXISTS school_id;
