-- 00009_silences.sql: Maintenance Windows & Alert Silencing

CREATE TABLE IF NOT EXISTS silences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    server_id UUID REFERENCES servers(id) ON DELETE CASCADE,
    rule_id UUID REFERENCES alert_rules(id) ON DELETE CASCADE,
    reason TEXT NOT NULL DEFAULT 'Scheduled maintenance',
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ends_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_silences_active ON silences(starts_at, ends_at);
CREATE INDEX IF NOT EXISTS idx_silences_server ON silences(server_id) WHERE server_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_silences_rule ON silences(rule_id) WHERE rule_id IS NOT NULL;
