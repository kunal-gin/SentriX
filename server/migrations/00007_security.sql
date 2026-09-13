-- Login brute-force protection
CREATE TABLE IF NOT EXISTS login_attempts (
    email_lower TEXT PRIMARY KEY,
    failed_count INT NOT NULL DEFAULT 0,
    locked_until TIMESTAMPTZ,
    last_failed_at TIMESTAMPTZ
);

-- Agent telemetry replay protection and credential lifecycle
ALTER TABLE agents ADD COLUMN IF NOT EXISTS last_sequence BIGINT NOT NULL DEFAULT 0;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS last_telemetry_at TIMESTAMPTZ;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS credential_rotated_at TIMESTAMPTZ;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;

DO $$
BEGIN
    ALTER TABLE agents
    ADD CONSTRAINT agents_status_check
    CHECK (status IN ('PENDING', 'ACTIVE', 'REVOKED'));
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_agents_status
ON agents(status);

CREATE INDEX IF NOT EXISTS idx_login_attempts_locked
ON login_attempts(locked_until);
