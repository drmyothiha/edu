-- 000013_rag_pipeline_curriculum.up.sql
-- RAG Pipeline Architecture: Myanmar MoE Curriculum Chunks & Lesson Plan Grounding Metadata

-- 1. Create table for Myanmar MoE Curriculum Chunks (Vector Store)
CREATE TABLE IF NOT EXISTS curriculum_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    standard_code VARCHAR(50) NOT NULL UNIQUE,
    framework VARCHAR(120) NOT NULL DEFAULT 'Myanmar MoE Basic Education Curriculum Framework (KG+12)',
    subject VARCHAR(100) NOT NULL,
    grade_level VARCHAR(50) NOT NULL,
    unit_title VARCHAR(255) NOT NULL,
    topic VARCHAR(255) NOT NULL,
    competency TEXT NOT NULL,
    learning_outcomes TEXT NOT NULL,
    pedagogical_activities TEXT NOT NULL,
    blooms_level VARCHAR(50) NOT NULL DEFAULT 'Apply',
    content_burmese TEXT NOT NULL DEFAULT '',
    keywords TEXT[] NOT NULL DEFAULT '{}',
    embedding DOUBLE PRECISION[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_curriculum_chunks_subj_grade ON curriculum_chunks(subject, grade_level);
CREATE INDEX IF NOT EXISTS idx_curriculum_chunks_code ON curriculum_chunks(standard_code);
CREATE INDEX IF NOT EXISTS idx_curriculum_chunks_topic ON curriculum_chunks(topic);

-- 2. Enhance lesson_plans table with RAG grounding metadata and embeddings
ALTER TABLE lesson_plans
ADD COLUMN IF NOT EXISTS rag_metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE lesson_plans
ADD COLUMN IF NOT EXISTS embedding DOUBLE PRECISION[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_lesson_plans_subject_grade ON lesson_plans(subject, grade_level);
