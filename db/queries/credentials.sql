-- name: CreateVerifiableCredential :one
INSERT INTO verifiable_credentials (
    student_id,
    issuer_school_id,
    did,
    credential_type,
    credential_hash,
    merkle_root,
    merkle_proof,
    polygon_tx_hash,
    polygon_block_number,
    raw_credential_json,
    signature
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
)
RETURNING *;

-- name: GetVerifiableCredentialByDID :one
SELECT * FROM verifiable_credentials
WHERE did = $1 AND is_revoked = FALSE
ORDER BY issued_at DESC
LIMIT 1;

-- name: GetVerifiableCredentialByHash :one
SELECT * FROM verifiable_credentials
WHERE credential_hash = $1
LIMIT 1;

-- name: GetVerifiableCredentialByStudentID :one
SELECT * FROM verifiable_credentials
WHERE student_id = $1 AND is_revoked = FALSE
ORDER BY issued_at DESC
LIMIT 1;

-- name: ListUnanchoredCredentials :many
SELECT * FROM verifiable_credentials
WHERE merkle_root IS NULL AND is_revoked = FALSE
ORDER BY issued_at ASC;

-- name: UpdateCredentialAnchor :exec
UPDATE verifiable_credentials
SET merkle_root = $2,
    merkle_proof = $3,
    polygon_tx_hash = $4,
    polygon_block_number = $5
WHERE id = $1;

-- name: RevokeCredential :exec
UPDATE verifiable_credentials
SET is_revoked = TRUE,
    revocation_reason = $2
WHERE credential_hash = $1;

-- name: CreateAnchorBatch :one
INSERT INTO anchor_batches (
    merkle_root,
    batch_size,
    network,
    contract_address,
    tx_hash,
    block_number,
    anchored_by,
    status,
    anchored_at
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9
)
RETURNING *;

-- name: ListAnchorBatches :many
SELECT * FROM anchor_batches
ORDER BY created_at DESC
LIMIT $1;

-- name: GetAnchorBatchByRoot :one
SELECT * FROM anchor_batches
WHERE merkle_root = $1
LIMIT 1;

-- name: UpdateUserBlockchainIdentity :exec
UPDATE users
SET did = $2,
    blockchain_address = $3,
    public_key = $4,
    credential_hash = $5,
    anchor_status = $6
WHERE id = $1;

-- name: UpdateUserAnchorStatus :exec
UPDATE users
SET anchor_status = $2,
    merkle_root = $3,
    blockchain_tx_hash = $4
WHERE id = $1;
