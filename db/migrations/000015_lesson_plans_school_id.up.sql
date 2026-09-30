-- Add school_id to lesson_plans for school facility scoping
ALTER TABLE lesson_plans ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE CASCADE;

-- Backfill existing lesson plans with the default school ID
UPDATE lesson_plans
SET school_id = 'a0000000-0000-0000-0000-000000000001'
WHERE school_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_lesson_plans_school ON lesson_plans(school_id);
CREATE INDEX IF NOT EXISTS idx_lesson_plans_school_grade ON lesson_plans(school_id, grade_level);
