-- 1. Create schools table (multi-tenant root)
CREATE TABLE IF NOT EXISTS schools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) NOT NULL UNIQUE,
    address TEXT NOT NULL DEFAULT '',
    city VARCHAR(100) NOT NULL,
    region VARCHAR(100) NOT NULL,
    phone VARCHAR(50) NOT NULL DEFAULT '',
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_schools_code ON schools(code);
CREATE INDEX IF NOT EXISTS idx_schools_region ON schools(region);
CREATE INDEX IF NOT EXISTS idx_schools_status ON schools(status);

-- 2. Insert default national facility so existing records migrate smoothly
INSERT INTO schools (id, name, code, address, city, region, phone, status)
VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'Yangon Academy High School',
    'ygn-academy-01',
    'No. 42 Pyay Road, Dagon Township',
    'Yangon',
    'Yangon Region',
    '+95 1 234 567',
    'active'
) ON CONFLICT (code) DO NOTHING;

-- 3. Update users table with school_id and multi-tenant role support
ALTER TABLE users ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE SET NULL;

-- Drop previous role check constraint and apply updated multi-tenant roles
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check 
    CHECK (role IN ('sysadmin', 'school_admin', 'admin', 'teacher', 'parent', 'student'));

-- Update existing users without a school to the default school (except sysadmins if any)
UPDATE users 
SET school_id = 'a0000000-0000-0000-0000-000000000001' 
WHERE school_id IS NULL AND role != 'sysadmin';

CREATE INDEX IF NOT EXISTS idx_users_school ON users(school_id);
CREATE INDEX IF NOT EXISTS idx_users_school_role ON users(school_id, role);

-- 4. Update classes table with school_id
ALTER TABLE classes ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE CASCADE;

-- Backfill existing classes
UPDATE classes 
SET school_id = 'a0000000-0000-0000-0000-000000000001' 
WHERE school_id IS NULL;

-- Make school_id NOT NULL now that it is backfilled
ALTER TABLE classes ALTER COLUMN school_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_classes_school ON classes(school_id);
