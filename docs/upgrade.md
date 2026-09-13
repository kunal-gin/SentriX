# SentriX Upgrade & Migration Guide

This guide describes procedures for performing zero-downtime upgrades, applying database migrations, and rolling back in the event of failure.

---

## 1. Upgrade Philosophy

SentriX follows semantic versioning (`MAJOR.MINOR.PATCH`):
- **PATCH releases (e.g. 1.1.0 -> 1.1.1)**: Bug fixes, performance optimizations, and security patches. Fully backward-compatible.
- **MINOR releases (e.g. 1.0.0 -> 1.1.0)**: New features, schema migrations, and UI additions. Fully backward-compatible with older agents.
- **MAJOR releases (e.g. 1.x -> 2.x)**: Breaking architectural changes.

Older C agents can safely communicate with newer SentriX servers. New server features degrade gracefully when receiving older agent payloads.

---

## 2. Standard Server Upgrade Procedure

### Step 1: Backup Current Database
Always take a snapshot before applying upgrades:

```bash
# Execute backup script
./scripts/backup-db.sh /var/backups/sentrix-pre-upgrade.sql.gz
```

### Step 2: Pull New Image & Run Migrations
When using Docker Compose:

```bash
# Pull new server container
docker compose -f deploy/compose/compose.prod.yml pull server

# Restart server container (auto-runs database migrations upon startup)
docker compose -f deploy/compose/compose.prod.yml up -d server
```

The server automatically scans `server/migrations/` and executes unapplied SQL scripts in sequence within transactional blocks.

### Step 3: Verify Health
```bash
curl -f http://127.0.0.1:8080/health/ready
# Output: {"status":"ready"}

curl -f http://127.0.0.1:8080/metrics | grep sentrix_uptime_seconds
```

---

## 3. Rolling Agent Upgrades

The native C agent can be upgraded on target Linux hosts without rebooting the host:

```bash
# 1. Download or build the new agent binary
cd /tmp
curl -sSL -O https://github.com/kunal-gin/SentriX/releases/download/v1.1.0/sentrix-agent-linux-amd64
chmod +x sentrix-agent-linux-amd64

# 2. Atomically swap the binary
sudo install -m 755 sentrix-agent-linux-amd64 /usr/local/bin/sentrix-agent

# 3. Restart the systemd service (downtime < 1 second)
sudo systemctl restart sentrix-agent
sudo systemctl status sentrix-agent
```

---

## 4. Rollback Runbook

If a critical issue occurs after upgrading:

1. **Stop the new server**:
   ```bash
   docker compose -f deploy/compose/compose.prod.yml stop server
   ```

2. **Restore previous database backup** (if schema migration was incompatible):
   ```bash
   ./scripts/restore-db.sh /var/backups/sentrix-pre-upgrade.sql.gz
   ```

3. **Pin image to previous release**:
   In `compose.prod.yml`, specify the previous tag (e.g. `sentrix-server:v1.0.0`) and run:
   ```bash
   docker compose -f deploy/compose/compose.prod.yml up -d server
   ```
