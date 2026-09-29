DROP INDEX IF EXISTS idx_schools_name_my;
DROP INDEX IF EXISTS idx_schools_name_en;

ALTER TABLE schools
DROP COLUMN IF EXISTS name_my,
DROP COLUMN IF EXISTS name_en;
