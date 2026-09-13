-- Extend alert rules with "for" duration and hysteresis support
ALTER TABLE alert_rules ADD COLUMN IF NOT EXISTS for_seconds INT NOT NULL DEFAULT 300;
ALTER TABLE alert_rules ADD COLUMN IF NOT EXISTS resolve_threshold DOUBLE PRECISION;
ALTER TABLE alert_rules ADD COLUMN IF NOT EXISTS server_scope TEXT NOT NULL DEFAULT 'ALL';
ALTER TABLE alert_rules ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '';

-- Persist alert state per rule/server pair.
-- This prevents losing PENDING/FIRING state on server restart.
CREATE TABLE IF NOT EXISTS alert_states (
    rule_id UUID NOT NULL REFERENCES alert_rules(id) ON DELETE CASCADE,
    server_id UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
    state TEXT NOT NULL DEFAULT 'OK',
    first_breach_at TIMESTAMPTZ,
    last_value DOUBLE PRECISION,
    last_eval_at TIMESTAMPTZ,
    cooldown_until TIMESTAMPTZ,
    incident_id UUID REFERENCES incidents(id),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (rule_id, server_id)
);

-- Append-only alert event log
CREATE TABLE IF NOT EXISTS alert_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id UUID REFERENCES alert_rules(id) ON DELETE CASCADE,
    server_id UUID REFERENCES servers(id) ON DELETE CASCADE,
    state TEXT NOT NULL,
    current_value DOUBLE PRECISION,
    threshold DOUBLE PRECISION,
    message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Link incidents to the alert rule that caused them
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS root_alert_id UUID REFERENCES alert_rules(id);

CREATE INDEX IF NOT EXISTS idx_alert_states_last_eval ON alert_states(last_eval_at DESC);
CREATE INDEX IF NOT EXISTS idx_alert_events_server_created ON alert_events(server_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_incidents_status_started ON incidents(status, started_at DESC);

-- Prevent duplicate active incidents for the same server + root alert rule
CREATE UNIQUE INDEX IF NOT EXISTS uniq_open_incident_root_alert
ON incidents(server_id, root_alert_id)
WHERE status IN ('OPEN', 'ACKNOWLEDGED', 'INVESTIGATING');
