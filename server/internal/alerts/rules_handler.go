package alerts

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type AlertRule struct {
	ID               string     `json:"id"`
	Name             string     `json:"name"`
	Metric           string     `json:"metric"`
	Operator         string     `json:"operator"`
	Threshold        float64    `json:"threshold"`
	WindowSeconds    int        `json:"window_seconds"`
	ForSeconds       int        `json:"for_seconds"`
	Severity         string     `json:"severity"`
	Enabled          bool       `json:"enabled"`
	CooldownSeconds  int        `json:"cooldown_seconds"`
	ResolveThreshold *float64   `json:"resolve_threshold"`
	CreatedAt        time.Time  `json:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at"`
}

type CreateAlertRuleRequest struct {
	Name             string   `json:"name"`
	Metric           string   `json:"metric"`
	Operator         string   `json:"operator"`
	Threshold        float64  `json:"threshold"`
	WindowSeconds    int      `json:"window_seconds"`
	ForSeconds       int      `json:"for_seconds"`
	Severity         string   `json:"severity"`
	Enabled          *bool    `json:"enabled"`
	CooldownSeconds  int      `json:"cooldown_seconds"`
	ResolveThreshold *float64 `json:"resolve_threshold"`
}

type UpdateAlertRuleRequest struct {
	Name             *string   `json:"name"`
	Threshold        *float64  `json:"threshold"`
	ForSeconds       *int      `json:"for_seconds"`
	WindowSeconds    *int      `json:"window_seconds"`
	CooldownSeconds  *int      `json:"cooldown_seconds"`
	Enabled          *bool     `json:"enabled"`
	ResolveThreshold *float64  `json:"resolve_threshold"`
}

var allowedMetrics = map[string]bool{
	"system.cpu.utilization":    true,
	"system.memory.utilization": true,
	"system.disk.utilization":   true,
}

var allowedOperators = map[string]bool{
	"gt":  true,
	"gte": true,
	"lt":  true,
	"lte": true,
}

// GET /api/v1/alerts/rules
func HandleListRules(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		rows, err := pool.Query(r.Context(), `
			SELECT
				id,
				name,
				metric,
				operator,
				threshold,
				window_seconds,
				for_seconds,
				severity,
				enabled,
				cooldown_seconds,
				resolve_threshold,
				created_at,
				updated_at
			FROM alert_rules
			ORDER BY created_at DESC
		`)
		if err != nil {
			http.Error(w, "database query failed", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		rules := []AlertRule{}

		for rows.Next() {
			var rule AlertRule
			err := rows.Scan(
				&rule.ID,
				&rule.Name,
				&rule.Metric,
				&rule.Operator,
				&rule.Threshold,
				&rule.WindowSeconds,
				&rule.ForSeconds,
				&rule.Severity,
				&rule.Enabled,
				&rule.CooldownSeconds,
				&rule.ResolveThreshold,
				&rule.CreatedAt,
				&rule.UpdatedAt,
			)
			if err != nil {
				http.Error(w, "scan failed", http.StatusInternalServerError)
				return
			}
			rules = append(rules, rule)
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(rules)
	}
}

// POST /api/v1/alerts/rules
func HandleCreateRule(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req CreateAlertRuleRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid JSON", http.StatusBadRequest)
			return
		}

		if req.Name == "" {
			http.Error(w, "name is required", http.StatusBadRequest)
			return
		}

		if !allowedMetrics[req.Metric] {
			http.Error(w, "unsupported metric", http.StatusBadRequest)
			return
		}

		if req.Operator == "" {
			req.Operator = "gt"
		}

		if !allowedOperators[req.Operator] {
			http.Error(w, "unsupported operator", http.StatusBadRequest)
			return
		}

		if req.WindowSeconds <= 0 {
			req.WindowSeconds = 60
		}

		if req.ForSeconds <= 0 {
			req.ForSeconds = 300
		}

		if req.CooldownSeconds <= 0 {
			req.CooldownSeconds = 900
		}

		if req.Severity == "" {
			req.Severity = "WARNING"
		}

		enabled := true
		if req.Enabled != nil {
			enabled = *req.Enabled
		}

		id := uuid.New()

		_, err := pool.Exec(r.Context(), `
			INSERT INTO alert_rules (
				id,
				name,
				metric,
				operator,
				threshold,
				window_seconds,
				for_seconds,
				severity,
				enabled,
				cooldown_seconds,
				resolve_threshold
			) VALUES (
				$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
			)
		`,
			id,
			req.Name,
			req.Metric,
			req.Operator,
			req.Threshold,
			req.WindowSeconds,
			req.ForSeconds,
			req.Severity,
			enabled,
			req.CooldownSeconds,
			req.ResolveThreshold,
		)

		if err != nil {
			http.Error(w, "database insert failed", http.StatusInternalServerError)
			return
		}

		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(map[string]string{
			"id": id.String(),
		})
	}
}

