# SentriX Security Architecture & Hardening Guide

This document outlines the security controls, authentication architecture, rate-limiting, and hardening standards implemented across the SentriX platform.

---

## 1. Authentication Architecture

### User Authentication
- **Password Hashing**: Implemented using **Argon2id** (`m=64MB, t=3 iterations, p=2 threads`), exceeding NIST SP 800-63B guidelines.
- **Short-Lived Access Tokens**: Signed with HMAC-SHA256 (HS256) and expired automatically after 15 minutes.
- **Rotating Refresh Tokens**: Hashed with SHA-256 in the database. When a refresh token is exchanged, a new token is issued and the previous token is revoked immediately.
- **Brute-Force Protection**: IP and email-based login rate limiting triggers exponential backoff and account lockouts after 5 consecutive failures.

### Agent Telemetry Authentication
- **Unique Credentials**: Each enrolled agent holds a cryptographically random token.
- **Credential Storage**: Agent credentials are never stored in plaintext. The database only persists the SHA-256 digest (`credential_hash`).
- **Replay Protection**: The telemetry ingestion gateway checks monotonically increasing sequence numbers (`sequence`) and enforces a ±60-second timestamp drift tolerance window. Replayed packets are dropped immediately.

---

## 2. Role-Based Access Control (RBAC) Matrix

| Resource / Action | ADMIN | OPERATOR | VIEWER |
|---|---|---|---|
| View Fleet Dashboard & Server Metrics | Yes | Yes | Yes |
| View Incidents & Synthetic Checks | Yes | Yes | Yes |
| Acknowledge & Resolve Incidents | Yes | Yes | No |
| Add Incident Investigation Comments | Yes | Yes | Yes |
| Schedule Maintenance Windows (Silences) | Yes | Yes | No |
| Create & Edit Alert Threshold Rules | Yes | Yes | No |
| Create & Modify Synthetic Checks | Yes | Yes | No |
| Decommission Server Nodes | Yes | Yes | No |
| Invite & Manage Team Members | Yes | No | No |
| Generate Agent Enrollment Tokens | Yes | No | No |
| Configure Notification Webhook Channels | Yes | No | No |
| View Security & Compliance Audit Logs | Yes | Yes | No |

---

## 3. Compliance & Audit Logging

All sensitive operations are captured automatically via `WriteAudit(...)` to the `audit_logs` table:
- User logins & failed authentication attempts
- Team invitations, role upgrades, and account deletions
- Server decommissioning & node registration
- Agent enrollment token generation & revocation
- Maintenance window creation & alert silence cancellation
- Webhook notification test dispatches

Audit logs record the actor ID, actor email, action code, target resource, client IP address, and metadata payload. Logs can be viewed via the **Audit Logs** dashboard or queried via `GET /api/v1/audit-logs`.

---

## 4. Network Hardening & Reverse Proxy Checklist

1. **Terminate TLS at Reverse Proxy**: Always terminate TLS 1.3 at Caddy or Nginx. Do not expose port 8080 directly to public untrusted networks.
2. **Set Restrictive CORS**: Ensure `WEB_ORIGIN` matches your production frontend URL (`https://sentrix.yourcompany.com`) to block cross-origin requests.
3. **HTTP Security Headers**: SentriX automatically sets:
   - `X-Content-Type-Options: nosniff`
   - `X-Frame-Options: DENY`
   - `X-XSS-Protection: 1; mode=block`
   - `Referrer-Policy: strict-origin-when-cross-origin`
   - `Content-Security-Policy: default-src 'self'`
4. **Body Size Limits**: Telemetry ingestion payloads are limited to 1MB; general API endpoints are restricted to 64KB.
