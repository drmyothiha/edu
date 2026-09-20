DROP INDEX IF EXISTS idx_schools_category;
DROP INDEX IF EXISTS idx_schools_pcode_ward_vt;
DROP INDEX IF EXISTS idx_schools_pcode_ts;
DROP INDEX IF EXISTS idx_schools_pcode_sr;

ALTER TABLE schools
DROP COLUMN IF EXISTS school_category,
DROP COLUMN IF EXISTS ward_village_name,
DROP COLUMN IF EXISTS township_name,
DROP COLUMN IF EXISTS pcode_level,
DROP COLUMN IF EXISTS pcode_ward_vt,
DROP COLUMN IF EXISTS pcode_ts,
DROP COLUMN IF EXISTS pcode_sr;

DROP TABLE IF EXISTS mimu_pcodes;
