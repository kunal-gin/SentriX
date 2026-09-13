package checks

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/sentrix/server/internal/auth"
)

type CheckListItem struct {
	ID                  string          `json:"id"`
	ServerID            string          `json:"server_id"`
	ServerName          string          `json:"server_name"`
	Type                string          `json:"type"`
	Name                string          `json:"name"`
	Enabled             bool            `json:"enabled"`
	IntervalSeconds     int             `json:"interval_seconds"`
	TimeoutSeconds      int             `json:"timeout_seconds"`
	FailureThreshold    int             `json:"failure_threshold"`
	SuccessThreshold    int             `json:"success_threshold"`
	Severity            string          `json:"severity"`
	Config              json.RawMessage `json:"config"`
	State               *string         `json:"state"`
	ConsecutiveFailures *int            `json:"consecutive_failures"`
	LastMessage         *string         `json:"last_message"`
	LastResultAt        *time.Time      `json:"last_result_at"`
	CreatedAt           time.Time       `json:"created_at"`
}

type CreateCheckRequest struct {
	ServerID         string          `json:"server_id"`
	Type             string          `json:"type"`
	Name             string          `json:"name"`
	Enabled          *bool           `json:"enabled"`
	IntervalSeconds  int             `json:"interval_seconds"`
	TimeoutSeconds   int             `json:"timeout_seconds"`
	FailureThreshold int             `json:"failure_threshold"`
	SuccessThreshold int             `json:"success_threshold"`
	Severity         string          `json:"severity"`
	Config           json.RawMessage `json:"config"`
}

type UpdateCheckRequest struct {
	Enabled          *bool   `json:"enabled"`
	IntervalSeconds  *int    `json:"interval_seconds"`
	TimeoutSeconds   *int    `json:"timeout_seconds"`
	FailureThreshold *int    `json:"failure_threshold"`
	SuccessThreshold *int    `json:"success_threshold"`
	Severity         *string `json:"severity"`
}

var allowedCheckTypes = map[string]bool{
	"PROCESS": true,
	"SERVICE": true,
	"PORT":    true,
	"COMMAND": true,
}

var allowedCheckSeverities = map[string]bool{
	"INFO":     true,
	"WARNING":  true,
	"CRITICAL": true,
}

// GET /api/v1/checks?server_id=...
func HandleListChecks(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		serverID := r.URL.Query().Get("server_id")

		var serverIDParam interface{}
		if serverID != "" {
			serverIDParam = serverID
		}

		rows, err := pool.Query(r.Context(), `
			SELECT
				c.id,
				c.server_id,
				s.name AS server_name,
				c.type,
				c.name,
				c.enabled,
				c.interval_seconds,
				c.timeout_seconds,
				c.failure_threshold,
				c.success_threshold,
				c.severity,
				c.config,
				st.state,
				st.consecutive_failures,
				st.last_message,
				st.last_result_at,
				c.created_at
			FROM checks c
			JOIN servers s ON s.id = c.server_id
			LEFT JOIN check_states st ON st.check_id = c.id
			WHERE ($1::uuid IS NULL OR c.server_id = $1::uuid)
			ORDER BY c.created_at DESC
		`, serverIDParam)

		if err != nil {
			http.Error(w, "database query failed", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		items := []CheckListItem{}

		for rows.Next() {
			var item CheckListItem
			var configBytes []byte

			err := rows.Scan(
				&item.ID,
				&item.ServerID,
				&item.ServerName,
				&item.Type,
				&item.Name,
				&item.Enabled,
				&item.IntervalSeconds,
				&item.TimeoutSeconds,
				&item.FailureThreshold,
				&item.SuccessThreshold,
				&item.Severity,
				&configBytes,
				&item.State,
				&item.ConsecutiveFailures,
				&item.LastMessage,
				&item.LastResultAt,
				&item.CreatedAt,
			)

			if err != nil {
				http.Error(w, "scan failed", http.StatusInternalServerError)
				return
			}

			item.Config = configBytes
			items = append(items, item)
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(items)
	}
}

// POST /api/v1/checks
func HandleCreateCheck(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req CreateCheckRequest

		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid JSON", http.StatusBadRequest)
			return
		}

		if req.ServerID == "" {
			http.Error(w, "server_id is required", http.StatusBadRequest)
			return
		}

		req.Type = strings.ToUpper(req.Type)

		if !allowedCheckTypes[req.Type] {
			http.Error(w, "unsupported check type", http.StatusBadRequest)
			return
		}

		if req.Name == "" {
			http.Error(w, "name is required", http.StatusBadRequest)
			return
		}

		if req.IntervalSeconds <= 0 {
			req.IntervalSeconds = 15
		}

		if req.TimeoutSeconds <= 0 {
			req.TimeoutSeconds = 5
		}

		if req.FailureThreshold <= 0 {
			req.FailureThreshold = 3
		}

		if req.SuccessThreshold <= 0 {
			req.SuccessThreshold = 1
		}

		if req.Severity == "" {
			req.Severity = "CRITICAL"
		}

		if !allowedCheckSeverities[req.Severity] {
			http.Error(w, "unsupported severity", http.StatusBadRequest)
			return
		}

		if len(req.Config) == 0 {
			req.Config = json.RawMessage("{}")
		}

		if err := validateCheckConfig(req.Type, req.Config); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		enabled := true
		if req.Enabled != nil {
			enabled = *req.Enabled
		}

		id := uuid.New()

		actor := auth.GetUser(r)
		var actorID *string
		if actor != nil {
			actorID = &actor.ID
		}

		_, err := pool.Exec(r.Context(), `
			INSERT INTO checks (
				id,
				server_id,
				type,
				name,
				enabled,
				interval_seconds,
				timeout_seconds,
				failure_threshold,
				success_threshold,
				severity,
				config,
				created_by
			) VALUES (
				$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
			)
		`,
			id,
			req.ServerID,
			req.Type,
			req.Name,
			enabled,
			req.IntervalSeconds,
			req.TimeoutSeconds,
			req.FailureThreshold,
			req.SuccessThreshold,
			req.Severity,
			[]byte(req.Config),
			actorID,
		)

		if err != nil {
			http.Error(w, "database insert failed", http.StatusInternalServerError)
			return
		}

		auth.WriteAudit(
			r.Context(),
			pool,
			actorID,
			"check.create",
			"check",
			id.String(),
			auth.ClientIP(r),
			map[string]any{
				"name":       req.Name,
				"type":       req.Type,
				"server_id":  req.ServerID,
				"enabled":    enabled,
				"severity":   req.Severity,
			},
		)

		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(map[string]string{
			"id": id.String(),
		})
	}
}

