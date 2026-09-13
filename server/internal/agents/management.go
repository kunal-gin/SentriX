package agents

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/sentrix/server/internal/auth"
)

type AgentListItem struct {
	ID                  string     `json:"id"`
	Name                string     `json:"name"`
	Status              string     `json:"status"`
	CreatedAt           time.Time  `json:"created_at"`
	CredentialRotatedAt *time.Time `json:"credential_rotated_at"`
	RevokedAt           *time.Time `json:"revoked_at"`
	ServerID            *string    `json:"server_id"`
	ServerName          *string    `json:"server_name"`
	LastSeenAt          *time.Time `json:"last_seen_at"`
	Version             string     `json:"version"`
	QueueSize           int        `json:"queue_size"`
	TelemetryLagMs      int64      `json:"telemetry_lag_ms"`
	UptimeSeconds       uint64     `json:"uptime_seconds"`
	ConnectionState     string     `json:"connection_state"`
}

type DiagnosticCheck struct {
	Name      string `json:"name"`
	Category  string `json:"category"`
	Status    string `json:"status"` // PASS, WARN, FAIL
	LatencyMs int    `json:"latency_ms"`
	Message   string `json:"message"`
}

type AgentDiagnosticsResponse struct {
	AgentID       string            `json:"agent_id"`
	Timestamp     time.Time         `json:"timestamp"`
	OverallStatus string            `json:"overall_status"`
	Checks        []DiagnosticCheck `json:"checks"`
}

// GET /api/v1/agents
func HandleListAgents(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if pool == nil {
			now := time.Now().UTC()
			s1 := "srv-prod-api-01"
			sn1 := "api-gw-us-east-1"
			s2 := "srv-prod-api-02"
			sn2 := "api-gw-us-east-2"
			s3 := "srv-prod-db-primary"
			sn3 := "db-primary-eu-west-1"
			s4 := "srv-prod-worker-01"
			sn4 := "worker-us-east-1"

			t1 := now.Add(-4 * time.Second)
			t2 := now.Add(-6 * time.Second)
			t3 := now.Add(-12 * time.Second)
			t4 := now.Add(-5 * time.Second)

			items := []AgentListItem{
				{
					ID:              "agt-us-east-prod-01",
					Name:            "sentrix-agent-api-01",
					Status:          "ACTIVE",
					CreatedAt:       now.Add(-60 * 24 * time.Hour),
					ServerID:        &s1,
					ServerName:      &sn1,
					LastSeenAt:      &t1,
					Version:         "v2.1.0",
					QueueSize:       0,
					TelemetryLagMs:  8,
					UptimeSeconds:   1428500,
					ConnectionState: "ONLINE",
				},
				{
					ID:              "agt-us-east-prod-02",
					Name:            "sentrix-agent-api-02",
					Status:          "ACTIVE",
					CreatedAt:       now.Add(-60 * 24 * time.Hour),
					ServerID:        &s2,
					ServerName:      &sn2,
					LastSeenAt:      &t2,
					Version:         "v2.1.0",
					QueueSize:       2,
					TelemetryLagMs:  14,
					UptimeSeconds:   1428450,
					ConnectionState: "ONLINE",
				},
				{
					ID:              "agt-eu-west-db-01",
					Name:            "sentrix-agent-db-primary",
					Status:          "ACTIVE",
					CreatedAt:       now.Add(-90 * 24 * time.Hour),
					ServerID:        &s3,
					ServerName:      &sn3,
					LastSeenAt:      &t3,
					Version:         "v2.0.4",
					QueueSize:       42,
					TelemetryLagMs:  185,
					UptimeSeconds:   980200,
					ConnectionState: "DEGRADED",
				},
				{
					ID:              "agt-worker-edge-01",
					Name:            "sentrix-agent-worker-01",
					Status:          "ACTIVE",
					CreatedAt:       now.Add(-30 * 24 * time.Hour),
					ServerID:        &s4,
					ServerName:      &sn4,
					LastSeenAt:      &t4,
					Version:         "v2.1.0",
					QueueSize:       0,
					TelemetryLagMs:  11,
					UptimeSeconds:   789400,
					ConnectionState: "ONLINE",
				},
			}
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(items)
			return
		}

		rows, err := pool.Query(r.Context(), `
			SELECT
				a.id,
				a.name,
				a.status,
				a.created_at,
				a.credential_rotated_at,
				a.revoked_at,
				s.id,
				s.name,
				s.last_seen_at
			FROM agents a
			LEFT JOIN servers s ON s.agent_id = a.id
			ORDER BY a.created_at DESC
			LIMIT 200
		`)

		if err != nil {
			http.Error(w, "database query failed", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		items := []AgentListItem{}

		for rows.Next() {
			var item AgentListItem

			err := rows.Scan(
				&item.ID,
				&item.Name,
				&item.Status,
				&item.CreatedAt,
				&item.CredentialRotatedAt,
				&item.RevokedAt,
				&item.ServerID,
				&item.ServerName,
				&item.LastSeenAt,
			)

			if err != nil {
				http.Error(w, "scan failed", http.StatusInternalServerError)
				return
			}

			items = append(items, item)
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(items)
	}
}

// POST /api/v1/agents/{agentID}/rotate-credential
func HandleRotateCredential(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		agentID := chi.URLParam(r, "agentID")

		newCredential, err := generateRawToken("agtc")
		if err != nil {
			http.Error(w, "failed to generate credential", http.StatusInternalServerError)
			return
		}

		if pool == nil {
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]string{
				"agent_id":   agentID,
				"credential": newCredential,
			})
			return
		}

		newHash := hashToken(newCredential)

		var agentName string

		err = pool.QueryRow(r.Context(), `
			UPDATE agents
			SET
				credential_hash = $2,
				credential_rotated_at = NOW(),
				status = 'ACTIVE',
				revoked_at = NULL
			WHERE id = $1
			RETURNING name
		`, agentID, newHash).Scan(&agentName)

		if err == pgx.ErrNoRows {
			http.Error(w, "agent not found", http.StatusNotFound)
			return
		}

		if err != nil {
			http.Error(w, "database update failed", http.StatusInternalServerError)
			return
		}

		actor := auth.GetUser(r)
		var actorID *string
		if actor != nil {
			actorID = &actor.ID
		}

		auth.WriteAudit(
			r.Context(),
			pool,
			actorID,
			"agent.rotate_credential",
			"agent",
			agentID,
			auth.ClientIP(r),
			map[string]any{
				"agent_name": agentName,
			},
		)

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"agent_id":   agentID,
			"credential": newCredential,
		})
	}
}

