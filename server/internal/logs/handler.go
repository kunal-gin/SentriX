package logs

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/sentrix/server/internal/api"
)

type StructuredLogEntry struct {
	ID        string    `json:"id"`
	Timestamp time.Time `json:"timestamp"`
	Level     string    `json:"level"` // ERROR, WARN, INFO, DEBUG
	Service   string    `json:"service"`
	Server    string    `json:"server"`
	ServerID  string    `json:"server_id"`
	Message   string    `json:"message"`
	TraceID   string    `json:"trace_id,omitempty"`
	RequestID string    `json:"request_id,omitempty"`
}

type BatchLogsRequest struct {
	ServerID string               `json:"server_id"`
	Logs     []StructuredLogEntry `json:"logs"`
}

var (
	logStoreMu sync.RWMutex
	logBuffer  []StructuredLogEntry
)

func init() {
	now := time.Now().UTC()
	logBuffer = []StructuredLogEntry{
		{
			ID:        "log-001",
			Timestamp: now.Add(-2 * time.Minute),
			Level:     "ERROR",
			Service:   "telemetry-engine",
			Server:    "timescale-db-cluster-01",
			ServerID:  "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e",
			Message:   "PostgreSQL connection buffer exceeded maximum pool allocation: 96% utilization",
			TraceID:   "trc_9a8b7c6d5e4f",
			RequestID: "req_bf1082a9381c",
		},
		{
			ID:        "log-002",
			Timestamp: now.Add(-5 * time.Minute),
			Level:     "WARN",
			Service:   "payments-service",
			Server:    "production-api-01",
			ServerID:  "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
			Message:   "Payment webhook delivery retry 2 of 3 to stripe endpoint; latency 840ms",
			TraceID:   "trc_1e2d3c4b5a6f",
			RequestID: "req_4901238910ac",
		},
		{
			ID:        "log-003",
			Timestamp: now.Add(-10 * time.Minute),
			Level:     "INFO",
			Service:   "auth-gateway",
			Server:    "production-api-01",
			ServerID:  "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
			Message:   "OIDC authorization exchange completed successfully for admin@sentrix.local",
			TraceID:   "trc_5b4c3d2e1a90",
			RequestID: "req_aa129034ef81",
		},
		{
			ID:        "log-004",
			Timestamp: now.Add(-15 * time.Minute),
			Level:     "ERROR",
			Service:   "edge-ingress",
			Server:    "edge-ingress-proxy-02",
			ServerID:  "d4e5f6a7-b8c9-4d0e-1f2a-3b4c5d6e7f8a",
			Message:   "SSL handshake timeout from peer 198.51.100.44: TLS protocol alert decode error",
			TraceID:   "trc_8899aabbccdd",
			RequestID: "req_fe3300112299",
		},
		{
			ID:        "log-005",
			Timestamp: now.Add(-20 * time.Minute),
			Level:     "INFO",
			Service:   "worker-runner",
			Server:    "worker-queue-runner-01",
			ServerID:  "c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f",
			Message:   "Telemetry rollup downsampling job completed in 142ms; 12,400 raw samples processed",
			TraceID:   "trc_776655443322",
			RequestID: "req_881122334455",
		},
		{
			ID:        "log-006",
			Timestamp: now.Add(-25 * time.Minute),
			Level:     "WARN",
			Service:   "telemetry-engine",
			Server:    "timescale-db-cluster-01",
			ServerID:  "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e",
			Message:   "Hypertable chunk compression delayed due to high disk IOps latency (18.4ms)",
			TraceID:   "trc_334455667788",
			RequestID: "req_998877665544",
		},
	}
}

// GET /api/v1/logs
func HandleSearchLogs(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		query := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("query")))
		level := strings.ToUpper(strings.TrimSpace(r.URL.Query().Get("level")))
		service := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("service")))
		serverID := strings.TrimSpace(r.URL.Query().Get("server_id"))
		traceID := strings.TrimSpace(r.URL.Query().Get("trace_id"))
		limitParam := r.URL.Query().Get("limit")

		limit := 100
		if limitParam != "" {
			if parsed, err := strconv.Atoi(limitParam); err == nil && parsed > 0 && parsed <= 500 {
				limit = parsed
			}
		}

		logStoreMu.RLock()
		defer logStoreMu.RUnlock()

		filtered := make([]StructuredLogEntry, 0)
		for _, item := range logBuffer {
			if level != "" && level != "ALL" && item.Level != level {
				continue
			}
			if service != "" && !strings.Contains(strings.ToLower(item.Service), service) {
				continue
			}
			if serverID != "" && item.ServerID != serverID {
				continue
			}
			if traceID != "" && item.TraceID != traceID {
				continue
			}
			if query != "" {
				inMsg := strings.Contains(strings.ToLower(item.Message), query)
				inSvc := strings.Contains(strings.ToLower(item.Service), query)
				inSrv := strings.Contains(strings.ToLower(item.Server), query)
				if !inMsg && !inSvc && !inSrv {
					continue
				}
			}

			filtered = append(filtered, item)
			if len(filtered) >= limit {
				break
			}
		}

		api.RespondJSON(w, http.StatusOK, map[string]any{
			"total": len(filtered),
			"logs":  filtered,
		})
	}
}

// POST /api/v1/logs/batch
func HandleBatchLogs(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req BatchLogsRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			api.RespondError(w, r, http.StatusBadRequest, "INVALID_BODY", "Invalid batch logs payload")
			return
		}

		now := time.Now().UTC()
		logStoreMu.Lock()
		for _, entry := range req.Logs {
			if entry.ID == "" {
				entry.ID = "log-" + uuid.New().String()[:8]
			}
			if entry.Timestamp.IsZero() {
				entry.Timestamp = now
			}
			if entry.ServerID == "" {
				entry.ServerID = req.ServerID
			}
			logBuffer = append([]StructuredLogEntry{entry}, logBuffer...)
		}
		// Cap memory buffer to last 2000 log items
		if len(logBuffer) > 2000 {
			logBuffer = logBuffer[:2000]
		}
		logStoreMu.Unlock()

		api.RespondJSON(w, http.StatusAccepted, map[string]any{
			"status":   "accepted",
			"ingested": len(req.Logs),
		})
	}
}
