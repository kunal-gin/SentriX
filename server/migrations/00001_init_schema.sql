-- Enable TimescaleDB
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Relational Tables
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'VIEWER',
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_login_at TIMESTAMPTZ
);

CREATE TABLE agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    credential_hash TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'PENDING',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE servers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID REFERENCES agents(id),
    name VARCHAR(255) NOT NULL,
    hostname VARCHAR(255),
    platform VARCHAR(50),
    architecture VARCHAR(50),
    ip_address INET,
    agent_version VARCHAR(50),
    status VARCHAR(50) DEFAULT 'OFFLINE',
    last_seen_at TIMESTAMPTZ,
    registered_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE alert_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    metric VARCHAR(255) NOT NULL,
    operator VARCHAR(10) NOT NULL,
    threshold DOUBLE PRECISION NOT NULL,
    window_seconds INT NOT NULL,
    severity VARCHAR(50) NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    cooldown_seconds INT DEFAULT 300,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    server_id UUID REFERENCES servers(id),
    title VARCHAR(255) NOT NULL,
    severity VARCHAR(50) NOT NULL,
    status VARCHAR(50) DEFAULT 'OPEN',
    started_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    acknowledged_at TIMESTAMPTZ
);

-- Time-Series Tables (Metrics)
CREATE TABLE metric_cpu (
    time TIMESTAMPTZ NOT NULL,
    server_id UUID NOT NULL,
    value DOUBLE PRECISION NOT NULL
);

CREATE TABLE metric_memory (
    time TIMESTAMPTZ NOT NULL,
    server_id UUID NOT NULL,
    value DOUBLE PRECISION NOT NULL
);

CREATE TABLE metric_disk (
    time TIMESTAMPTZ NOT NULL,
    server_id UUID NOT NULL,
    mount_point VARCHAR(255),
    value DOUBLE PRECISION NOT NULL
);

CREATE TABLE metric_network (
    time TIMESTAMPTZ NOT NULL,
    server_id UUID NOT NULL,
    interface VARCHAR(50),
    rx_bytes BIGINT,
    tx_bytes BIGINT
);

-- Convert to TimescaleDB Hypertables
SELECT create_hypertable('metric_cpu', 'time');
SELECT create_hypertable('metric_memory', 'time');
SELECT create_hypertable('metric_disk', 'time');
SELECT create_hypertable('metric_network', 'time');

-- Indexes for Performance
CREATE INDEX idx_servers_status ON servers(status);
CREATE INDEX idx_servers_last_seen ON servers(last_seen_at DESC);
CREATE INDEX idx_metric_cpu_server_time ON metric_cpu(server_id, time DESC);
CREATE INDEX idx_metric_memory_server_time ON metric_memory(server_id, time DESC);
