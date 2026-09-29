-- 000004_blockchain_id.down.sql
DROP TABLE IF EXISTS anchor_batches;
DROP TABLE IF EXISTS verifiable_credentials;

ALTER TABLE users
DROP COLUMN IF EXISTS anchor_status,
DROP COLUMN IF EXISTS blockchain_tx_hash,
DROP COLUMN IF EXISTS merkle_root,
DROP COLUMN IF EXISTS credential_hash,
DROP COLUMN IF EXISTS public_key,
DROP COLUMN IF EXISTS blockchain_address,
DROP COLUMN IF EXISTS did;
