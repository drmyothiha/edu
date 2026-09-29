-- 000008_lesson_plan_burmese.up.sql
ALTER TABLE lesson_plans
ADD COLUMN IF NOT EXISTS generated_markdown_burmese TEXT NOT NULL DEFAULT '';