// PATCH /api/v1/checks/{checkID}
func HandleUpdateCheck(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		checkID := chi.URLParam(r, "checkID")

		var req UpdateCheckRequest

		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid JSON", http.StatusBadRequest)
			return
		}

		var enabled bool
		var intervalSeconds int
		var timeoutSeconds int
		var failureThreshold int
		var successThreshold int
		var severity string

		err := pool.QueryRow(r.Context(), `
			SELECT
				enabled,
				interval_seconds,
				timeout_seconds,
				failure_threshold,
				success_threshold,
				severity
			FROM checks
			WHERE id = $1
		`, checkID).Scan(
			&enabled,
			&intervalSeconds,
			&timeoutSeconds,
			&failureThreshold,
			&successThreshold,
			&severity,
		)

		if err != nil {
			http.Error(w, "check not found", http.StatusNotFound)
			return
		}

		if req.Enabled != nil {
			enabled = *req.Enabled
		}

		if req.IntervalSeconds != nil {
			intervalSeconds = *req.IntervalSeconds
		}

		if req.TimeoutSeconds != nil {
			timeoutSeconds = *req.TimeoutSeconds
		}

		if req.FailureThreshold != nil {
			failureThreshold = *req.FailureThreshold
		}

		if req.SuccessThreshold != nil {
			successThreshold = *req.SuccessThreshold
		}

		if req.Severity != nil {
			severity = *req.Severity
		}

		if !allowedCheckSeverities[severity] {
			http.Error(w, "unsupported severity", http.StatusBadRequest)
			return
		}

		_, err = pool.Exec(r.Context(), `
			UPDATE checks
			SET
				enabled = $2,
				interval_seconds = $3,
				timeout_seconds = $4,
				failure_threshold = $5,
				success_threshold = $6,
				severity = $7,
				updated_at = NOW()
			WHERE id = $1
		`,
			checkID,
			enabled,
			intervalSeconds,
			timeoutSeconds,
			failureThreshold,
			successThreshold,
			severity,
		)

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
			"check.update",
			"check",
			checkID,
			auth.ClientIP(r),
			map[string]any{
				"enabled": enabled,
			},
		)

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"id": checkID,
		})
	}
}

// DELETE /api/v1/checks/{checkID}
func HandleDeleteCheck(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		checkID := chi.URLParam(r, "checkID")

		_, err := pool.Exec(r.Context(), `
			DELETE FROM checks
			WHERE id = $1
		`, checkID)

		if err != nil {
			http.Error(w, "database delete failed", http.StatusInternalServerError)
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
			"check.delete",
			"check",
			checkID,
			auth.ClientIP(r),
			nil,
		)

		w.WriteHeader(http.StatusNoContent)
	}
}

func validateCheckConfig(checkType string, raw json.RawMessage) error {
	var cfg map[string]any

	if err := json.Unmarshal(raw, &cfg); err != nil {
		return errors.New("config must be valid JSON")
	}

	switch checkType {
	case "PROCESS":
		name, ok := cfg["name"].(string)
		if !ok || strings.TrimSpace(name) == "" {
			return errors.New("process check requires config.name")
		}

	case "SERVICE":
		unit, ok := cfg["unit"].(string)
		if !ok || strings.TrimSpace(unit) == "" {
			return errors.New("service check requires config.unit")
		}

	case "PORT":
		host, ok := cfg["host"].(string)
		if !ok || strings.TrimSpace(host) == "" {
			return errors.New("port check requires config.host")
		}

		port, ok := cfg["port"].(float64)
		if !ok {
			return errors.New("port check requires numeric config.port")
		}

		if port < 1 || port > 65535 {
			return errors.New("port must be between 1 and 65535")
		}

	case "COMMAND":
		command, ok := cfg["command"].(string)
		if !ok || strings.TrimSpace(command) == "" {
			return errors.New("command check requires config.command")
		}

	default:
		return errors.New("unsupported check type")
	}

	return nil
}
