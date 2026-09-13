# Changelog

## v1.1.0

### Added
- **Native C Agent Configuration & Synthetic Checks**:
  - Dynamic configuration loader parsing `/etc/sentrix/agent.env` or local `.env` files.
  - Multi-source environment variable and command line flag overrides (`-s`, `-p`, `-i`, `-t`, `-c`).
  - Integrated periodic synthetic checks execution loop alongside telemetry collection.
  - Multi-interface network traffic aggregator across physical non-loopback Linux network devices.
- **Backend Features & Administration**:
  - Server decommissioning endpoint (`DELETE /api/v1/servers/{serverID}`) with database cascade cleanup.
  - Agent enrollment token generator (`POST /api/v1/agents/enrollment-tokens`) with 24-hour expiration.
  - Team & Access Control management endpoints (`/api/v1/users`) supporting RBAC (`ADMIN`, `OPERATOR`, `VIEWER`).
  - Notification Channels endpoints (`/api/v1/notifications/channels`) supporting Slack, Discord, PagerDuty, and custom webhook dispatch testing.
  - WebSocket ticket authentication alias (`/auth/ws-ticket`).
  - TimescaleDB 30-day retention policies and hourly continuous aggregates migration (`00008_retention_and_aggregates.sql`).
  - Go unit tests for `auth` (password hashing & JWT validation) and `metrics` (credential hashing & payload structure).
- **Web UI & Management Dashboard**:
  - Node Enrollment modal on Overview page with one-click token generation and `curl | bash` installation commands.
  - Team & Access Control page with role indicators, invite modal, and account deletion.
  - Alert Notification Channels page with test dispatch simulations.
  - Server decommissioning dialog on the Node Detail page.

---

## v1.0.0

### Added
- Core telemetry pipeline: agent → API → TimescaleDB.
- Linux C agent with CPU, memory, disk, network, load, and uptime collectors.
- Agent enrollment tokens.
- Unique agent credentials.
- Agent credential rotation.
- Agent revocation.
- Current-state engine with online/suspect/offline detection.
- Historical metric charts.
- Threshold alert engine with pending state, cooldown, and hysteresis.
- Incident lifecycle: open, acknowledge, resolve.
- Incident comments and timeline.
- Process, service, port, and command checks.
- Notification jobs with webhook delivery and retry/backoff.
- Realtime WebSocket updates with polling fallback.
- Authentication with Argon2id, JWT access tokens, and rotating refresh tokens.
- RBAC: ADMIN, OPERATOR, VIEWER.
- Audit logging for sensitive operations.
- Rate limiting for login, refresh, enrollment, and telemetry.
- Telemetry replay protection using sequence numbers and timestamp windows.
- Security headers.
- Body size limits.
- Self-monitoring metrics endpoint.
- Docker server image with embedded web UI.
- Automatic database migrations.
- systemd agent packaging.
- Backup and restore scripts.

### Security
- Login brute-force protection.
- One-time enrollment tokens.
- Hashed agent credentials.
- Restricted CORS in production.
- TLS deployment documentation.

### Notes
- V1 agent transport is HTTP. Use trusted networks or TLS sidecars for untrusted networks. Native agent TLS is planned for v1.2.
