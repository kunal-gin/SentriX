-- TimescaleDB Data Retention Policy and Continuous Aggregation Setup

-- Add 30-day raw data retention policies for high-frequency telemetry tables
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_extension WHERE extname = 'timescaledb'
    ) THEN
        PERFORM add_retention_policy('metric_cpu', INTERVAL '30 days', if_not_exists => true);
        PERFORM add_retention_policy('metric_memory', INTERVAL '30 days', if_not_exists => true);
        PERFORM add_retention_policy('metric_disk', INTERVAL '30 days', if_not_exists => true);
        PERFORM add_retention_policy('metric_network', INTERVAL '30 days', if_not_exists => true);
    END IF;
EXCEPTION
    WHEN undefined_function THEN
        -- TimescaleDB extension or retention function not installed/supported
        NULL;
    WHEN others THEN
        NULL;
END $$;
