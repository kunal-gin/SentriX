# SentriX — High-Performance Infrastructure Monitoring & Observability

[![CI](https://github.com/kunal-gin/SentriX/actions/workflows/ci.yml/badge.svg)](https://github.com/kunal-gin/SentriX/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/kunal-gin/SentriX?color=6366f1)](https://github.com/kunal-gin/SentriX/releases)
[![Go Version](https://img.shields.io/badge/Go-1.23+-00ADD8?logo=go)](https://go.dev)
[![Agent](https://img.shields.io/badge/Agent-C11%20Native-blue?logo=c)](./agent)
[![Database](https://img.shields.io/badge/TimescaleDB-PostgreSQL%2016-336791?logo=postgresql)](https://www.timescale.com/)
[![Frontend](https://img.shields.io/badge/UI-React%20%2B%20Vite%20%2B%20Tailwind-61DAFB?logo=react)](./web)
[![License](https://img.shields.io/badge/License-Apache%202.0-green.svg)](LICENSE)

SentriX is a modern, lightweight, high-performance infrastructure monitoring and observability platform engineered for sub-millisecond metric collection, real-time anomaly detection, incident triage, and fleet observability across distributed Linux servers.

---

## ⚡ Key Highlights

- **Ultra-Lightweight C Agent**: Native C11 daemon with sub-10ms collection latency, negligible CPU footprint (<0.5%), and minimal memory consumption (<15MB RSS).
- **High-Throughput Go Ingestion Core**: Non-blocking concurrent metric ingestion engine built in Go with streaming buffers, rate-limiting, and sequence-based replay protection.
- **TimescaleDB & PostgreSQL 16**: High-velocity time-series storage with continuous aggregates, automated rollups, and 30-day retention policies.
- **Obsidian Glassmorphic UI**: Sleek dark-mode interface built with React 18, Tailwind CSS, Recharts, and TanStack Query.
- **Synthetic Probing Engine**: Automated periodic checks across process states, TCP ports, HTTP endpoints, and custom bash scripts.
- **Incident Lifecycle Management**: Multi-stage incident triage (Open, Acknowledged, Resolved) with timeline events, root cause audit trails, and channel dispatch.
- **Zero-Dependency Demo Mode**: Automatic fallback to in-memory fleet simulation when running locally without a live database.

---

## 🏗️ Architecture

```
                               +-----------------------------+
                               |    Target Host (Linux)      |
                               |  +-----------------------+  |
                               |  |  sentrix-agent (C11)  |  |
                               |  |  - CPU / Load Avg     |  |
                               |  |  - RAM / Swap         |  |
                               |  |  - Multi-NIC Traffic  |  |
                               |  |  - Disk / I/O IOPS    |  |
                               |  |  - Synthetic Probes   |  |
                               |  +-----------+-----------+  |
                               +--------------|--------------+
                                              | HTTP POST (JSON)
                                              v
+-----------------------------------------------------------------------------------------+
|                                    SentriX Server (Go)                                  |
|                                                                                         |
|   +-----------------------+     +-----------------------+     +---------------------+   |
|   |  Ingestion / Auth     | --> |   Alerting Engine     | --> |  Notification Hub   |   |
|   |  - Token & JWT Guard  |     |   - Threshold Rules   |     |  - Slack Webhook    |   |
|   |  - Sequence Replay    |     |   - Incident Engine   |     |  - Discord Webhook  |   |
|   |  - Rate Limiter       |     |   - Hysteresis/Cool   |     |  - PagerDuty API    |   |
|   +-----------+-----------+     +-----------------------+     +---------------------+   |
|               |                                                                         |
|               +-----------------------------+-----------------------------+             |
|                                             |                             |             |
|                                             v                             v             |
|                                  +--------------------+        +--------------------+   |
|                                  | TimescaleDB (pg16) |        | WebSocket Hub      |   |
|                                  | - Hypertables      |        | - Live Metrics     |   |
|                                  | - Continuous Aggs  |        | - State Streaming  |   |
|                                  | - Retention Policy |        +----------+---------+   |
|                                  +--------------------+                   |             |
+---------------------------------------------------------------------------|-------------+
                                                                            |
                                                                            v
                                                       +----------------------------------+
                                                       |     React Web Dashboard          |
                                                       |  - Fleet Bento Grid              |
                                                       |  - 1-Click Agent Enrollment      |
                                                       |  - Team & RBAC Management        |
                                                       |  - Channels & Alert Outlets      |
                                                       +----------------------------------+
```

---

## 🚀 Quick Start

### Option 1: Standalone Demo Mode (Zero Dependencies)

Run SentriX locally in seconds without needing PostgreSQL or TimescaleDB installed:

```bash
# 1. Build the web frontend
cd web
npm install
npm run build

# 2. Build and run the server
cd ../server
go build -o ../dist/sentrix-server.exe ./cmd/sentrix-server
cd ../dist
./sentrix-server.exe
```

Access the dashboard at **[http://localhost:8080](http://localhost:8080)**:
- **Default User**: `admin@sentrix.local`
- **Default Password**: `admin12345`

---

### Option 2: Docker Compose (Full Production Stack)

Deploy the entire observability suite with TimescaleDB containerized:

```bash
# Clone the repository
git clone https://github.com/kunal-gin/SentriX.git
cd SentriX

# Launch TimescaleDB and database migrations
docker compose -f deploy/compose/docker-compose.yml up -d

# Start SentriX backend and web dashboard
cd server
go run ./cmd/sentrix-server
```

---

## 💻 Native C Agent Installation

### Quick 1-Click Enrollment (via Web UI)
1. Navigate to the **Fleet Overview** in the dashboard.
2. Click **"Enroll Node"**.
3. Copy the pre-configured single-use installation snippet and paste it into your target Linux terminal:

```bash
curl -sSL http://<your-sentrix-host>:8080/install.sh | \
  sudo bash -s -- --token <ENROLLMENT_TOKEN> --server http://<your-sentrix-host>:8080
```

### Manual Compilation on Linux

```bash
cd agent
mkdir -p build && cd build
cmake .. -DCMAKE_BUILD_TYPE=Release
make -j$(nproc)

# Run with custom parameters:
./sentrix-agent -s "192.168.1.50" -p 8080 -i "prod-app-01" -t "secret-token" -c 5
```

Configuration can also be placed in `/etc/sentrix/agent.env`:
```env
SENTRIX_HOST=192.168.1.50
SENTRIX_PORT=8080
SENTRIX_AGENT_ID=srv-node-01
SENTRIX_TOKEN=stx_enroll_token_xyz
SENTRIX_INTERVAL=5
```

---

## 📦 API Reference Overview

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/v1/auth/login` | Authenticate user credentials & issue JWT tokens |
| `POST` | `/api/v1/auth/refresh` | Refresh expired access tokens |
| `POST` | `/api/v1/auth/ws-ticket` | Generate temporary ticket for WebSocket streaming |
| `GET` | `/api/v1/dashboard/summary` | Global fleet counts, health statistics, and metrics |
| `GET` | `/api/v1/servers` | List registered server nodes and online/offline status |
| `DELETE` | `/api/v1/servers/{id}` | Decommission server node and purge telemetry |
| `GET` | `/api/v1/servers/{id}/metrics` | Historical time-series metrics query |
| `POST` | `/api/v1/agent/telemetry` | High-throughput metric ingestion from C agents |
| `POST` | `/api/v1/agents/enrollment-tokens` | Generate 24-hour single-use agent enrollment tokens |
| `GET` | `/api/v1/users` | List workspace team members |
| `POST` | `/api/v1/users/invite` | Invite team members with RBAC (`ADMIN`, `OPERATOR`, `VIEWER`) |
| `GET` | `/api/v1/notifications/channels` | List notification destinations |
| `POST` | `/api/v1/notifications/channels` | Create Slack/Discord/PagerDuty webhook channels |
| `POST` | `/api/v1/notifications/channels/{id}/test` | Trigger instant webhook verification test |

---

## 🧪 Testing & Verification

Run the test suite across components:

```bash
# Run Go unit tests
cd server
go test -v ./...

# Build and type-check frontend
cd ../web
npm run build
```

---

## 📄 License

SentriX is licensed under the [Apache 2.0 License](LICENSE).
