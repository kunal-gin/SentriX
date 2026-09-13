-- Migration 00011: Incident Management 2.0
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS assignee_id UUID REFERENCES users(id);
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS assignee_name TEXT DEFAULT '';
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS postmortem TEXT DEFAULT '';
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS rca_hypothesis TEXT DEFAULT '';

-- Update constraint to allow CLOSED status
DO $$
BEGIN
    ALTER TABLE incidents DROP CONSTRAINT IF EXISTS incidents_status_check;
    ALTER TABLE incidents
    ADD CONSTRAINT incidents_status_check
    CHECK (status IN ('OPEN', 'INVESTIGATING', 'ACKNOWLEDGED', 'RESOLVED', 'CLOSED'));
EXCEPTION
    WHEN others THEN NULL;
END $$;
