# SentriX Production Deployment Guide

This guide provides end-to-end instructions for deploying the **SentriX Observability Platform** in enterprise production environments.

---

## Architecture Topology

```
Internet / Corporate WAN
         |
         v
+------------------+
|  Caddy / Nginx   |  (TLS 1.3 Termination, Let's Encrypt / Custom Cert)
|  Reverse Proxy   |
+--------+---------+
         |
         | Internal Private Subnet (10.0.0.0/16)
         v
+------------------+       +------------------------+
|  SentriX Server  | ----> | TimescaleDB (pg16)     |
|  (Go Binary)     |       | - Hypertables          |
|  Port: 8080      |       | - Continuous Rollups   |
+--------+---------+       | - Retention Policies   |
         ^                 +------------------------+
         |
         | HTTP / HTTPS Ingestion
         +---------------------------------------+
         |                                       |
+-------------------+                   +-------------------+
|  Linux Node 01    |                   |  Linux Node 02    |
|  sentrix-agent    |                   |  sentrix-agent    |
+-------------------+                   +-------------------+
```

---

## 1. System Requirements

### SentriX Server Host
- **CPU**: 2 vCPUs minimum (4+ vCPUs recommended for > 200 agents).
- **RAM**: 4 GB minimum (8 GB recommended for heavy WebSocket streaming).
- **Disk**: Fast NVMe storage for TimescaleDB WAL and hypertables.
- **OS**: Ubuntu 22.04/24.04 LTS, Debian 12, RHEL 9, or Alpine Linux.

### Managed Target Hosts (Agent)
- **CPU Overhead**: < 0.5% of 1 core.
- **RAM Footprint**: < 15 MB RSS.
- **Kernel**: Linux 3.10+ (requires `/proc` filesystem mounted).

---

## 2. Docker Compose Production Deployment

A complete production stack is located in `deploy/compose/compose.prod.yml`.

### Step 1: Configure Environment Variables
Create `.env` in your production directory:

```bash
POSTGRES_USER=sentrix
POSTGRES_PASSWORD=$(openssl rand -hex 24)
POSTGRES_DB=sentrix
DATABASE_URL=postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db:5432/${POSTGRES_DB}?sslmode=disable
JWT_SECRET=$(openssl rand -base64 48)
WEB_ORIGIN=https://sentrix.yourcompany.com
SENTRIX_PUBLIC_URL=https://sentrix.yourcompany.com
```

### Step 2: Start Containers
```bash
docker compose -f deploy/compose/compose.prod.yml up -d
```

Verify container status:
```bash
docker compose -f deploy/compose/compose.prod.yml ps
```

---

## 3. Reverse Proxy & TLS Configuration

### Caddy (Recommended)
Add this block to `/etc/caddy/Caddyfile`:

```caddy
sentrix.yourcompany.com {
    reverse_proxy 127.0.0.1:8080 {
        header_up Host {host}
        header_up X-Real-IP {remote_host}
        header_up X-Forwarded-For {remote_host}
        header_up X-Forwarded-Proto {scheme}
    }

    # Enable compression
    encode gzip zstd

    # Strict transport security
    header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
}
```

### Nginx
```nginx
server {
    listen 443 ssl http2;
    server_name sentrix.yourcompany.com;

    ssl_certificate /etc/ssl/certs/sentrix.crt;
    ssl_certificate_key /etc/ssl/private/sentrix.key;
    ssl_protocols TLSv1.2 TLSv1.3;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## 4. Deploying the Linux C Agent via systemd

### Step 1: Copy Binary and Configuration
```bash
sudo cp build/sentrix-agent /usr/local/bin/sentrix-agent
sudo chmod +x /usr/local/bin/sentrix-agent
sudo mkdir -p /etc/sentrix
```

### Step 2: Configure `/etc/sentrix/agent.env`
```env
SENTRIX_HOST=sentrix.yourcompany.com
SENTRIX_PORT=443
SENTRIX_AGENT_ID=node-prod-db-01
SENTRIX_TOKEN=stx_enroll_your_unique_token
SENTRIX_INTERVAL=5
```

### Step 3: Install systemd Service
Copy `deploy/systemd/sentrix-agent.service` to `/etc/systemd/system/`:

```ini
[Unit]
Description=SentriX Infrastructure Monitoring Agent
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
EnvironmentFile=/etc/sentrix/agent.env
ExecStart=/usr/local/bin/sentrix-agent
Restart=always
RestartSec=5s
LimitNOFILE=65536
ProtectSystem=full
ProtectHome=true

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now sentrix-agent
sudo systemctl status sentrix-agent
```
