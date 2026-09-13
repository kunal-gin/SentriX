package checks

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
)

type agentCheck struct {
	ID             string          `json:"id"`
	Type           string          `json:"type"`
	Name           string          `json:"name"`
	TimeoutSeconds int             `json:"timeout_seconds"`
	Config         json.RawMessage `json:"config"`
}

type agentCheckResult struct {
	CheckID   string `json:"check_id"`
	Status    string `json:"status"`
	LatencyMs int    `json:"latency_ms"`
	Message   string `json:"message"`
}

type agentCheckResultsRequest struct {
	Results []agentCheckResult `json:"results"`
}

func serverIDFromAgent(ctx context.Context, pool *pgxpool.Pool, agentID string) (string, error) {
	var serverID string

	err := pool.QueryRow(ctx, `
		SELECT id
		FROM servers
		WHERE agent_id = $1
	`, agentID).Scan(&serverID)

	if err != nil {
		return "", err
	}

	return serverID, nil
}

// GET /api/v1/agent/checks
func HandleAgentChecks(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		agentID, ok := r.Context().Value("agent_id").(string)
		if !ok {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		serverID, err := serverIDFromAgent(r.Context(), pool, agentID)
		if err != nil {
			http.Error(w, "server not found for agent", http.StatusNotFound)
			return
		}

		rows, err := pool.Query(r.Context(), `
			SELECT
				id,
				type,
				name,
				timeout_seconds,
				config
			FROM checks
			WHERE server_id = $1
			  AND enabled = true
			ORDER BY created_at ASC
		`, serverID)

		if err != nil {
			http.Error(w, "database query failed", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		checks := []agentCheck{}

		for rows.Next() {
			var check agentCheck
			var configBytes []byte

			err := rows.Scan(
				&check.ID,
				&check.Type,
				&check.Name,
				&check.TimeoutSeconds,
				&configBytes,
			)

			if err != nil {
				http.Error(w, "scan failed", http.StatusInternalServerError)
				return
			}

			check.Config = configBytes
			checks = append(checks, check)
		}

		resp := struct {
			Checks []agentCheck `json:"checks"`
		}{
			Checks: checks,
		}

		body, err := json.Marshal(resp)
		if err != nil {
			http.Error(w, "serialization failed", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Content-Length", strconv.Itoa(len(body)))
		w.WriteHeader(http.StatusOK)
		w.Write(body)
	}
}

// POST /api/v1/agent/check-results
func HandleAgentCheckResults(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		agentID, ok := r.Context().Value("agent_id").(string)
		if !ok {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		serverID, err := serverIDFromAgent(r.Context(), pool, agentID)
		if err != nil {
			http.Error(w, "server not found for agent", http.StatusNotFound)
			return
		}

		var req agentCheckResultsRequest

		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid JSON", http.StatusBadRequest)
			return
		}

		if len(req.Results) > 1000 {
			http.Error(w, "too many results", http.StatusBadRequest)
			return
		}

		for _, result := range req.Results {
			if result.CheckID == "" {
				continue
			}

			var checkServerID string

			err := pool.QueryRow(r.Context(), `
				SELECT server_id
				FROM checks
				WHERE id = $1
			`, result.CheckID).Scan(&checkServerID)

			if err != nil {
				continue
			}

			if checkServerID != serverID {
				continue
			}

			status := "FAIL"
			if strings.EqualFold(result.Status, "OK") {
				status = "OK"
			}

			_ = ProcessResult(
				r.Context(),
				pool,
				result.CheckID,
				serverID,
				status,
				result.LatencyMs,
				result.Message,
			)
		}

		w.WriteHeader(http.StatusAccepted)
		w.Write([]byte(`{"status":"accepted"}`))
	}
}
