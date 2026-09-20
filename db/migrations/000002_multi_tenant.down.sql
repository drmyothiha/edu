ALTER TABLE classes DROP COLUMN IF EXISTS school_id;
ALTER TABLE users DROP COLUMN IF EXISTS school_id;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check 
    CHECK (role IN ('admin', 'teacher', 'parent', 'student'));
DROP TABLE IF EXISTS schools;
