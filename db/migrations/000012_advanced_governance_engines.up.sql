-- 000012_advanced_governance_engines.up.sql
-- Supports:
-- 1. Report Card & Transcript Compilation Engine
-- 2. Data Retention, Archival & Anonymization Engine (Right to be Forgotten)
-- 3. Credential Revocation Registry (W3C Bitstring Status List)
-- 4. Zero-Knowledge Proof (ZKP) Predicates & Selective Disclosure

-- 1. Official Transcripts & Report Cards
CREATE TABLE IF NOT EXISTS official_transcripts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    academic_year VARCHAR(50) NOT NULL,
    term VARCHAR(50) NOT NULL, -- e.g. 'Final Examination', 'Semester 1', 'Graduation Cumulative'
    grade_level VARCHAR(50) NOT NULL,
    gpa NUMERIC(4,2) NOT NULL DEFAULT 0.00,
    total_marks NUMERIC(7,2) NOT NULL DEFAULT 0.00,
    average_percentage NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    attendance_rate NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    rank_in_class INT DEFAULT NULL,
    total_students_in_class INT DEFAULT NULL,
    distinctions_count INT NOT NULL DEFAULT 0,
    standing VARCHAR(50) NOT NULL DEFAULT 'Passed', -- 'Passed', 'Distinction', 'Failed', 'Withdrawn'
    transcript_type VARCHAR(50) NOT NULL DEFAULT 'term_report_card', -- 'term_report_card', 'graduation_transcript'
    verification_hash VARCHAR(66) NOT NULL UNIQUE,
    issuer_did VARCHAR(100) NOT NULL,
    certified_by UUID REFERENCES users(id) ON DELETE SET NULL,
    certified_at TIMESTAMPTZ,
    data_payload JSONB NOT NULL, -- full breakdown of subjects, scores, letter grades, remarks
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transcripts_student ON official_transcripts(student_id);
CREATE INDEX IF NOT EXISTS idx_transcripts_school ON official_transcripts(school_id);
CREATE INDEX IF NOT EXISTS idx_transcripts_hash ON official_transcripts(verification_hash);
CREATE INDEX IF NOT EXISTS idx_transcripts_academic_year ON official_transcripts(academic_year, term);

-- 2. Data Retention, Archival & Anonymization (Right to be Forgotten)
CREATE TABLE IF NOT EXISTS privacy_erasure_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL, -- soft link: will point to anonymized entity after execution
    original_did VARCHAR(100),
    school_id UUID REFERENCES schools(id) ON DELETE SET NULL,
    requested_by UUID REFERENCES users(id) ON DELETE SET NULL,
    request_type VARCHAR(50) NOT NULL DEFAULT 'FullErasure', -- 'FullErasure', 'DeIdentifyAnalytics', 'Archive'
    status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'executed', 'rejected')),
    legal_basis VARCHAR(100) NOT NULL DEFAULT 'ConsentRevocation', -- 'ConsentRevocation', 'AgeOut', 'ParentalRequest', 'GraduatedPolicy'
    reason TEXT NOT NULL DEFAULT '',
    pseudonym VARCHAR(100), -- salted non-reversible pseudonym (e.g. ANON-8f2c31e9)
    fields_scrubbed JSONB DEFAULT '[]'::jsonb,
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    executed_at TIMESTAMPTZ,
    executed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    rejection_reason TEXT DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_erasure_student ON privacy_erasure_requests(student_id);
CREATE INDEX IF NOT EXISTS idx_erasure_status ON privacy_erasure_requests(status);

CREATE TABLE IF NOT EXISTS privacy_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(50) NOT NULL, -- 'PII_SCRUBBED', 'RECORD_ARCHIVED', 'PSEUDONYMIZATION_GENERATED', 'RETENTION_SWEEP'
    actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    target_student_id UUID,
    pseudonym VARCHAR(100),
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    ip_address VARCHAR(50) DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_privacy_audit_event ON privacy_audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_privacy_audit_created ON privacy_audit_logs(created_at);

-- 3. Credential Revocation Registry (W3C Bitstring Status List)
CREATE TABLE IF NOT EXISTS credential_revocation_lists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    issuer_school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    list_name VARCHAR(100) NOT NULL DEFAULT 'default-revocation-list',
    purpose VARCHAR(50) NOT NULL DEFAULT 'revocation', -- 'revocation' or 'suspension'
    status_list_credential_id VARCHAR(150) NOT NULL UNIQUE,
    encoded_bitstring TEXT NOT NULL, -- gzip compressed + base64url encoded bitstring
    total_capacity INT NOT NULL DEFAULT 131072, -- 131,072 bits (16KB)
    revoked_count INT NOT NULL DEFAULT 0,
    last_bit_index_allocated INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_revocation_lists_school ON credential_revocation_lists(issuer_school_id);
CREATE INDEX IF NOT EXISTS idx_revocation_lists_cred_id ON credential_revocation_lists(status_list_credential_id);

CREATE TABLE IF NOT EXISTS credential_revocation_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    list_id UUID NOT NULL REFERENCES credential_revocation_lists(id) ON DELETE CASCADE,
    credential_hash VARCHAR(66) NOT NULL UNIQUE,
    student_did VARCHAR(100) NOT NULL,
    bit_position INT NOT NULL,
    reason_code VARCHAR(50) NOT NULL, -- 'AcademicMisconduct', 'ErroneousIssuance', 'Transferred', 'Superseded'
    reason_details TEXT NOT NULL DEFAULT '',
    revoked_by UUID REFERENCES users(id) ON DELETE SET NULL,
    revoked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    onchain_tx_hash VARCHAR(66) DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_revocation_cred_hash ON credential_revocation_entries(credential_hash);
CREATE INDEX IF NOT EXISTS idx_revocation_did ON credential_revocation_entries(student_did);

-- 4. Zero-Knowledge Proof (ZKP) Predicate Templates & Proof Verifications
CREATE TABLE IF NOT EXISTS zkp_proof_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    proof_type VARCHAR(50) NOT NULL, -- 'AgeAtLeast', 'GraduationStatus', 'MinimumGPA', 'SchoolEnrollment'
    credential_hash VARCHAR(66) NOT NULL,
    verifier_id UUID REFERENCES users(id) ON DELETE SET NULL,
    predicate_statement TEXT NOT NULL,
    proof_result BOOLEAN NOT NULL DEFAULT FALSE,
    disclosed_claims JSONB NOT NULL DEFAULT '{}'::jsonb,
    verification_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_zkp_cred_hash ON zkp_proof_verifications(credential_hash);
CREATE INDEX IF NOT EXISTS idx_zkp_type ON zkp_proof_verifications(proof_type);
