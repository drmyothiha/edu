-- 000004_blockchain_id.up.sql

-- 1. Extend users table with Decentralized Identifier (DID) and Cryptographic Anchor fields
ALTER TABLE users
ADD COLUMN IF NOT EXISTS did VARCHAR(100) UNIQUE,
ADD COLUMN IF NOT EXISTS blockchain_address VARCHAR(42),
ADD COLUMN IF NOT EXISTS public_key TEXT,
ADD COLUMN IF NOT EXISTS credential_hash VARCHAR(66),
ADD COLUMN IF NOT EXISTS merkle_root VARCHAR(66),
ADD COLUMN IF NOT EXISTS blockchain_tx_hash VARCHAR(66),
ADD COLUMN IF NOT EXISTS anchor_status VARCHAR(20) DEFAULT 'unanchored' CHECK (anchor_status IN ('unanchored', 'pending', 'anchored', 'revoked'));

CREATE INDEX IF NOT EXISTS idx_users_did ON users(did);
CREATE INDEX IF NOT EXISTS idx_users_blockchain_address ON users(blockchain_address);
CREATE INDEX IF NOT EXISTS idx_users_credential_hash ON users(credential_hash);
CREATE INDEX IF NOT EXISTS idx_users_anchor_status ON users(anchor_status);

-- 2. Create verifiable credentials table for auditable credential history
CREATE TABLE IF NOT EXISTS verifiable_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    issuer_school_id UUID REFERENCES schools(id) ON DELETE SET NULL,
    did VARCHAR(100) NOT NULL,
    credential_type VARCHAR(50) NOT NULL DEFAULT 'StudentIdentityCredential',
    credential_hash VARCHAR(66) NOT NULL UNIQUE,
    merkle_root VARCHAR(66),
    merkle_proof JSONB DEFAULT '[]'::jsonb,
    polygon_tx_hash VARCHAR(66),
    polygon_block_number BIGINT,
    raw_credential_json JSONB NOT NULL,
    signature TEXT NOT NULL,
    is_revoked BOOLEAN NOT NULL DEFAULT FALSE,
    revocation_reason TEXT DEFAULT '',
    issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vc_student ON verifiable_credentials(student_id);
CREATE INDEX IF NOT EXISTS idx_vc_did ON verifiable_credentials(did);
CREATE INDEX IF NOT EXISTS idx_vc_hash ON verifiable_credentials(credential_hash);
CREATE INDEX IF NOT EXISTS idx_vc_merkle_root ON verifiable_credentials(merkle_root);

-- 3. Create anchor batches table for Layer-2 Merkle Root batching
CREATE TABLE IF NOT EXISTS anchor_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merkle_root VARCHAR(66) NOT NULL UNIQUE,
    batch_size INT NOT NULL,
    network VARCHAR(50) NOT NULL DEFAULT 'polygon-amoy',
    contract_address VARCHAR(42),
    tx_hash VARCHAR(66),
    block_number BIGINT,
    anchored_by UUID REFERENCES users(id) ON DELETE SET NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'anchored', 'failed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    anchored_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_batches_root ON anchor_batches(merkle_root);
CREATE INDEX IF NOT EXISTS idx_batches_status ON anchor_batches(status);
