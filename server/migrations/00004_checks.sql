-- Add incident fields that may be missing from earlier phases
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS summary TEXT;
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS acknowledged_by UUID REFERENCES users(id);

-- Checks
CREATE TABLE IF NOT EXISTS checks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    server_id UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('PROCESS', 'SERVICE', 'PORT', 'COMMAND')),
    name TEXT NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    interval_seconds INT NOT NULL DEFAULT 15,
    timeout_seconds INT NOT NULL DEFAULT 5,
    failure_threshold INT NOT NULL DEFAULT 3,
    success_threshold INT NOT NULL DEFAULT 1,
    severity TEXT NOT NULL DEFAULT 'CRITICAL',
    config JSONB NOT NULL DEFAULT '{}',
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Check results are time-series
CREATE TABLE IF NOT EXISTS check_results (
    time TIMESTAMPTZ NOT NULL,
    check_id UUID NOT NULL,
    server_id UUID NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('OK', 'FAIL')),
    latency_ms INT,
    message TEXT
);

SELECT create_hypertable('check_results', 'time');

-- Current state per check
CREATE TABLE IF NOT EXISTS check_states (
    check_id UUID PRIMARY KEY REFERENCES checks(id) ON DELETE CASCADE,
    server_id UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
    state TEXT NOT NULL DEFAULT 'OK',
    consecutive_failures INT NOT NULL DEFAULT 0,
    consecutive_successes INT NOT NULL DEFAULT 0,
    last_status TEXT,
    last_message TEXT,
    last_result_at TIMESTAMPTZ,
    incident_id UUID REFERENCES incidents(id),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Link incidents to checks
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS root_check_id UUID REFERENCES checks(id);

-- Prevent duplicate active incidents for the same check
CREATE UNIQUE INDEX IF NOT EXISTS uniq_open_incident_root_check
ON incidents(server_id, root_check_id)
WHERE status IN ('OPEN', 'ACKNOWLEDGED', 'INVESTIGATING');

-- Indexes
CREATE INDEX IF NOT EXISTS idx_checks_server_enabled ON checks(server_id, enabled);
CREATE INDEX IF NOT EXISTS idx_check_results_check_time ON check_results(check_id, time DESC);
CREATE INDEX IF NOT EXISTS idx_check_results_server_time ON check_results(server_id, time DESC);
CREATE INDEX IF NOT EXISTS idx_check_states_server ON check_states(server_id);
