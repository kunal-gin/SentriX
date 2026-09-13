# Changelog

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
- V1 agent transport is HTTP. Use trusted networks or TLS sidecars for untrusted networks. Native agent TLS is planned for v1.1.
