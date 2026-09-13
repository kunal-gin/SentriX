package alerts

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type engineRule struct {
	ID               string
	Name             string
	Metric           string
	Operator         string
	Threshold        float64
	WindowSeconds    int
	ForSeconds       int
	CooldownSeconds  int
	Severity         string
	ResolveThreshold *float64
}

type serverValue struct {
	ServerID string
	Value    float64
}

func StartEngine(ctx context.Context, pool *pgxpool.Pool) {
	slog.Info("alert engine started")

	ticker := time.NewTicker(15 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			slog.Info("alert engine stopped")
			return
		case <-ticker.C:
			evaluate(ctx, pool)
		}
	}
}

func evaluate(ctx context.Context, pool *pgxpool.Pool) {
	rows, err := pool.Query(ctx, `
		SELECT
			id,
			name,
			metric,
			operator,
			threshold,
			window_seconds,
			for_seconds,
			cooldown_seconds,
			severity,
			resolve_threshold
		FROM alert_rules
		WHERE enabled = true
	`)
	if err != nil {
		slog.Error("alert engine failed to load rules", "error", err)
		return
	}
	defer rows.Close()

	rules := []engineRule{}

	for rows.Next() {
		var rule engineRule
		err := rows.Scan(
			&rule.ID,
			&rule.Name,
			&rule.Metric,
			&rule.Operator,
			&rule.Threshold,
			&rule.WindowSeconds,
			&rule.ForSeconds,
			&rule.CooldownSeconds,
			&rule.Severity,
			&rule.ResolveThreshold,
		)
		if err != nil {
			slog.Error("alert engine failed to scan rule", "error", err)
			continue
		}
		rules = append(rules, rule)
	}

	for _, rule := range rules {
		evaluateRule(ctx, pool, rule)
	}
}

func evaluateRule(ctx context.Context, pool *pgxpool.Pool, rule engineRule) {
	table, ok := metricTableFor(rule.Metric)
	if !ok {
		return
	}

	query := fmt.Sprintf(`
		SELECT DISTINCT ON (server_id)
			server_id,
			value
		FROM %s
		WHERE time > now() - ($1::int * interval '1 second')
		ORDER BY server_id, time DESC
	`, table)

	rows, err := pool.Query(ctx, query, rule.WindowSeconds)
	if err != nil {
		slog.Error("alert engine metric query failed", "metric", rule.Metric, "error", err)
		return
	}
	defer rows.Close()

	for rows.Next() {
		var sv serverValue
		if err := rows.Scan(&sv.ServerID, &sv.Value); err != nil {
			slog.Error("alert engine failed to scan metric sample", "error", err)
			continue
		}

		processServerValue(ctx, pool, rule, sv.ServerID, sv.Value)
	}
}

func metricTableFor(metricName string) (string, bool) {
	switch metricName {
	case "system.cpu.utilization":
		return "metric_cpu", true
	case "system.memory.utilization":
		return "metric_memory", true
	case "system.disk.utilization":
		return "metric_disk", true
	default:
		return "", false
	}
}

func processServerValue(ctx context.Context, pool *pgxpool.Pool, rule engineRule, serverID string, value float64) {
	now := time.Now()

	var state string
	var firstBreach *time.Time
	var cooldownUntil *time.Time
	var incidentID *string

	err := pool.QueryRow(ctx, `
		SELECT state, first_breach_at, cooldown_until, incident_id
		FROM alert_states
		WHERE rule_id = $1 AND server_id = $2
	`, rule.ID, serverID).Scan(&state, &firstBreach, &cooldownUntil, &incidentID)

	if err == pgx.ErrNoRows {
		state = "OK"
	} else if err != nil {
		slog.Error("alert engine failed to load alert state", "error", err)
		return
	}

	breach := isBreached(value, rule)

	if breach {
		switch state {
		case "OK", "RESOLVED":
			upsertState(ctx, pool, rule.ID, serverID, "PENDING", &now, value, nil, cooldownUntil)

		case "PENDING":
			if firstBreach == nil {
				upsertState(ctx, pool, rule.ID, serverID, "PENDING", &now, value, nil, cooldownUntil)
				return
			}

			durationMet := now.Sub(*firstBreach) >= time.Duration(rule.ForSeconds)*time.Second
			if !durationMet {
				upsertState(ctx, pool, rule.ID, serverID, "PENDING", firstBreach, value, nil, cooldownUntil)
				return
			}

			if cooldownUntil != nil && now.Before(*cooldownUntil) {
				upsertState(ctx, pool, rule.ID, serverID, "PENDING", firstBreach, value, nil, cooldownUntil)
				return
			}

			newIncidentID := fireIncident(ctx, pool, rule, serverID, value)
			cooldown := now.Add(time.Duration(rule.CooldownSeconds) * time.Second)

			upsertState(ctx, pool, rule.ID, serverID, "FIRING", firstBreach, value, &newIncidentID, &cooldown)

		case "FIRING":
			upsertState(ctx, pool, rule.ID, serverID, "FIRING", firstBreach, value, incidentID, cooldownUntil)
		}

		return
	}

	// No breach
	switch state {
	case "PENDING":
		upsertState(ctx, pool, rule.ID, serverID, "OK", nil, value, nil, cooldownUntil)

	case "FIRING":
		if isResolved(value, rule) {
			cooldown := now.Add(time.Duration(rule.CooldownSeconds) * time.Second)

			upsertState(ctx, pool, rule.ID, serverID, "OK", nil, value, incidentID, &cooldown)
			resolveIncident(ctx, pool, rule, serverID)
			logResolvedEvent(ctx, pool, rule, serverID, value)
		} else {
			upsertState(ctx, pool, rule.ID, serverID, "FIRING", firstBreach, value, incidentID, cooldownUntil)
		}
	}
}

