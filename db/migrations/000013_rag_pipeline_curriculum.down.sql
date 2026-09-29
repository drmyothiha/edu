-- 000013_rag_pipeline_curriculum.down.sql
DROP TABLE IF EXISTS curriculum_chunks;
ALTER TABLE lesson_plans DROP COLUMN IF EXISTS rag_metadata;
ALTER TABLE lesson_plans DROP COLUMN IF EXISTS embedding;