// PATCH /api/v1/alerts/rules/{ruleID}
func HandleUpdateRule(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ruleID := chi.URLParam(r, "ruleID")

		var req UpdateAlertRuleRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid JSON", http.StatusBadRequest)
			return
		}

		var rule AlertRule

		err := pool.QueryRow(r.Context(), `
			SELECT
				id,
				name,
				metric,
				operator,
				threshold,
				window_seconds,
				for_seconds,
				severity,
				enabled,
				cooldown_seconds,
				resolve_threshold,
				created_at,
				updated_at
			FROM alert_rules
			WHERE id = $1
		`, ruleID).Scan(
			&rule.ID,
			&rule.Name,
			&rule.Metric,
			&rule.Operator,
			&rule.Threshold,
			&rule.WindowSeconds,
			&rule.ForSeconds,
			&rule.Severity,
			&rule.Enabled,
			&rule.CooldownSeconds,
			&rule.ResolveThreshold,
			&rule.CreatedAt,
			&rule.UpdatedAt,
		)

		if err != nil {
			http.Error(w, "rule not found", http.StatusNotFound)
			return
		}

		if req.Name != nil {
			rule.Name = *req.Name
		}

		if req.Threshold != nil {
			rule.Threshold = *req.Threshold
		}

		if req.ForSeconds != nil {
			rule.ForSeconds = *req.ForSeconds
		}

		if req.WindowSeconds != nil {
			rule.WindowSeconds = *req.WindowSeconds
		}

		if req.CooldownSeconds != nil {
			rule.CooldownSeconds = *req.CooldownSeconds
		}

		if req.Enabled != nil {
			rule.Enabled = *req.Enabled
		}

		if req.ResolveThreshold != nil {
			rule.ResolveThreshold = req.ResolveThreshold
		}

		_, err = pool.Exec(r.Context(), `
			UPDATE alert_rules
			SET
				name = $2,
				threshold = $3,
				window_seconds = $4,
				for_seconds = $5,
				enabled = $6,
				cooldown_seconds = $7,
				resolve_threshold = $8,
				updated_at = NOW()
			WHERE id = $1
		`,
			rule.ID,
			rule.Name,
			rule.Threshold,
			rule.WindowSeconds,
			rule.ForSeconds,
			rule.Enabled,
			rule.CooldownSeconds,
			rule.ResolveThreshold,
		)

		if err != nil {
			http.Error(w, "database update failed", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(rule)
	}
}

// DELETE /api/v1/alerts/rules/{ruleID}
func HandleDeleteRule(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ruleID := chi.URLParam(r, "ruleID")

		_, err := pool.Exec(r.Context(), `
			DELETE FROM alert_rules
			WHERE id = $1
		`, ruleID)

		if err != nil {
			http.Error(w, "database delete failed", http.StatusInternalServerError)
			return
		}

		w.WriteHeader(http.StatusNoContent)
	}
}
