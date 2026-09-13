-- Add manual resolver tracking
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS resolved_by UUID REFERENCES users(id);

-- Enforce incident lifecycle states
DO $$
BEGIN
    ALTER TABLE incidents
    ADD CONSTRAINT incidents_status_check
    CHECK (status IN ('OPEN', 'ACKNOWLEDGED', 'INVESTIGATING', 'RESOLVED'));
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Incident comments
CREATE TABLE IF NOT EXISTS incident_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Incident timeline events
CREATE TABLE IF NOT EXISTS incident_timeline_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
    actor_id UUID REFERENCES users(id),
    event_type TEXT NOT NULL CHECK (
        event_type IN (
            'OPENED',
            'ACKNOWLEDGED',
            'INVESTIGATING',
            'RESOLVED',
            'COMMENT',
            'SYSTEM'
        )
    ),
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_incident_comments_incident
ON incident_comments(incident_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_incident_timeline_incident
ON incident_timeline_events(incident_id, created_at ASC);
