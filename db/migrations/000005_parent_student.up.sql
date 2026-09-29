-- Add parent_id to users to support parent-child academic tracking
ALTER TABLE users ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_users_parent_id ON users(parent_id);