func isBreached(value float64, rule engineRule) bool {
	switch rule.Operator {
	case "gt":
		return value >= rule.Threshold
	case "gte":
		return value >= rule.Threshold
	case "lt":
		return value <= rule.Threshold
	case "lte":
		return value <= rule.Threshold
	default:
		return false
	}
}

func isResolved(value float64, rule engineRule) bool {
	if rule.ResolveThreshold != nil {
		switch rule.Operator {
		case "lt", "lte":
			return value >= *rule.ResolveThreshold
		default:
			return value <= *rule.ResolveThreshold
		}
	}

	return !isBreached(value, rule)
}

func upsertState(
	ctx context.Context,
	pool *pgxpool.Pool,
	ruleID string,
	serverID string,
	state string,
	firstBreach *time.Time,
	value float64,
	incidentID *string,
	cooldownUntil *time.Time,
) {
	_, err := pool.Exec(ctx, `
		INSERT INTO alert_states (
			rule_id,
			server_id,
			state,
			first_breach_at,
			last_value,
			last_eval_at,
			cooldown_until,
			incident_id
		) VALUES (
			$1, $2, $3, $4, $5, NOW(), $6, $7
		)
		ON CONFLICT (rule_id, server_id)
		DO UPDATE SET
			state = EXCLUDED.state,
			first_breach_at = EXCLUDED.first_breach_at,
			last_value = EXCLUDED.last_value,
			last_eval_at = NOW(),
			cooldown_until = EXCLUDED.cooldown_until,
			incident_id = EXCLUDED.incident_id,
			updated_at = NOW()
	`,
		ruleID,
		serverID,
		state,
		firstBreach,
		value,
		cooldownUntil,
		incidentID,
	)

	if err != nil {
		slog.Error("alert engine failed to upsert state", "error", err)
	}
}

func fireIncident(ctx context.Context, pool *pgxpool.Pool, rule engineRule, serverID string, value float64) string {
	message := fmt.Sprintf(
		"%s: current value %.2f crossed threshold %.2f",
		rule.Name,
		value,
		rule.Threshold,
	)

	_, err := pool.Exec(ctx, `
		INSERT INTO alert_events (
			rule_id,
			server_id,
			state,
			current_value,
			threshold,
			message
		) VALUES (
			$1, $2, 'FIRING', $3, $4, $5
		)
	`, rule.ID, serverID, value, rule.Threshold, message)

	if err != nil {
		slog.Error("alert engine failed to write alert event", "error", err)
	}

	incidentID := uuid.New()

	title := rule.Name
	summary := message

	err = pool.QueryRow(ctx, `
		INSERT INTO incidents (
			id,
			server_id,
			title,
			severity,
			status,
			started_at,
			root_alert_id,
			summary
		) VALUES (
			$1, $2, $3, $4, 'OPEN', NOW(), $5, $6
		)
		ON CONFLICT DO NOTHING
		RETURNING id
	`,
		incidentID,
		serverID,
		title,
		rule.Severity,
		rule.ID,
		summary,
	).Scan(&incidentID)

	if err == pgx.ErrNoRows {
		err = pool.QueryRow(ctx, `
			SELECT id
			FROM incidents
			WHERE server_id = $1
			  AND root_alert_id = $2
			  AND status IN ('OPEN', 'ACKNOWLEDGED', 'INVESTIGATING')
			ORDER BY started_at DESC
			LIMIT 1
		`, serverID, rule.ID).Scan(&incidentID)

		if err != nil {
			slog.Error("alert engine failed to locate existing incident", "error", err)
			return ""
		}
	} else if err != nil {
		slog.Error("alert engine failed to create incident", "error", err)
		return ""
	}

	slog.Info("alert fired",
		"rule", rule.Name,
		"server_id", serverID,
		"value", value,
		"threshold", rule.Threshold,
	)

	return incidentID.String()
}

func resolveIncident(ctx context.Context, pool *pgxpool.Pool, rule engineRule, serverID string) {
	_, err := pool.Exec(ctx, `
		UPDATE incidents
		SET
			status = 'RESOLVED',
			resolved_at = NOW()
		WHERE server_id = $1
		  AND root_alert_id = $2
		  AND status IN ('OPEN', 'ACKNOWLEDGED', 'INVESTIGATING')
	`, serverID, rule.ID)

	if err != nil {
		slog.Error("alert engine failed to resolve incident", "error", err)
	}

	slog.Info("alert resolved",
		"rule", rule.Name,
		"server_id", serverID,
	)
}

func logResolvedEvent(ctx context.Context, pool *pgxpool.Pool, rule engineRule, serverID string, value float64) {
	message := fmt.Sprintf(
		"%s: current value %.2f recovered",
		rule.Name,
		value,
	)

	_, err := pool.Exec(ctx, `
		INSERT INTO alert_events (
			rule_id,
			server_id,
			state,
			current_value,
			threshold,
			message
		) VALUES (
			$1, $2, 'RESOLVED', $3, $4, $5
		)
	`, rule.ID, serverID, value, rule.Threshold, message)

	if err != nil {
		slog.Error("alert engine failed to write resolved event", "error", err)
	}
}