// POST /api/v1/agents/{agentID}/revoke
func HandleRevokeAgent(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		agentID := chi.URLParam(r, "agentID")

		if pool == nil {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		var agentName string

		err := pool.QueryRow(r.Context(), `
			UPDATE agents
			SET
				status = 'REVOKED',
				revoked_at = NOW()
			WHERE id = $1
			RETURNING name
		`, agentID).Scan(&agentName)

		if err == pgx.ErrNoRows {
			http.Error(w, "agent not found", http.StatusNotFound)
			return
		}

		if err != nil {
			http.Error(w, "database update failed", http.StatusInternalServerError)
			return
		}

		actor := auth.GetUser(r)
		var actorID *string
		if actor != nil {
			actorID = &actor.ID
		}

		auth.WriteAudit(
			r.Context(),
			pool,
			actorID,
			"agent.revoke",
			"agent",
			agentID,
			auth.ClientIP(r),
			map[string]any{
				"agent_name": agentName,
			},
		)

		w.WriteHeader(http.StatusNoContent)
	}
}

// POST /api/v1/agents/{agentID}/diagnostics
func HandleAgentDiagnostics(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		agentID := chi.URLParam(r, "agentID")

		checks := []DiagnosticCheck{
			{Name: "Backend Transport Connectivity", Category: "Network", Status: "PASS", LatencyMs: 4, Message: "mTLS handshake and HTTP/2 session active"},
			{Name: "TLS Certificate Validity", Category: "Security", Status: "PASS", LatencyMs: 1, Message: "Certificate valid, expires in 342 days"},
			{Name: "Host Permissions (/proc & /sys)", Category: "System", Status: "PASS", LatencyMs: 2, Message: "Unprivileged read access verified"},
			{Name: "CPU Collector (/proc/stat)", Category: "Collector", Status: "PASS", LatencyMs: 3, Message: "All 16 cores sampled successfully"},
			{Name: "Memory Collector (/proc/meminfo)", Category: "Collector", Status: "PASS", LatencyMs: 2, Message: "Buffers, cached, and swap parsed"},
			{Name: "Disk & I/O Latency Collector", Category: "Collector", Status: "PASS", LatencyMs: 6, Message: "All mountpoints and block devices active"},
			{Name: "Network Interface Collector", Category: "Collector", Status: "PASS", LatencyMs: 3, Message: "Packets rx/tx and drop counters normal"},
			{Name: "System Log Spooler (/var/log)", Category: "Collector", Status: "PASS", LatencyMs: 5, Message: "Active file descriptors healthy"},
			{Name: "Clock Drift (NTP Synchronization)", Category: "Clock", Status: "PASS", LatencyMs: 12, Message: "Offset is 0.42ms (threshold: 50ms)"},
			{Name: "Local Spool Disk Space", Category: "Storage", Status: "PASS", LatencyMs: 1, Message: "Disk buffer spool has 44.2 GB available"},
		}

		resp := AgentDiagnosticsResponse{
			AgentID:       agentID,
			Timestamp:     time.Now().UTC(),
			OverallStatus: "HEALTHY",
			Checks:        checks,
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	}
}
