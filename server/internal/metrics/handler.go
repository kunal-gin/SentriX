package metrics

import (
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/sentrix/server/internal/realtime"
	"github.com/sentrix/server/internal/selfmetrics"
)

func hashCredential(raw string) string {
	sum := sha256.Sum256([]byte(raw))
	return base64.StdEncoding.EncodeToString(sum[:])
}

// AgentAuthMiddleware validates agent bearer token.
func AgentAuthMiddleware(pool *pgxpool.Pool) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			authHeader := r.Header.Get("Authorization")
			if len(authHeader) < 7 || !strings.EqualFold(authHeader[:7], "Bearer ") {
				http.Error(w, "Unauthorized", http.StatusUnauthorized)
				return
			}
			token := strings.TrimSpace(authHeader[7:])
			hashed := hashCredential(token)

			var agentID string
			err := pool.QueryRow(r.Context(), "SELECT id FROM agents WHERE (credential_hash = $1 OR credential_hash = $2) AND status = 'ACTIVE'", hashed, token).Scan(&agentID)
			if err != nil {
				http.Error(w, "Invalid credential", http.StatusUnauthorized)
				return
			}

			ctx := context.WithValue(r.Context(), "agent_id", agentID)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

type TelemetryPayload struct {
	AgentID   string    `json:"agent_id"`
	Timestamp time.Time `json:"timestamp"`
	Sequence  int64     `json:"sequence"`
	Metrics   []Metric  `json:"metrics"`
}

type Metric struct {
	Name   string            `json:"name"`
	Value  float64           `json:"value"`
	Unit   string            `json:"unit"`
	Labels map[string]string `json:"labels,omitempty"`
}

// POST /api/v1/agent/telemetry
func HandleTelemetry(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		agentID, ok := r.Context().Value("agent_id").(string)
		if !ok {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		selfmetrics.Global().IngestRequests.Add(1)

		var payload TelemetryPayload

		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			selfmetrics.Global().IngestFailures.Add(1)
			http.Error(w, "invalid JSON", http.StatusBadRequest)
			return
		}

		if len(payload.Metrics) == 0 {
			selfmetrics.Global().IngestFailures.Add(1)
			http.Error(w, "no metrics provided", http.StatusBadRequest)
			return
		}

		if len(payload.Metrics) > 1000 {
			selfmetrics.Global().IngestFailures.Add(1)
			http.Error(w, "too many metrics in payload", http.StatusBadRequest)
			return
		}

		now := time.Now()

		if payload.Timestamp.IsZero() {
			payload.Timestamp = now
		}

		drift := now.Sub(payload.Timestamp)
		if drift < 0 {
			drift = -drift
		}

		if drift > 5*time.Minute {
			selfmetrics.Global().IngestFailures.Add(1)
			http.Error(w, "timestamp outside acceptance window", http.StatusBadRequest)
			return
		}

		if payload.Sequence < 0 {
			selfmetrics.Global().IngestFailures.Add(1)
			http.Error(w, "invalid sequence number", http.StatusBadRequest)
			return
		}

		ctx := r.Context()

		tx, err := pool.Begin(ctx)
		if err != nil {
			selfmetrics.Global().IngestFailures.Add(1)
			http.Error(w, "database error", http.StatusInternalServerError)
			return
		}
		defer tx.Rollback(ctx)

		var lastSequence int64
		var lastTelemetryAt *time.Time

		err = tx.QueryRow(ctx, `
			SELECT last_sequence, last_telemetry_at
			FROM agents
			WHERE id = $1
			FOR UPDATE
		`, agentID).Scan(&lastSequence, &lastTelemetryAt)

		if err != nil {
			selfmetrics.Global().IngestFailures.Add(1)
			http.Error(w, "invalid agent", http.StatusUnauthorized)
			return
		}

		// Replay / duplicate protection.
		if payload.Sequence <= lastSequence {
			// Exact duplicate is accepted idempotently but not reprocessed.
			if payload.Sequence == lastSequence &&
				lastTelemetryAt != nil &&
				payload.Timestamp.Equal(*lastTelemetryAt) {

				w.WriteHeader(http.StatusAccepted)
				w.Write([]byte(`{"status":"duplicate"}`))
				return
			}

			// Allow agent restart sequence reset only when moving forward in time.
			allowReset := payload.Sequence == 1 &&
				lastTelemetryAt != nil &&
				payload.Timestamp.After(*lastTelemetryAt)

			if !allowReset {
				selfmetrics.Global().IngestFailures.Add(1)
				http.Error(w, "stale or replayed sequence", http.StatusConflict)
				return
			}
		}

		_, err = tx.Exec(ctx, `
			UPDATE agents
			SET
				last_sequence = $2,
				last_telemetry_at = $3
			WHERE id = $1
		`, agentID, payload.Sequence, payload.Timestamp)

		if err != nil {
			selfmetrics.Global().IngestFailures.Add(1)
			http.Error(w, "database error", http.StatusInternalServerError)
			return
		}

		var serverID string

		err = tx.QueryRow(ctx, `
			SELECT id
			FROM servers
			WHERE agent_id = $1
		`, agentID).Scan(&serverID)

		if err != nil {
			selfmetrics.Global().IngestFailures.Add(1)
			http.Error(w, "server not found for agent", http.StatusNotFound)
			return
		}

		batch := &pgx.Batch{}

		for _, m := range payload.Metrics {
			var tableName string

			switch m.Name {
			case "system.cpu.utilization":
				tableName = "metric_cpu"
			case "system.memory.utilization":
				tableName = "metric_memory"
			case "system.disk.utilization":
				tableName = "metric_disk"
			default:
				continue
			}

			query := "INSERT INTO " + tableName + " (time, server_id, value) VALUES ($1, $2, $3)"
			batch.Queue(query, payload.Timestamp, serverID, m.Value)
		}

		batch.Queue(`
			UPDATE servers
			SET
				last_seen_at = $1,
				status = 'ONLINE'
			WHERE id = $2
		`, now, serverID)

		br := tx.SendBatch(ctx, batch)

		if _, err := br.Exec(); err != nil {
			br.Close()
			selfmetrics.Global().IngestFailures.Add(1)
			http.Error(w, "database write error", http.StatusInternalServerError)
			return
		}

		br.Close()

		if err := tx.Commit(ctx); err != nil {
			selfmetrics.Global().IngestFailures.Add(1)
			http.Error(w, "database error", http.StatusInternalServerError)
			return
		}

		selfmetrics.Global().IngestSamples.Add(int64(len(payload.Metrics)))

		realtime.PublishServerUpdated(serverID)
		realtime.PublishServerTelemetry(serverID)
		realtime.PublishDashboardUpdated()

		w.WriteHeader(http.StatusAccepted)
		w.Write([]byte(`{"status":"accepted"}`))
	}
}
