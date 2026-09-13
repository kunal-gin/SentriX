-- Migration 00010: Alert Engine 2.0 Enhancements
ALTER TABLE alert_rules ADD COLUMN IF NOT EXISTS rule_type TEXT NOT NULL DEFAULT 'THRESHOLD';
ALTER TABLE alert_rules ADD COLUMN IF NOT EXISTS composite_expression TEXT DEFAULT '';
ALTER TABLE alert_rules ADD COLUMN IF NOT EXISTS fingerprint_template TEXT DEFAULT '';
ALTER TABLE alert_rules ADD COLUMN IF NOT EXISTS labels JSONB DEFAULT '{}'::jsonb;

-- Alert states lifecycle support
ALTER TABLE alert_states ADD COLUMN IF NOT EXISTS fingerprint TEXT;
ALTER TABLE alert_states ADD COLUMN IF NOT EXISTS suppression_reason TEXT;
ALTER TABLE alert_states ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMPTZ;

-- Indices for rapid fingerprint lookup
CREATE INDEX IF NOT EXISTS idx_alert_states_fingerprint ON alert_states(fingerprint);
