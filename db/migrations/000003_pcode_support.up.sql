-- 1. Create MIMU Place Codes lookup table
CREATE TABLE IF NOT EXISTS mimu_pcodes (
    pcode VARCHAR(25) PRIMARY KEY,
    parent_pcode VARCHAR(25),
    admin_level INT NOT NULL, -- 1: State/Region, 3: Township, 4: Ward/Village Tract
    name_en VARCHAR(255) NOT NULL,
    name_my VARCHAR(255) NOT NULL,
    sr_pcode VARCHAR(15),
    ts_pcode VARCHAR(20),
    pcode_type VARCHAR(30) NOT NULL DEFAULT 'urban', -- 'state_region', 'township', 'ward', 'village_tract'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mimu_pcodes_level ON mimu_pcodes(admin_level);
CREATE INDEX IF NOT EXISTS idx_mimu_pcodes_parent ON mimu_pcodes(parent_pcode);
CREATE INDEX IF NOT EXISTS idx_mimu_pcodes_sr ON mimu_pcodes(sr_pcode);
CREATE INDEX IF NOT EXISTS idx_mimu_pcodes_ts ON mimu_pcodes(ts_pcode);

-- 2. Extend schools table with MIMU Place Code columns & School Category (Option A)
ALTER TABLE schools
ADD COLUMN IF NOT EXISTS pcode_sr VARCHAR(15),
ADD COLUMN IF NOT EXISTS pcode_ts VARCHAR(20),
ADD COLUMN IF NOT EXISTS pcode_ward_vt VARCHAR(25),
ADD COLUMN IF NOT EXISTS pcode_level VARCHAR(25) DEFAULT 'ward',
ADD COLUMN IF NOT EXISTS township_name VARCHAR(150),
ADD COLUMN IF NOT EXISTS ward_village_name VARCHAR(150),
ADD COLUMN IF NOT EXISTS school_category VARCHAR(15) DEFAULT 'HS';

CREATE INDEX IF NOT EXISTS idx_schools_pcode_sr ON schools(pcode_sr);
CREATE INDEX IF NOT EXISTS idx_schools_pcode_ts ON schools(pcode_ts);
CREATE INDEX IF NOT EXISTS idx_schools_pcode_ward_vt ON schools(pcode_ward_vt);
CREATE INDEX IF NOT EXISTS idx_schools_category ON schools(school_category);
