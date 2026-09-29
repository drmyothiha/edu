-- 000007_whole_child_sync.up.sql
-- Supports Whole-Child Development Framework (9.1 - 9.5) and Offline-First Sync Ingestion

CREATE TABLE IF NOT EXISTS whole_child_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    academic_year VARCHAR(30) NOT NULL,
    period VARCHAR(30) NOT NULL, -- e.g. "2026-10"
    attendance_rate_pct NUMERIC(5, 2) DEFAULT 0.0,
    academic_profile JSONB NOT NULL DEFAULT '{}'::jsonb,
    physical_growth_profile JSONB NOT NULL DEFAULT '{}'::jsonb,
    health_visibility_profile JSONB NOT NULL DEFAULT '{}'::jsonb,
    wellbeing_profile JSONB NOT NULL DEFAULT '{}'::jsonb,
    social_citizenship_profile JSONB NOT NULL DEFAULT '{}'::jsonb,
    sync_source VARCHAR(60) DEFAULT 'offline_mobile_kiosk',
    sync_record_hash VARCHAR(128),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_whole_child_student_period UNIQUE (student_id, period)
);

CREATE INDEX IF NOT EXISTS idx_whole_child_class_period ON whole_child_profiles(class_id, period);
CREATE INDEX IF NOT EXISTS idx_whole_child_school ON whole_child_profiles(school_id);
CREATE INDEX IF NOT EXISTS idx_whole_child_student ON whole_child_profiles(student_id);

CREATE TABLE IF NOT EXISTS offline_sync_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_checksum VARCHAR(128) NOT NULL UNIQUE,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES users(id) ON DELETE SET NULL,
    period VARCHAR(30) NOT NULL,
    protocol_version VARCHAR(30) NOT NULL DEFAULT '2.1-whole-child',
    total_students INT NOT NULL DEFAULT 0,
    raw_payload JSONB NOT NULL,
    sync_method VARCHAR(50) DEFAULT 'direct_http',
    synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_offline_sync_batches_school ON offline_sync_batches(school_id, period);
